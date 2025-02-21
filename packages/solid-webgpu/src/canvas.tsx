import { Vec3 } from 'math'
import { batch, children, createEffect, For, mergeProps, onCleanup, ParentProps, splitProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { device } from './hks'
import { CameraRef, isWgpuComponent, MeshRef, SceneContext } from './types'

const tempVec3 = Vec3.create()

export type CanvasProps = ParentProps & {
  width?: number
  height?: number
  format?: GPUTextureFormat
  autoClear?: boolean
  clearValue?: GPUColor
  sampleCount?: number
  camera?: CameraRef
  texture?: GPUTexture
  ref?: (v: HTMLCanvasElement) => void
}

export const Canvas = (props: CanvasProps) => {
  const defaultProps = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    sampleCount: 4
  }

  const [cProps, _props] = splitProps(props, ['children', 'ref'])
  const propsWithDefault = mergeProps(defaultProps, _props)

  const [scene, setScene] = createStore<SceneContext>({
    ...propsWithDefault,
    nodes: {},
    renderList: [],
    renderOrder: [],
    lightList: []
  })
  const canvas = (
    <canvas
      style={{ display: propsWithDefault.texture ? 'none' : undefined }}
      width={propsWithDefault.width}
      height={propsWithDefault.height}
    />
  ) as HTMLCanvasElement
  cProps.ref?.(canvas)

  batch(() => {
    setScene('canvas', canvas)
    setScene('context', canvas.getContext('webgpu')!)
  })

  createEffect(() => {
    setScene(v => {
      return {
        ...v,
        width: propsWithDefault.texture?.width ?? propsWithDefault.width,
        height: propsWithDefault.texture?.height ?? propsWithDefault.height,
        format: propsWithDefault.texture?.format ?? propsWithDefault.format,
        sampleCount: propsWithDefault.texture?.sampleCount ?? propsWithDefault.sampleCount,
        autoClear: propsWithDefault.autoClear,
        clearValue: propsWithDefault.clearValue,
        currentCamera: propsWithDefault.camera?.id,
        scene: propsWithDefault.texture
      }
    })
  })

  /**
   * resize swapchain
   */
  createEffect(() => {
    const { canvas, context, format } = scene
    if (!canvas || !context) {
      return
    }
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied'
    })
    const size = [scene.width, scene.height]
    const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    const sampleCount = scene.sampleCount

    const msaaTexture = device.createTexture({
      format,
      size,
      usage,
      sampleCount
    })
    const depthTexture = device.createTexture({
      format: 'depth24plus-stencil8',
      size,
      usage,
      sampleCount
    })

    batch(() => {
      setScene('msaaTexture', msaaTexture)
      setScene('msaaTextureView', msaaTexture.createView())
      setScene('depthTexture', depthTexture)
      setScene('depthTextureView', depthTexture.createView())
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

  const renderFn = () => {
    const { msaaTextureView, depthTextureView, context, renderOrder } = scene
    if (!context || !msaaTextureView || !depthTextureView) {
      return
    }

    const resolveTarget = scene.texture?.createView() ?? context.getCurrentTexture().createView()
    const loadOp: GPULoadOp = scene.autoClear ? 'clear' : 'load'
    const storeOp: GPUStoreOp = 'store'
    const commandEncoder = device.createCommandEncoder()

    const colorAttachment: GPURenderPassColorAttachment = {
      view: msaaTextureView,
      resolveTarget,
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

  createEffect(() => {
    renderFn()
  })

  const ch = children(() => cProps.children)

  return (
    <>
      {canvas}
      <For each={ch.toArray()}>
        {child => {
          if (isWgpuComponent(child)) {
            child.setSceneCtx([scene, setScene])
            return child.render()
          }
          return child
        }}
      </For>
    </>
  )
}
