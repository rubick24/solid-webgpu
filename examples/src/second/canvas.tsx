import createRAF from '@solid-primitives/raf'
import { Vec3 } from 'math'
import { batch, createEffect, mergeProps, onCleanup, ParentProps, splitProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { CameraRef } from './camera'
import { SceneContext, SceneContextProvider } from './context'

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

  const [sceneContext, setSceneContext] = createStore<SceneContext>({
    ...propsWithDefault,
    device: _device,
    renderMap: {},
    renderOrder: [],
    lightList: []
  })
  const canvas = (<canvas width={propsWithDefault.width} height={propsWithDefault.height} />) as HTMLCanvasElement
  cProps.ref?.(canvas)

  batch(() => {
    setSceneContext('canvas', canvas)
    setSceneContext('context', canvas.getContext('webgpu')!)
  })

  createEffect(() => setSceneContext('width', propsWithDefault.width))
  createEffect(() => setSceneContext('height', propsWithDefault.height))
  createEffect(() => setSceneContext('format', propsWithDefault.format))
  createEffect(() => setSceneContext('autoClear', propsWithDefault.autoClear))
  createEffect(() => setSceneContext('samples', propsWithDefault.samples))

  createEffect(() => setSceneContext('currentCamera', propsWithDefault.camera))

  /**
   * resize swapchain
   */
  createEffect(() => {
    const { canvas, context, device, format } = sceneContext
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
      setSceneContext('msaaTexture', msaaTexture)
      setSceneContext('msaaTextureView', msaaTexture.createView())
      setSceneContext('depthTexture', depthTexture)
      setSceneContext('depthTextureView', depthTexture.createView())
    })

    onCleanup(() => {
      msaaTexture.destroy()
      depthTexture.destroy()
    })
  })

  createEffect(() => {
    if (!sceneContext.currentCamera) {
      return
    }
    const camera = sceneContext.currentCamera.camera[0]

    camera.projectionViewMatrix.copy(camera.projectionMatrix).multiply(camera.viewMatrix)

    const renderOrder = Object.values(sceneContext.renderMap)
      .map(v => {
        return {
          m: v.object3d[0].matrix,
          id: v.node[0].id
        }
      })
      .sort((a, b) => {
        let res = 0
        // TODO: handle depthTest disabled
        const am = a.m
        const bm = b.m

        Vec3.set(tempVec3, am[12], am[13], am[14])
        Vec3.transformMat4(tempVec3, tempVec3, camera.projectionViewMatrix)
        const tempZ = tempVec3.z
        Vec3.set(tempVec3, bm[12], bm[13], bm[14])
        Vec3.transformMat4(tempVec3, tempVec3, camera.projectionViewMatrix)
        res = res || tempZ - tempVec3.z
        return res
      })
      .map(v => v.id)

    setSceneContext('renderOrder', renderOrder)
  })

  const renderFn = () => {
    const { msaaTextureView, depthTextureView, context, device, renderMap, renderOrder } = sceneContext

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
      const meshRef = renderMap[id]
      const mesh = meshRef.mesh[0]
      const pipeline = mesh.pipeline
      if (!pipeline) {
        return
      }
      passEncoder.setPipeline(pipeline)

      const geo = mesh.geometry?.geometry[0]
      const ib = geo?.indexBuffer?.indexBuffer[0]
      if (!geo) {
        return
      }
      if (ib && ib.buffer) {
        passEncoder.setIndexBuffer(ib.buffer, `uint${ib.value.BYTES_PER_ELEMENT * 8}` as GPUIndexFormat)
      }
      geo.vertexBuffers.forEach((v, i) => {
        const buffer = v.vertexBuffer[0].buffer
        if (!buffer) {
          return
        }
        passEncoder.setVertexBuffer(i, buffer)
      })

      // const bindGroupLayout = mesh.material?.material[0].bindGroupLayout
      // const bindGroupEntries = mesh.material?.material[0].bindGroupEntries
      // if (bindGroupLayout && bindGroupEntries) {
      //   const bindGroup = device.createBindGroup({
      //     layout: bindGroupLayout,
      //     entries: bindGroupEntries
      //   })
      //   passEncoder.setBindGroup(0, bindGroup)
      // }

      const bindGroup = mesh.material?.material[0].bindGroup
      if (bindGroup) {
        passEncoder.setBindGroup(0, bindGroup)
      }

      const indexBuffer = ib
      const positionAttr = geo.vertexBuffers[0].vertexBuffer[0]

      // Alternate drawing for indexed and non-indexed children
      if (indexBuffer) {
        const count = Math.min(geo.drawRange.count, ib.value.length)
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

  const [running, start, stop] = createRAF(() => renderFn())
  start()

  return (
    <SceneContextProvider value={[sceneContext, setSceneContext]}>
      {canvas}
      {cProps.children}
    </SceneContextProvider>
  )
}
