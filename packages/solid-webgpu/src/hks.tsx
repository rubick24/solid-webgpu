import { Mat3, Mat4, Vec3, Vec3Like } from 'math'
import { Accessor, createEffect, createMemo, onCleanup } from 'solid-js'
import pbrShaderCode from './material/default_pbr.wgsl?raw'
import unlitShaderCode from './material/unlit.wgsl?raw'

import { MeshRef } from './mesh'
import { CameraContext, MaybeAccessor, Optional, PunctualLightContext, TypedArray } from './types'
import { access, imageBitmapFromImageUrl, setBitOfValue, white1pxBase64 } from './utils'

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
export const device = await _adapter?.requestDevice()!

export const createBuffer = (options: MaybeAccessor<GPUBufferDescriptor>) => {
  const buffer = createMemo<GPUBuffer>(() => {
    const v = device.createBuffer(access(options))
    onCleanup(() => v.destroy())
    return v
  })

  return buffer
}

export const createBufferFromValue = (
  options: MaybeAccessor<Omit<GPUBufferDescriptor, 'size'>>,
  value: MaybeAccessor<TypedArray | ArrayBuffer>
) => {
  const buffer = createBuffer(() => ({
    size: access(value).byteLength,
    ...access(options)
  }))

  createEffect(() => {
    const val = access(value)
    device.queue.writeBuffer(buffer(), 0, val)
  })
  return buffer
}

export const createTexture = (options: MaybeAccessor<GPUTextureDescriptor>) =>
  createMemo<GPUTexture>(() => {
    const v = device.createTexture(access(options))
    onCleanup(() => v.destroy())
    return v
  })
export const createTextureFromImage = (
  options: MaybeAccessor<Optional<Omit<GPUTextureDescriptor, 'size'>, 'usage'>>,
  image: MaybeAccessor<ImageBitmap>
) => {
  const img = access(image)
  const size = { width: img.width, height: img.height }
  const ops = access(options)
  const texture = createTexture(() => ({
    ...ops,
    usage:
      (ops.usage ?? 0) |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST,
    size
  }))

  createEffect(() => {
    const img = access(image)
    const size = { width: img.width, height: img.height }
    device.queue.copyExternalImageToTexture({ source: img }, { texture: texture() }, size)
  })
  return texture
}

export const createSampler = (options?: MaybeAccessor<GPUSamplerDescriptor>) =>
  createMemo<GPUSampler>(() => device.createSampler(access(options)))

const builtInBufferLength = {
  base: 80,
  punctual_lights: 16 * 4
} as const

