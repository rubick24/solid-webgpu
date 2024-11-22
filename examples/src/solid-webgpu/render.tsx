import { createRAF } from '@solid-primitives/raf'
import { Mat4, Vec3 } from 'math'
import { Accessor, createEffect, onCleanup } from 'solid-js'
import { isCamera } from './camera'
import { CanvasProps } from './canvas'
import { isMesh } from './mesh'
import { isObject3D } from './object3d'
import { isPunctualLight } from './punctual_light'
import { SceneContextT } from './scene_context'
import { CameraToken, MeshToken, Object3DToken, PunctualLightToken, SamplerToken, Token } from './tokenizer'
import { createWithCache, TypedArray } from './utils'

export type RenderContext = {
  canvas: HTMLCanvasElement
  sceneContext: SceneContextT
  scene: Accessor<Token[]>
  props: Required<CanvasProps>
}

const traverse = (node: Token, fn: (v: Token) => boolean | void) => {
  if (fn(node)) return

  if ('children' in node && node.children?.length) {
    for (const child of node.children) {
      traverse(child, fn)
    }
  }
}

const sort = (
  nodes: Token[],
  camera: CameraToken
): {
  renderList: MeshToken[]
  lightList: PunctualLightToken[]
} => {
  const renderList: MeshToken[] = []
  const lightList: PunctualLightToken[] = []

  camera.projectionViewMatrix.copy(camera.projectionMatrix).multiply(camera.viewMatrix)

  nodes.forEach(node =>
    traverse(node, v => {
      if (isPunctualLight(v)) {
        lightList.push(v)
      } else if (isMesh(v)) {
        renderList.push(v)
      }
    })
  )

  renderList.sort((a, b) => {
    let res = 0
    // TODO: handle depthTest disabled

    Vec3.set(tempVec3, b.matrix[12], b.matrix[13], b.matrix[14])
    Vec3.transformMat4(tempVec3, tempVec3, camera.projectionViewMatrix)
    const tempZ = tempVec3.z
    Vec3.set(tempVec3, a.matrix[12], a.matrix[13], a.matrix[14])
    Vec3.transformMat4(tempVec3, tempVec3, camera.projectionViewMatrix)
    res = res || tempZ - tempVec3.z
    return res
  })

  return { renderList, lightList }
}

const createBuffer = (options: { device: GPUDevice; data: TypedArray; usage: GPUBufferUsageFlags; label?: string }) => {
  const { device, data, usage, label } = options
  const buffer = device.createBuffer({
    label,
    size: data.byteLength,
    usage: usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
  })
  device.queue.writeBuffer(buffer, 0, data)
  return buffer
}

const updateSampler = (v: SamplerToken, device: GPUDevice) => {
  return withCache(v.id, () => {
    const target = device.createSampler(v.descriptor)
    return target
  })
}

const updatePipeline = (options: { mesh: MeshToken; camera: CameraToken; lightList: PunctualLightToken[] }) => {
  const { mesh, camera, lightList } = options
  // const { uniforms, bindGroupLayout } = withCache(mesh.material!.id, () => {
  //   const uniforms = mesh.material?.uniforms.map(v => {})
  // })
}

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await _adapter?.requestDevice()!

const cache = new Map<string, unknown>()
const withCache = createWithCache(cache)

export const useRender = (ctx: RenderContext) => {
  const { canvas, sceneContext, scene: s } = ctx
  const context = canvas.getContext('webgpu')!

  let device = _device
  let _msaaTexture!: GPUTexture
  let _msaaTextureView!: GPUTextureView
  let _depthTexture!: GPUTexture
  let _depthTextureView!: GPUTextureView
  let _commandEncoder!: GPUCommandEncoder
  let _passEncoder!: GPURenderPassEncoder

  const props = ctx.props

  // _resizeSwapchain
  createEffect(() => {
    context.configure({
      device,
      format: props.format,
      alphaMode: 'premultiplied'
    })
    const size = [canvas.width, canvas.height]
    const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    const sampleCount = props.samples

    if (_msaaTexture) _msaaTexture.destroy()
    _msaaTexture = device.createTexture({
      format: props.format,
      size,
      usage,
      sampleCount
    })
    _msaaTextureView = _msaaTexture.createView()

    if (_depthTexture) _depthTexture.destroy()
    _depthTexture = device.createTexture({
      format: 'depth24plus-stencil8',
      size,
      usage,
      sampleCount
    })
    _depthTextureView = _depthTexture.createView()
  })

  const updateMatrix = (v: Token) => {
    if (!isObject3D(v)) {
      return
    }

    const { matrix, quaternion, position, scale } = v
    Mat4.fromRotationTranslationScale(matrix, quaternion, position, scale)
    if (v.parent) {
      const p = sceneContext.nodes[v.parent] as Object3DToken
      Mat4.mul(matrix, p.matrix, matrix)
    }
    if (isCamera(v)) {
      v.viewMatrix.copy(v.matrix).invert()
    }

    if (!v.children) {
      return
    }
    for (const child of v.children) {
      updateMatrix(child)
    }
  }

  const [running, start, stop] = createRAF(t => {
    const scene = s()
    const camera = props.camera
    const samples = props.samples

    // if (_msaaTexture.sampleCount !== samples) {
    //   _resizeSwapchain()
    // }

    const renderViews = [_msaaTextureView]
    const resolveTarget = context.getCurrentTexture().createView()
    const loadOp: GPULoadOp = props.autoClear ? 'clear' : 'load'
    const storeOp: GPUStoreOp = 'store'
    _commandEncoder = device.createCommandEncoder()
    const colorAttachments = renderViews.map<GPURenderPassColorAttachment>(view => ({
      view,
      resolveTarget,
      loadOp,
      storeOp,
      clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
    }))
    _passEncoder = _commandEncoder.beginRenderPass({
      colorAttachments,
      depthStencilAttachment: {
        view: _depthTextureView,
        depthClearValue: 1,
        depthLoadOp: loadOp,
        depthStoreOp: storeOp,
        stencilClearValue: 0,
        stencilLoadOp: loadOp,
        stencilStoreOp: storeOp
      }
    })
    _passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1)

    scene.map(v => updateMatrix(v))
    const { renderList, lightList } = sort(scene, camera)

    // for (const node of renderList) {
    //   _updatePipeline(node, camera, lightList)

    //   const indexBuffer = node.geometry.indexBuffer
    //   const position = node.geometry.vertexBuffers[0]

    //   // Alternate drawing for indexed and non-indexed children
    //   if (indexBuffer) {
    //     const count = Math.min(node.geometry.drawRange.count, indexBuffer.buffer.length)
    //     this._passEncoder.drawIndexed(count, node.geometry.instanceCount, node.geometry.drawRange.start ?? 0)
    //   } else if (position) {
    //     const count = Math.min(node.geometry.drawRange.count, position.buffer.length / position.layout.arrayStride)
    //     this._passEncoder.draw(count, node.geometry.instanceCount, node.geometry.drawRange.start ?? 0)
    //   } else {
    //     this._passEncoder.draw(3, node.geometry.instanceCount)
    //   }
    // }
  })
  start()

  setTimeout(() => {
    stop()
  }, 3000)

  onCleanup(() => stop())
}

const tempVec3 = Vec3.create()
const builtinAttributeNames = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']
