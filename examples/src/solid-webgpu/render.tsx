import { createRAF } from '@solid-primitives/raf'
import { Mat3, Mat4, Vec3 } from 'math'
import { Accessor, createEffect, onCleanup } from 'solid-js'
import { isCamera } from './camera'
import { CanvasProps } from './canvas'
import { SceneContextT } from './context'
import { isTexture, isUniformBuffer } from './material'
import { isMesh } from './mesh'
import { isObject3D } from './object3d'
import { isPunctualLight } from './punctual_light'
import {
  CameraToken,
  MeshToken,
  Object3DToken,
  PunctualLightToken,
  SamplerToken,
  TextureToken,
  Token
} from './tokenizer'
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

const createBuffer = (options: {
  device: GPUDevice
  data: TypedArray | ArrayBuffer
  usage: GPUBufferUsageFlags
  label?: string
}) => {
  const { device, data, usage, label } = options
  const buffer = device.createBuffer({
    label,
    size: data.byteLength,
    usage: usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
  })
  device.queue.writeBuffer(buffer, 0, data)
  return buffer
}

const updateTexture = (v: TextureToken, device: GPUDevice, format: GPUTextureFormat) => {
  // TODO: descriptor change
  return withCache(v.id, () => {
    const target = device.createTexture({
      ...v.descriptor,
      format: v.descriptor.format ?? format,
      usage:
        (v.descriptor.usage ?? 0) |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST
    })
    if ('image' in v && v.image) {
      device.queue.copyExternalImageToTexture({ source: v.image }, { texture: target }, v.descriptor.size)
    }
    return target
  })
}

const updateSampler = (v: SamplerToken, device: GPUDevice) => {
  // TODO: descriptor change
  return withCache(v.id, () => {
    const target = device.createSampler(v.descriptor)
    return target
  })
}