export const createUniformBufferBase = () => {
  const val = new Float32Array(builtInBufferLength.base)
  const buffer = device.createBuffer({
    size: val.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(buffer, 0, val)

  const update = (ref: MeshRef) => {
    const scene = ref.scene()?.[0]
    if (!scene) {
      return
    }
    const cameraID = scene.currentCamera
    if (!cameraID) {
      return
    }

    const camera = scene.nodes[cameraID] as CameraContext
    const modelMatrix = Mat4.copy(val.subarray(0, 16), ref.matrix())
    const viewMatrix = Mat4.copy(val.subarray(16, 32), camera.viewMatrix())
    // projectionMatrix
    Mat4.copy(val.subarray(32, 48), camera.projectionMatrix())
    const modelViewMatrix = Mat4.copy(val.subarray(48, 64), viewMatrix)
    Mat4.mul(modelViewMatrix, modelViewMatrix, modelMatrix)
    // normalMatrix
    Mat3.normalFromMat4(val.subarray(64, 73), modelViewMatrix)
    // cameraPosition
    Vec3.copy(val.subarray(76, 79), camera.matrix().subarray(12, 15))

    device.queue.writeBuffer(buffer, 0, val)
  }

  return { buffer, update }
}

export const createUniformBufferPunctualLights = () => {
  const lightValues = new Float32Array(builtInBufferLength.punctual_lights)
  const buffer = device.createBuffer({
    size: lightValues.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(buffer, 0, lightValues)

  const update = (ref: MeshRef) => {
    const scene = ref?.scene()?.[0]
    if (!scene) {
      return
    }
    const { lightList } = scene
    for (let i = 0; i < lightList.length; i++) {
      const lightID = lightList[i]
      const light = scene.nodes[lightID] as PunctualLightContext

      const offset = i * 16
      if (lightValues.length < offset + 16) {
        console.warn('extra lights are ignored')
        break
      }
      // position
      Vec3.copy(lightValues.subarray(offset + 0, offset + 3), light.matrix().subarray(12, 15))
      // direction
      Vec3.copy(lightValues.subarray(offset + 4, offset + 7), light.matrix().subarray(8, 11))
      Vec3.copy(lightValues.subarray(offset + 8, offset + 11), light.color())

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

    device.queue.writeBuffer(buffer, 0, lightValues)
  }

  return { buffer, update }
}

const defaultBitmap = await imageBitmapFromImageUrl(white1pxBase64)
const defaultTexture = (() => {
  const size = { width: defaultBitmap.width, height: defaultBitmap.height }
  return device.createTexture({
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST,
    size
  })
})()

export const createBindGroupLayoutStatic = (uniforms: (GPUTexture | GPUSampler | GPUBuffer)[]) =>
  device.createBindGroupLayout({
    entries: uniforms.map((u, index) => {
      return {
        binding: index,
        visibility: u instanceof GPUBuffer ? GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT : GPUShaderStage.FRAGMENT,
        ...{
          texture: u instanceof GPUTexture ? {} : undefined,
          sampler: u instanceof GPUSampler ? {} : undefined,
          buffer: u instanceof GPUBuffer ? {} : undefined
        }
      }
    })
  })

// TODO: use mapArray here?
export const createBindGroupLayout = (uniforms: MaybeAccessor<(GPUTexture | GPUSampler | GPUBuffer)[]>) =>
  createMemo<GPUBindGroupLayout>(() => createBindGroupLayoutStatic(access(uniforms)))

export const createBindGroupEntriesStatic = (uniforms: (GPUTexture | GPUSampler | GPUBuffer)[]) =>
  uniforms.map((u, index) => {
    const resource = u instanceof GPUTexture ? u.createView() : u instanceof GPUSampler ? u : { buffer: u }
    return {
      binding: index,
      resource
    }
  })
export const createBindGroupEntries = (uniforms: MaybeAccessor<(GPUTexture | GPUSampler | GPUBuffer)[]>) =>
  createMemo<GPUBindGroupEntry[]>(() => createBindGroupEntriesStatic(access(uniforms)))

export const createBindGroup = (
  options: MaybeAccessor<{
    layout: GPUBindGroupLayout
    entries: GPUBindGroupEntry[]
  }>
) => createMemo<GPUBindGroup>(() => device.createBindGroup(access(options)))

export type MaterialOptions = {
  shaderCode: string
  bindGroupLayout: GPUBindGroupLayout
  bindGroup: GPUBindGroup

  update?: (ref: MeshRef) => void

  format?: GPUTextureFormat
  vertexEntryPoint?: string
  fragmentEntryPoint?: string
}
export type GeometryOptions = {
  indexBuffer?: {
    buffer: GPUBuffer
    BYTES_PER_ELEMENT: number
  }
  vertexBuffers: {
    buffer: GPUBuffer
    layout: GPUVertexBufferLayout
    name?: string
    type?: string
  }[]

  primitive?: GPUPrimitiveState
  depthStencil?: GPUDepthStencilState

  instanceCount?: number
  drawRange?: { start: number; count: number }
}

export const createMaterialStatic = (
  shaderCode: string,
  uniforms: (GPUTexture | GPUSampler | GPUBuffer)[],
  update?: (ref: MeshRef) => void
): MaterialOptions => {
  const bindGroupLayout = createBindGroupLayoutStatic(uniforms)
  const bindGroupEntries = createBindGroupEntriesStatic(uniforms)
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: bindGroupEntries
  })
  return {
    bindGroupLayout,
    bindGroup,
    shaderCode,
    update
  }
}
export const createMaterial = (
  shaderCode: MaybeAccessor<string>,
  uniforms: MaybeAccessor<(GPUTexture | GPUSampler | GPUBuffer)[]>,
  update?: (ref: MeshRef) => void
): Accessor<MaterialOptions> => {
  const bindGroupLayout = createBindGroupLayout(uniforms)
  const bindGroupEntries = createBindGroupEntries(uniforms)
  const bindGroup = createBindGroup(() => ({
    layout: bindGroupLayout(),
    entries: bindGroupEntries()
  }))

  return createMemo(() => ({
    bindGroupLayout: bindGroupLayout(),
    bindGroup: bindGroup(),
    shaderCode: access(shaderCode),
    update
  }))
}
export const createUnlitMaterial = (
  options?: MaybeAccessor<{
    albedo?: Vec3Like
    albedoTexture?: ImageBitmap
  }>
): Accessor<MaterialOptions> => {
  const { buffer: base, update: updateBase } = createUniformBufferBase()

  const albedoTexture = () => access(options ?? {}).albedoTexture

  // update albedo & texture flag
  const bufferValue = new ArrayBuffer(16)
  const albedo = new Vec3(bufferValue)
  const buffer = device.createBuffer({
    size: bufferValue.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(buffer, 0, bufferValue)
  createEffect(() => {
    albedo.copy(access(options ?? {}).albedo ?? [0, 0.5, 1])
    const flag = new Uint32Array(bufferValue, 12, 1)
    flag[0] = setBitOfValue(flag[0], 0, !!albedoTexture())
    device.queue.writeBuffer(buffer, 0, bufferValue)
  })

  const texture = createMemo(() => {
    return albedoTexture() ? createTextureFromImage({ format: 'rgba8unorm' }, albedoTexture()!)() : defaultTexture
  })

  const sampler = device.createSampler()

  const uniforms = () => [base, buffer, texture(), sampler]

  return createMaterial(unlitShaderCode, uniforms, updateBase)
}

export const defaultMaterial = (() => {
  const { buffer: base, update: updateBase } = createUniformBufferBase()

  const bufferValue = new ArrayBuffer(16)

  const buffer = device.createBuffer({
    size: bufferValue.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(buffer, 0, bufferValue)

  const sampler = device.createSampler()

  const uniforms = [base, buffer, defaultTexture, sampler]

  return createMaterialStatic(unlitShaderCode, uniforms, updateBase)
})()

export const createPlaneGeometry = (): GeometryOptions => {
  const vbs = [
    new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0]),
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    new Float32Array(4 * 4).fill(0),
    new Float32Array([1, 1, 0, 1, 0, 0, 1, 0])
  ].map(v => {
    const buffer = device.createBuffer({
      size: v.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(buffer, 0, v)
    return buffer
  })

  const ibVal = new Uint32Array([0, 1, 2, 0, 2, 3])
  const ib = device.createBuffer({
    size: ibVal.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(ib, 0, ibVal)

  return {
    indexBuffer: {
      buffer: ib,
      BYTES_PER_ELEMENT: Uint32Array.BYTES_PER_ELEMENT
    },
    vertexBuffers: [
      {
        buffer: vbs[0],
        layout: {
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3'
            } // POSITION
          ],
          arrayStride: 12
        }
      },
      {
        buffer: vbs[1],
        layout: {
          attributes: [
            {
              shaderLocation: 1,
              offset: 0,
              format: 'float32x3'
            } // NORMAL
          ],
          arrayStride: 12
        }
      },

      {
        buffer: vbs[2],
        layout: {
          attributes: [
            {
              shaderLocation: 2,
              offset: 0,
              format: 'float32x4'
            } // TANGENT
          ],
          arrayStride: 16
        }
      },
      {
        buffer: vbs[3],
        layout: {
          attributes: [
            {
              shaderLocation: 3,
              offset: 0,
              format: 'float32x2'
            } // UV
          ],
          arrayStride: 8
        }
      }
    ]
  }
}

export const createPBRMaterial = (
  options?: MaybeAccessor<{
    albedo?: Vec3Like
    metallic?: number
    roughness?: number
    occlusion?: number
    albedoTexture?: ImageBitmap
    occlusionRoughnessMetallicTexture?: ImageBitmap
  }>
) => {
  const _pbrBuffer = new ArrayBuffer(32)
  const buffer = device.createBuffer({
    size: _pbrBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })

  createEffect(() => {
    const ops = access(options)
    new Vec3(_pbrBuffer).copy(ops?.albedo ?? Vec3.fromValues(1, 1, 1))
    const pbrParamsValue = new Float32Array(_pbrBuffer, 12, 3)
    pbrParamsValue[0] = ops?.metallic ?? 0
    pbrParamsValue[1] = ops?.roughness ?? 0.5
    pbrParamsValue[2] = ops?.occlusion ?? 1.0
    const pbrFlag = new Uint32Array(_pbrBuffer, 24, 1)
    pbrFlag[0] = setBitOfValue(pbrFlag[0], 0, !!ops?.albedoTexture)
    pbrFlag[0] = setBitOfValue(pbrFlag[0], 1, !!ops?.occlusionRoughnessMetallicTexture)

    device.queue.writeBuffer(buffer, 0, _pbrBuffer)
  })

  const { buffer: base, update: updateBase } = createUniformBufferBase()
  const { buffer: punctualLights, update: updatePunctualLights } = createUniformBufferPunctualLights()
  const albedoTextureSource = () => access(options ?? {}).albedoTexture
  const ormTextureSource = () => access(options ?? {}).occlusionRoughnessMetallicTexture

  const albedoTexture = createMemo(() => {
    return albedoTextureSource()
      ? createTextureFromImage({ format: 'rgba8unorm' }, albedoTextureSource()!)()
      : defaultTexture
  })
  const ormTexture = createMemo(() => {
    return ormTextureSource() ? createTextureFromImage({ format: 'rgba8unorm' }, ormTextureSource()!)() : defaultTexture
  })

  const sampler = device.createSampler()

  const uniforms = () => [base, buffer, albedoTexture(), ormTexture(), sampler, punctualLights]

  return createMaterial(pbrShaderCode, uniforms, v => {
    updateBase(v)
    updatePunctualLights(v)
  })
}

const builtinAttributeNames = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']
export const createRenderPipeline = (
  options: MaybeAccessor<{
    shaderCode: string
    bindGroupLayout: GPUBindGroupLayout
    vertexBuffers: {
      buffer: GPUBuffer
      layout: GPUVertexBufferLayout
      name?: string
      type?: string
    }[]

    vertexEntryPoint?: string
    fragmentEntryPoint?: string
    format?: GPUTextureFormat

    primitive?: GPUPrimitiveState
    depthStencil?: GPUDepthStencilState
  }>
) => {
  const pipeline = createMemo<GPURenderPipeline>(() => {
    const ops = access(options)

    let code = ops.shaderCode
    const vertexInputStr = ops.vertexBuffers
      .filter(v => v.name && builtinAttributeNames.includes(v.name))
      .map((v, i) => `  @location(${i}) ${v.name}: ${v.type}`)
      .join(',\n')
    if (vertexInputStr) {
      const old = code.match(/^struct VertexInput {\n(.|\n)*?}/)?.[0]
      const rep = `struct VertexInput {\n${vertexInputStr}\n}`
      code = old?.length ? code.replace(old, rep) : rep + '\n' + code
    }
    const shaderModule = device.createShaderModule({ code })

    return device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [access(ops.bindGroupLayout)]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: ops.vertexEntryPoint ?? 'vs_main',
        buffers: ops.vertexBuffers.map(v => access(v.layout))
      },
      fragment: {
        module: shaderModule,
        entryPoint: ops.fragmentEntryPoint ?? 'fs_main',
        targets: [{ format: ops.format ?? navigator.gpu.getPreferredCanvasFormat() }]
      },
      primitive: {
        frontFace: 'ccw',
        cullMode: 'back',
        topology: 'triangle-list',
        ...ops.primitive
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus-stencil8',
        ...ops.depthStencil
      },
      multisample: { count: 4 }
    })
  })

  return pipeline
}
