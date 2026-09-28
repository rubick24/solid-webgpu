import { Vec3 } from '@rubick24/math'
import {
  children,
  createEffect,
  createStore,
  deep,
  For,
  isWrappable,
  onCleanup,
  reconcile,
  snapshot,
  untrack
} from 'solid-js'
import type { JSX } from '@solidjs/web'
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
    afterRender?: () => void
  }>,
  ch: () => JSX.Element
) => {
  let renderNow = (_t?: number) => {}
  let requestRender = () => {}
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
    lightList: [],
    renderNow: (t?: number) => renderNow(t),
    invalidate: () => requestRender()
  })
  createEffect(
    () => {
      const opts = access(options)
      return {
        cameraId: opts.camera?.id,
        texture: opts.texture,
        width: opts.width,
        height: opts.height,
        format: opts.format,
        sampleCount: opts.sampleCount,
        autoClear: opts.autoClear,
        clearValue: deep(opts.clearValue),
        canvas: opts.canvas,
        context: opts.context,
        update: opts.update,
        afterRender: opts.afterRender
      }
    },
    ({ cameraId, texture, width, height, format, sampleCount, autoClear, clearValue, canvas, context, update, afterRender }) =>
      setScene(scene => {
        scene.width = texture?.width ?? width ?? scene.width
        scene.height = texture?.height ?? height ?? scene.height
        scene.format = texture?.format ?? format ?? scene.format
        scene.sampleCount = sampleCount ?? scene.sampleCount
        scene.autoClear = autoClear ?? scene.autoClear
        if (clearValue != null) {
          // Merge colors in place; GPUColor also accepts non-store iterables.
          if (
            isWrappable(clearValue) &&
            isWrappable(scene.clearValue) &&
            Array.isArray(clearValue) === Array.isArray(scene.clearValue)
          ) {
            reconcile(clearValue)(scene.clearValue)
          } else {
            scene.clearValue = clearValue
          }
        }
        scene.currentCamera = cameraId
        scene.texture = texture ?? scene.texture
        scene.canvas = canvas ?? scene.canvas
        scene.context = context ?? scene.context
        scene.update = update
        scene.afterRender = afterRender
      })
  )

  /**
   * resize swapchain
   */
  createEffect(
    () => {
      // Track the store field, but pass the raw WebIDL object to WebGPU.
      const context = scene.context ? snapshot(scene).context : undefined
      return {
        context,
        format: scene.format,
        width: scene.width,
        height: scene.height,
        sampleCount: scene.sampleCount
      }
    },
    ({ context, format, width, height, sampleCount }) => {
      if (context) {
        context.configure({
          device,
          format,
          alphaMode: 'premultiplied'
        })
      }

      const size = [width, height]
      const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
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

      setScene(scene => {
        scene.msaaTexture = msaaTexture
        scene.msaaTextureView = msaaTexture.createView({ label: 'msaaTextureView' })
        scene.depthTexture = depthTexture
        scene.depthTextureView = depthTexture.createView({ label: 'depthTextureView' })
      })

      return () => {
        msaaTexture.destroy()
        depthTexture.destroy()
      }
    }
  )

  // render function
  const renderFn = () => {
    const currentScene = snapshot(scene)
    const { msaaTextureView, depthTextureView, context } = currentScene
    if (!msaaTextureView || !depthTextureView) {
      return
    }

    const camera = currentScene.currentCamera
      ? (currentScene.nodes[currentScene.currentCamera] as CameraRef | undefined)
      : undefined
    const projectionViewMatrix = camera?.projectionViewMatrix()
    const orderedIds = projectionViewMatrix
      ? currentScene.renderList
          .flatMap(id => {
            const mesh = currentScene.nodes[id] as MeshRef | undefined
            return mesh ? [{ id: mesh.id, matrix: mesh.matrix() }] : []
          })
          .sort((a, b) => {
            // TODO: handle depthTest disabled
            Vec3.set(tempVec3, a.matrix[12], a.matrix[13], a.matrix[14])
            Vec3.transformMat4(tempVec3, tempVec3, projectionViewMatrix)
            const az = tempVec3.z
            Vec3.set(tempVec3, b.matrix[12], b.matrix[13], b.matrix[14])
            Vec3.transformMat4(tempVec3, tempVec3, projectionViewMatrix)
            return az - tempVec3.z
          })
          .map(v => v.id)
      : []

    const resolveTarget = currentScene.texture?.createView() ?? context?.getCurrentTexture().createView()
    const loadOp: GPULoadOp = currentScene.autoClear ? 'clear' : 'load'
    const storeOp: GPUStoreOp = 'store'
    const commandEncoder = device.createCommandEncoder()

    const direct = context && currentScene.sampleCount === 1
    const colorAttachment: GPURenderPassColorAttachment = {
      view: direct ? resolveTarget! : msaaTextureView,
      resolveTarget: direct ? undefined : resolveTarget,
      loadOp,
      storeOp,
      clearValue: currentScene.clearValue
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
    passEncoder.setViewport(0, 0, currentScene.width, currentScene.height, 0, 1)
    for (const id of orderedIds) {
      const mesh = currentScene.nodes[id] as MeshRef
      mesh.draw(passEncoder)
    }

    passEncoder.end()
    device.queue.submit([commandEncoder.finish()])
  }

  let timeout: number | undefined
  const renderFrame = (t: number) => {
    timeout = undefined
    renderNow(t)
  }
  requestRender = () => {
    if (timeout === undefined) timeout = requestAnimationFrame(renderFrame)
  }
  renderNow = (t = performance.now()) => {
    if (timeout !== undefined) cancelAnimationFrame(timeout)
    timeout = undefined
    untrack(() => {
      const update = snapshot(scene).update
      update?.(t)
      renderFn()
      snapshot(scene).afterRender?.()
      if (update) requestRender()
    })
  }
  onCleanup(() => {
    if (timeout !== undefined) cancelAnimationFrame(timeout)
  })
  createEffect(
    () => {
      // Explicitly list all dependencies that should trigger a re-render.
      const camera = scene.currentCamera
        ? (scene.nodes[scene.currentCamera] as CameraRef | undefined)
        : undefined
      const deps = {
        cameraMatrix: camera?.projectionViewMatrix(),
        width: scene.width,
        height: scene.height,
        autoClear: scene.autoClear,
        clearValue: deep(scene.clearValue),
        texture: scene.texture,
        sampleCount: scene.sampleCount,
        update: scene.update,
        afterRender: scene.afterRender
      }
      return deps
    },
    () => {
      requestRender()
    }
  )

  const c = children(ch)

  const comp = (
    <For each={c.toArray()}>
      {child => {
        if (isWgpuComponent(child)) {
          child.setSceneCtx([scene, setScene])
          return untrack(() => child.render())
        }
        return child
      }}
    </For>
  )

  return [scene, setScene, comp] as const
}