const updatePipeline = (options: {
  mesh: MeshToken
  camera: CameraToken
  lightList: PunctualLightToken[]
  device: GPUDevice

  format: GPUTextureFormat
  samples: number

  passEncoder: GPURenderPassEncoder
}) => {
  const { mesh, camera, lightList, device, format, samples, passEncoder } = options
  if (!mesh.material || !mesh.geometry) {
    // TODO: use default material
    throw new Error('no material or geometry')
  }

  /**
   * uniform setup
   */
  const { uniforms, bindGroupLayout } = withCache(mesh.material!.id, () => {
    const uniforms = mesh.material!.uniforms.map(v => {
      if (isUniformBuffer(v)) {
        if (v.builtIn && !v.value) {
          if (v.builtIn === 'base') {
            v.value = new Float32Array(80)
          } else if (v.builtIn === 'punctual_lights') {
            v.value = new Float32Array(16 * 4)
          }
        }
      }
      return v
    })
    const bindGroupLayout = device.createBindGroupLayout({
      entries: uniforms.map((v, i) => {
        if (isUniformBuffer(v)) {
          return {
            binding: i,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {}
          }
        } else if (isTexture(v)) {
          return {
            binding: i,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {}
          }
        } else {
          return {
            binding: i,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {}
          }
        }
      })
    })

    return { uniforms, bindGroupLayout }
  })

  /**
   * update built-in uniform
   */
  for (const uniform of uniforms) {
    if (isUniformBuffer(uniform)) {
      if (uniform.builtIn === 'base') {
        const bo = uniform.value as Float32Array
        const modelMatrix = Mat4.copy(bo.subarray(0, 16), mesh.matrix)
        const viewMatrix = Mat4.copy(bo.subarray(16, 32), camera.viewMatrix)
        // projectionMatrix
        Mat4.copy(bo.subarray(32, 48), camera.projectionMatrix)
        const modelViewMatrix = Mat4.copy(bo.subarray(48, 64), viewMatrix)
        Mat4.mul(modelViewMatrix, modelViewMatrix, modelMatrix)
        // normalMatrix
        Mat3.normalFromMat4(bo.subarray(64, 73), modelViewMatrix)
        // cameraPosition
        Vec3.copy(bo.subarray(76, 79), camera.matrix.subarray(12, 15))
      } else if (uniform.builtIn === 'punctual_lights') {
        const lightValues = uniform.value as Float32Array
        for (let i = 0; i < lightList.length; i++) {
          const light = lightList[i]
          const offset = i * 16
          if (lightValues.length < offset + 16) {
            console.warn('extra lights are ignored')
            break
          }
          // position
          Vec3.copy(lightValues.subarray(offset + 0, offset + 3), light.matrix.subarray(12, 15))
          // direction
          Vec3.copy(lightValues.subarray(offset + 4, offset + 7), light.matrix.subarray(8, 11))
          Vec3.copy(lightValues.subarray(offset + 8, offset + 11), light.color)

          lightValues[offset + 11] = light.intensity
          lightValues[offset + 12] = light.range ?? Infinity
          lightValues[offset + 13] = light.innerConeAngle
          lightValues[offset + 14] = light.outerConeAngle

          const m: Record<typeof light.lightType, number> = {
            directional: 1,
            point: 2,
            spot: 3
          }

          new DataView(lightValues.buffer).setUint32((offset + 15) * 4, m[light.lightType], true)
        }
      }
    }
  }

  /**
   * uniform binding
   */
  const bindGroupEntries: GPUBindGroupEntry[] = uniforms.map((uniform, i) => {
    if (isUniformBuffer(uniform)) {
      const buffer = withCache(uniform.id, () =>
        createBuffer({
          device,
          data: uniform.value as TypedArray,
          usage: GPUBufferUsage.UNIFORM,
          label: `uniform ${i} ${uniform.type}`
        })
      )
      // if (uniform.needsUpdate) {
      const data = uniform.value
      device.queue.writeBuffer(buffer, 'byteOffset' in data ? data.byteOffset : 0, data)
      // uniform.needsUpdate = false
      // }
      return { binding: i, resource: { buffer } }
    } else if (isTexture(uniform)) {
      const texture = updateTexture(uniform, device, format)
      return {
        binding: i,
        resource: 'createView' in texture ? texture.createView() : texture
      }
    } else {
      const sampler = updateSampler(uniform, device)
      return { binding: i, resource: sampler }
    }
  })

  /**
   * pipeline setup
   */
  const pipelineOption = {
    transparent: mesh.material.transparent,
    cullMode: mesh.material.cullMode,
    topology: mesh.geometry.topology,
    depthWriteEnabled: mesh.material.depthWrite,
    depthCompare: (mesh.material.depthTest ? 'less' : 'always') as GPUCompareFunction,
    vertexBufferLayouts: mesh.geometry.vertexBuffers.map(v => v.layout),
    blending: mesh.material.blending,
    colorAttachments: 1,
    samples
  }
  const pipelineCacheKey = JSON.stringify(pipelineOption)

  const pipeline = withCache(mesh.id + pipelineCacheKey, () => {
    let code = mesh.material!.shaderCode
    /**
     * set builtin vertexInput if defined in vertexBuffer
     */
    const vertexInputStr = mesh
      .geometry!.vertexBuffers.filter(v => v.attribute?.name && builtinAttributeNames.includes(v.attribute?.name))
      .map((v, i) => `  @location(${i}) ${v.attribute!.name}: ${v.attribute!.type}`)
      .join(',\n')
    if (vertexInputStr) {
      const old = code.match(/^struct VertexInput {\n(.|\n)*?}/)?.[0]
      const rep = `struct VertexInput {\n${vertexInputStr}\n}`
      code = old?.length ? code.replace(old, rep) : rep + '\n' + code
    }

    const shaderModule = device.createShaderModule({ code })

    return device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      label: pipelineCacheKey,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: pipelineOption.vertexBufferLayouts
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format
          }
        ]
      },
      primitive: {
        frontFace: 'ccw',
        cullMode: mesh.material!.cullMode,
        topology: mesh.geometry!.topology
      },
      depthStencil: {
        depthWriteEnabled: pipelineOption.depthWriteEnabled,
        depthCompare: pipelineOption.depthCompare,
        format: 'depth24plus-stencil8'
      },
      multisample: { count: pipelineOption.samples }
    })
  })

  passEncoder.setPipeline(pipeline)

  const ib = mesh.geometry.indexBuffer
  if (ib) {
    const buffer = withCache(ib.id, () => {
      return createBuffer({ device, data: ib.buffer, usage: GPUBufferUsage.INDEX })
    })

    passEncoder.setIndexBuffer(buffer, `uint${ib.buffer.BYTES_PER_ELEMENT * 8}` as GPUIndexFormat)
  }
  mesh.geometry.vertexBuffers.forEach((vb, i) => {
    const buffer = withCache(vb.id, () => {
      return createBuffer({ device, data: vb.buffer, usage: GPUBufferUsage.VERTEX })
    })

    // if (vb.needsUpdate) {
    const data = vb.buffer
    device.queue.writeBuffer(buffer, data.byteOffset, data)
    // vb.needsUpdate = false
    // }
    passEncoder.setVertexBuffer(i, buffer)
  })

  if (bindGroupEntries.length) {
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: bindGroupEntries
    })
    passEncoder.setBindGroup(0, bindGroup)
  }
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
    for (const node of renderList) {
      updatePipeline({
        mesh: node,
        camera,
        lightList,
        device,
        format: ctx.props.format,
        samples,
        passEncoder: _passEncoder
      })

      const indexBuffer = node.geometry!.indexBuffer
      const position = node.geometry!.vertexBuffers[0]

      if (!node.geometry) {
        return
      }
      // Alternate drawing for indexed and non-indexed children
      if (indexBuffer) {
        const count = Math.min(node.geometry.drawRange.count, indexBuffer.buffer.length)
        _passEncoder.drawIndexed(count, node.geometry.instanceCount, node.geometry.drawRange.start ?? 0)
      } else if (position) {
        const count = Math.min(node.geometry.drawRange.count, position.buffer.length / position.layout.arrayStride)
        _passEncoder.draw(count, node.geometry.instanceCount, node.geometry.drawRange.start ?? 0)
      } else {
        _passEncoder.draw(3, node.geometry.instanceCount)
      }
    }
    _passEncoder.end()
    device.queue.submit([_commandEncoder.finish()])
  })
  start()

  onCleanup(() => stop())
}

const tempVec3 = Vec3.create()
const builtinAttributeNames = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']
