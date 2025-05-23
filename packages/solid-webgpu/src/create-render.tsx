import { Vec3 } from '@rubick24/math'
import { batch, children, createEffect, For, JSX, onCleanup } from 'solid-js'
import { createStore } from 'solid-js/store'
import { device } from './hks'
import { CameraRef, isWgpuComponent, MaybeAccessor, MeshRef, SceneContext } from './types'
import { access } from './utils'

const tempVec3 = Vec3.create()
export const createRender = (
  options: MaybeAccessor<{
    camera?: CameraRef
    autoClear?: boolean
    clearValue?: GPUColor

    // render to texture
    texture?: GPUTexture
    updateSignal?: () => number

    // render to canvas
    canvas?: HTMLCanvasElement
    context?: GPUCanvasContext

    // shared
    width?: number
    height?: number
    format?: GPUTextureFormat
    sampleCount?: number

    // user
    update?: (t: number) => void
  }>,
  ch: () => JSX.Element
) => {
  const defaultOptions = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    sampleCount: 4
  }

  const [scene, setScene] = createStore<SceneContext>({
    ...defaultOptions,
    nodes: {},
    renderList: [],
    renderOrder: [],
    lightList: []
  })
  createEffect(() => {
    const opts = access(options)

    setScene(v => ({
      ...v,
      width: opts.texture?.width ?? opts.width ?? v.width,
      height: opts.texture?.height ?? opts.height ?? v.height,
      format: opts.texture?.format ?? opts.format ?? v.format,
      sampleCount: opts.sampleCount ?? v.sampleCount,
      autoClear: opts.autoClear ?? v.autoClear,
      clearValue: opts.clearValue ?? v.clearValue,
      currentCamera: opts.camera?.id ?? v.currentCamera,
      texture: opts.texture ?? v.texture,
      canvas: opts.canvas ?? v.canvas,
      context: opts.context ?? v.context,

      update: opts.update ?? v.update
    }))
  })

  /**
   * resize swapchain
   */
  createEffect(() => {
    const { context, format } = scene
    if (context) {
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied'
      })
    }

    const size = [scene.width, scene.height]
    const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    const sampleCount = scene.sampleCount

    const msaaTexture = device.createTexture({
      format,
      size,
      usage,
      sampleCount,
      label: 'msaaTexture'
    })
    const depthTexture = device.createTexture({
      format: 'depth24plus-stencil8',
      size,
      usage,
      sampleCount,
      label: 'depthTexture'
    })

    batch(() => {
      setScene('msaaTexture', msaaTexture)
      setScene('msaaTextureView', msaaTexture.createView({ label: 'msaaTextureView' }))
      setScene('depthTexture', depthTexture)
      setScene('depthTextureView', depthTexture.createView({ label: 'depthTextureView' }))
    })

    onCleanup(() => {
      msaaTexture.destroy()
      depthTexture.destroy()
    })
  })

  /**
   * update render order
   */
  createEffect(() => {
    if (!scene.currentCamera) {
      return
    }
    const camera = scene.nodes[scene.currentCamera] as CameraRef
    if (!camera) {
      return
    }
    const projectionViewMatrix = camera.projectionViewMatrix()

    const renderOrder = scene.renderList
      .map(id => {
        const v = scene.nodes[id] as MeshRef
        return {
          m: v.matrix(),
          id: v.id
        }
      })
      .sort((a, b) => {
        let res = 0
        // TODO: handle depthTest disabled
        const am = a.m
        const bm = b.m

        Vec3.set(tempVec3, am[12], am[13], am[14])
        Vec3.transformMat4(tempVec3, tempVec3, projectionViewMatrix)
        const tempZ = tempVec3.z
        Vec3.set(tempVec3, bm[12], bm[13], bm[14])
        Vec3.transformMat4(tempVec3, tempVec3, projectionViewMatrix)
        res = res || tempZ - tempVec3.z
        return res
      })
      .map(v => v.id)

    setScene('renderOrder', renderOrder)
  })

  // render function
  const renderFn = () => {
    const { msaaTextureView, depthTextureView, context, renderOrder } = scene
    if (!msaaTextureView || !depthTextureView) {
      return
    }

    const resolveTarget = scene.texture?.createView() ?? context?.getCurrentTexture().createView()
    const loadOp: GPULoadOp = scene.autoClear ? 'clear' : 'load'
    const storeOp: GPUStoreOp = 'store'
    const commandEncoder = device.createCommandEncoder()

    const direct = context && scene.sampleCount === 1
    const colorAttachment: GPURenderPassColorAttachment = {
      view: direct ? resolveTarget! : msaaTextureView,
      resolveTarget: direct ? undefined : resolveTarget,
      loadOp,
      storeOp,
      clearValue: scene.clearValue
    }

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [colorAttachment],
      depthStencilAttachment: {
        view: depthTextureView,
        depthClearValue: 1,
        depthLoadOp: loadOp,
        depthStoreOp: storeOp,
        stencilClearValue: 0,
        stencilLoadOp: loadOp,
        stencilStoreOp: storeOp
      }
    })
    passEncoder.setViewport(0, 0, scene.width, scene.height, 0, 1)
    for (const id of renderOrder) {
      const mesh = scene.nodes[id] as MeshRef
      mesh.draw(passEncoder)
    }

    passEncoder.end()
    device.queue.submit([commandEncoder.finish()])
  }

  const updateSignal = access(options).updateSignal

  let timeout = NaN
  createEffect(() => {
    // Explicitly list all dependencies that should trigger a re-render
    const deps = {
      renderOrder: scene.renderOrder,
      width: scene.width,
      height: scene.height,
      autoClear: scene.autoClear,
      clearValue: scene.clearValue,
      texture: scene.texture,
      sampleCount: scene.sampleCount
    }
    // trigger update if exists
    updateSignal?.()

    if (timeout) {
      cancelAnimationFrame(timeout)
    }
    timeout = requestAnimationFrame(t => {
      scene.update?.(t)
      renderFn()
    })

    onCleanup(() => {
      if (timeout) {
        cancelAnimationFrame(timeout)
      }
    })
  })

  const c = children(ch)

  const comp = (
    <For each={c.toArray()}>
      {child => {
        if (isWgpuComponent(child)) {
          child.setSceneCtx([scene, setScene])
          return child.render()
        }
        return child
      }}
    </For>
  )

  return [scene, setScene, comp] as const
}
