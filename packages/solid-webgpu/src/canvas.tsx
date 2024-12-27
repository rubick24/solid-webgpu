import { Vec3 } from 'math'
import { batch, children, createEffect, For, mergeProps, onCleanup, ParentProps, splitProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { CameraRef } from './camera'
import {
  CameraContext,
  GeometryContext,
  IndexBufferContext,
  isWgpuComponent,
  MaterialContext,
  MeshContext,
  SceneContext,
  VertexBufferContext
} from './types'

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await _adapter?.requestDevice()!

const tempVec3 = Vec3.create()

export type CanvasProps = ParentProps & {
  width?: number
  height?: number
  format?: GPUTextureFormat
  autoClear?: boolean
  samples?: number
  camera?: CameraRef
  ref?: (v: HTMLCanvasElement) => void
}

export const Canvas = (props: CanvasProps) => {
  const defaultProps = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    samples: 4
  }

  const [cProps, _props] = splitProps(props, ['children', 'ref'])
  const propsWithDefault = mergeProps(defaultProps, _props)

  const [scene, setScene] = createStore<SceneContext>({
    ...propsWithDefault,
    device: _device,
    nodes: {},
    renderList: [],
    renderOrder: [],
    lightList: []
  })
  const canvas = (<canvas width={propsWithDefault.width} height={propsWithDefault.height} />) as HTMLCanvasElement
  cProps.ref?.(canvas)

  batch(() => {
    setScene('canvas', canvas)
    setScene('context', canvas.getContext('webgpu')!)
  })

  createEffect(() => setScene('width', propsWithDefault.width))
  createEffect(() => setScene('height', propsWithDefault.height))
  createEffect(() => setScene('format', propsWithDefault.format))
  createEffect(() => setScene('autoClear', propsWithDefault.autoClear))
  createEffect(() => setScene('samples', propsWithDefault.samples))

  createEffect(() => setScene('currentCamera', propsWithDefault.camera?.id))

  /**
   * resize swapchain
   */
  createEffect(() => {
    const { canvas, context, device, format } = scene
    if (!canvas || !context) {
      return
    }
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied'
    })
    const size = [canvas.width, canvas.height]
    const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    const sampleCount = propsWithDefault.samples

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

  createEffect(() => {
    if (!scene.currentCamera) {
      return
    }
    const camera = scene.nodes[scene.currentCamera] as CameraContext
    if (!camera) {
      return
    }
    const projectionViewMatrix = camera.projectionViewMatrix()

    const renderOrder = scene.renderList
      .map(id => {
        const v = scene.nodes[id] as MeshContext
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
    const { msaaTextureView, depthTextureView, context, device, renderOrder } = scene

    if (!context || !msaaTextureView || !depthTextureView) {
      return
    }

    const resolveTarget = context.getCurrentTexture().createView()
    const loadOp: GPULoadOp = propsWithDefault.autoClear ? 'clear' : 'load'
    const storeOp: GPUStoreOp = 'store'
    const commandEncoder = device.createCommandEncoder()

    const colorAttachment: GPURenderPassColorAttachment = {
      view: msaaTextureView,
      resolveTarget,
      loadOp,
      storeOp,
      clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
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
    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1)
    for (const id of renderOrder) {
      const mesh = scene.nodes[id] as MeshContext
      const pipeline = mesh.pipeline
      if (!pipeline) {
        return
      }
      passEncoder.setPipeline(pipeline)

      if (!mesh.geometry) {
        return
      }

      const geo = scene.nodes[mesh.geometry] as GeometryContext
      const ib = geo.indexBuffer ? (scene.nodes[geo.indexBuffer] as IndexBufferContext) : null
      if (ib && ib.buffer) {
        passEncoder.setIndexBuffer(ib.buffer, `uint${ib.value().BYTES_PER_ELEMENT * 8}` as GPUIndexFormat)
      }
      geo.vertexBuffers.forEach((v, i) => {
        const buffer = (scene.nodes[v] as VertexBufferContext).buffer
        if (!buffer) {
          return
        }
        passEncoder.setVertexBuffer(i, buffer)
      })

      const m = mesh.material ? (scene.nodes[mesh.material] as MaterialContext) : null
      const bindGroup = m?.bindGroup
      if (bindGroup) {
        passEncoder.setBindGroup(0, bindGroup)
      }

      const indexBuffer = ib
      const positionAttr = scene.nodes[geo.vertexBuffers[0]] as VertexBufferContext

      // Alternate drawing for indexed and non-indexed children
      if (indexBuffer) {
        const count = Math.min(geo.drawRange.count, ib.value().length)
        passEncoder.drawIndexed(count, geo.instanceCount, geo.drawRange.start ?? 0)
      } else if (positionAttr) {
        const count = Math.min(geo.drawRange.count, positionAttr.value.length / positionAttr.layout.arrayStride)
        passEncoder.draw(count, geo.instanceCount, geo.drawRange.start ?? 0)
      } else {
        passEncoder.draw(3, geo.instanceCount)
      }
    }

    passEncoder.end()
    device.queue.submit([commandEncoder.finish()])
  }

  createEffect(() => {
    renderFn()
  })

  // const [running, start, stop] = createRAF(() => renderFn())
  // start()

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
