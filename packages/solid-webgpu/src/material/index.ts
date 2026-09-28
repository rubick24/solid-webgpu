import { Vec3, type Vec3Like } from '@rubick24/math'
import { type Accessor, createEffect, createMemo, createRoot } from 'solid-js'
import {
  createBindGroup,
  createBindGroupEntries,
  createBindGroupLayout,
  createSampler,
  createTextureFromImage,
  createUniformBufferBase,
  createUniformBufferPunctualLights,
  device,
} from '../hks'
import type { MaybeAccessor, MeshRef } from '../types'
import { access, imageBitmapFromImageUrl, setBitOfValue, white1pxBase64 } from '../utils'
import pbrShaderCode from './default-pbr.wgsl?raw'
import unlitShaderCode from './unlit.wgsl?raw'

export type MaterialOptions = {
  shaderCode: string
  bindGroupLayout: GPUBindGroupLayout
  bindGroup: GPUBindGroup

  update?: (ref: MeshRef) => void

  format?: GPUTextureFormat
  vertexEntryPoint?: string
  fragmentEntryPoint?: string
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'
  alphaCutoff?: number
  doubleSided?: boolean
  supportsVertexColor?: boolean
}
export const createMaterial = (
  shaderCode: MaybeAccessor<string>,
  uniforms: MaybeAccessor<(GPUTexture | GPUSampler | GPUBuffer)[]>,
  update?: (ref: MeshRef) => void,
  state: MaybeAccessor<Pick<MaterialOptions, 'alphaMode' | 'alphaCutoff' | 'doubleSided' | 'supportsVertexColor'>> =
    {},
): Accessor<MaterialOptions> => {
  const bindGroupLayout = createBindGroupLayout(uniforms)
  const bindGroupEntries = createBindGroupEntries(uniforms)
  const bindGroup = createBindGroup(() => ({
    layout: bindGroupLayout(),
    entries: bindGroupEntries(),
  }))

  return createMemo(() => ({
    bindGroupLayout: bindGroupLayout(),
    bindGroup: bindGroup(),
    shaderCode: access(shaderCode),
    update,
    ...access(state),
  }))
}
export const createUnlitMaterial = (
  options?: MaybeAccessor<{
    albedo?: Vec3Like
    alpha?: number
    albedoTexture?: GPUTexture
    albedoTextureSource?: ImageBitmap
    albedoTextureFormat?: GPUTextureFormat
    albedoSampler?: GPUSamplerDescriptor
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'
    alphaCutoff?: number
    doubleSided?: boolean
    albedoTexCoord?: number
  }>,
): Accessor<MaterialOptions> => {
  const { buffer: base, update: updateBase } = createUniformBufferBase()

  const albedoTexture = () => access(options ?? {}).albedoTexture
  const albedoTextureSource = () => access(options ?? {}).albedoTextureSource
  const albedoTextureFormat = () => access(options ?? {}).albedoTextureFormat ?? 'rgba8unorm'

  // update albedo & texture flag
  const bufferValue = new ArrayBuffer(32)
  const albedo = new Vec3(bufferValue)
  const buffer = device.createBuffer({
    size: bufferValue.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(buffer, 0, bufferValue)
  createEffect(
    () => ({
      albedo: new Vec3(access(options ?? {}).albedo ?? ([0, 0.5, 1] as Vec3Like)),
      alpha: access(options ?? {}).alpha ?? 1,
      hasTexture: !!(albedoTexture() || albedoTextureSource()),
      alphaMode: access(options ?? {}).alphaMode,
      alphaCutoff: access(options ?? {}).alphaCutoff ?? 0.5,
    }),
    values => {
      albedo.copy(values.albedo)
      new Float32Array(bufferValue, 12, 1)[0] = values.alpha
      const flag = new Uint32Array(bufferValue, 16, 1)
      flag[0] = setBitOfValue(flag[0], 0, values.hasTexture)
      flag[0] = setBitOfValue(flag[0], 1, values.alphaMode === 'MASK')
      new Float32Array(bufferValue, 20, 1)[0] = values.alphaCutoff
      device.queue.writeBuffer(buffer, 0, bufferValue)
    },
  )

  const texture = createMemo(() => {
    const _albedoTextureSource = albedoTextureSource()
    const _albedoTexture = albedoTexture()
    if (_albedoTexture) {
      return _albedoTexture
    } else if (_albedoTextureSource) {
      return createTextureFromImage({ format: albedoTextureFormat() }, _albedoTextureSource)()
    } else {
      return defaultTexture
    }
  })

  const sampler = createSampler(() => access(options ?? {}).albedoSampler ?? {})

  const uniforms = () => [base, buffer, texture(), sampler()]

  const shaderCode = createMemo(() =>
    unlitShaderCode.replaceAll('__BASE_COLOR_UV__', `input.uv_${access(options ?? {}).albedoTexCoord ?? 0}`),
  )
  return createMaterial(shaderCode, uniforms, updateBase, () => ({
    alphaMode: access(options ?? {}).alphaMode,
    alphaCutoff: access(options ?? {}).alphaCutoff,
    doubleSided: access(options ?? {}).doubleSided,
    supportsVertexColor: true,
  }))
}

export const createPBRMaterial = (
  options?: MaybeAccessor<{
    albedo?: Vec3Like
    alpha?: number
    metallic?: number
    roughness?: number
    occlusion?: number
    albedoTexture?: GPUTexture
    albedoTextureSource?: ImageBitmap
    albedoTextureFormat?: GPUTextureFormat
    albedoSampler?: GPUSamplerDescriptor
    ormSampler?: GPUSamplerDescriptor
    occlusionRoughnessMetallicTexture?: GPUTexture
    occlusionRoughnessMetallicTextureSource?: ImageBitmap
    occlusionTexture?: GPUTexture
    occlusionTextureSource?: ImageBitmap
    occlusionTextureSampler?: GPUSamplerDescriptor
    occlusionStrength?: number
    normalTextureSource?: ImageBitmap
    normalSampler?: GPUSamplerDescriptor
    normalScale?: number
    emissive?: Vec3Like
    emissiveTexture?: GPUTexture
    emissiveTextureSource?: ImageBitmap
    emissiveSampler?: GPUSamplerDescriptor
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'
    alphaCutoff?: number
    doubleSided?: boolean
    baseColorTexCoord?: number
    metallicRoughnessTexCoord?: number
    occlusionTexCoord?: number
    normalTexCoord?: number
    emissiveTexCoord?: number
  }>,
) => {
  const _pbrBuffer = new ArrayBuffer(64)
  const buffer = device.createBuffer({
    size: _pbrBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  createEffect(
    () => {
      const ops = access(options)
      return {
        albedo: ops?.albedo ? new Vec3(ops.albedo) : Vec3.fromValues(1, 1, 1),
        alpha: ops?.alpha ?? 1,
        metallic: ops?.metallic ?? 0,
        roughness: ops?.roughness ?? 0.5,
        occlusion: ops?.occlusion ?? 1.0,
        occlusionStrength: ops?.occlusionStrength ?? 1,
        normalScale: ops?.normalScale ?? 1,
        emissive: ops?.emissive ? new Vec3(ops.emissive) : Vec3.fromValues(0, 0, 0),
        hasAlbedoTexture: !!(ops?.albedoTexture || ops?.albedoTextureSource),
        hasOrmTexture: !!(ops?.occlusionRoughnessMetallicTexture || ops?.occlusionRoughnessMetallicTextureSource),
        hasOcclusionTexture: !!(ops?.occlusionTexture || ops?.occlusionTextureSource),
        hasNormalTexture: !!ops?.normalTextureSource,
        hasEmissiveTexture: !!(ops?.emissiveTexture || ops?.emissiveTextureSource),
        alphaMode: ops?.alphaMode,
        alphaCutoff: ops?.alphaCutoff ?? 0.5,
        doubleSided: ops?.doubleSided ?? false,
      }
    },
    ops => {
      new Vec3(_pbrBuffer).copy(ops.albedo)
      const pbrParamsValue = new Float32Array(_pbrBuffer, 12, 4)
      pbrParamsValue[0] = ops.alpha
      pbrParamsValue[1] = ops.metallic
      pbrParamsValue[2] = ops.roughness
      pbrParamsValue[3] = ops.occlusion
      const pbrFlag = new Uint32Array(_pbrBuffer, 28, 1)
      pbrFlag[0] = setBitOfValue(pbrFlag[0], 0, ops.hasAlbedoTexture)
      pbrFlag[0] = setBitOfValue(pbrFlag[0], 1, ops.hasOrmTexture)
      pbrFlag[0] = setBitOfValue(pbrFlag[0], 2, ops.alphaMode === 'MASK')
      pbrFlag[0] = setBitOfValue(pbrFlag[0], 3, ops.hasEmissiveTexture)
      pbrFlag[0] = setBitOfValue(pbrFlag[0], 4, ops.hasOcclusionTexture)
      pbrFlag[0] = setBitOfValue(pbrFlag[0], 5, ops.hasNormalTexture)
      pbrFlag[0] = setBitOfValue(pbrFlag[0], 6, ops.doubleSided)
      new Float32Array(_pbrBuffer, 32, 1)[0] = ops.alphaCutoff
      new Float32Array(_pbrBuffer, 36, 1)[0] = ops.occlusionStrength
      new Float32Array(_pbrBuffer, 40, 1)[0] = ops.normalScale
      new Vec3(_pbrBuffer, 48).copy(ops.emissive)

      device.queue.writeBuffer(buffer, 0, _pbrBuffer)
    },
  )

  const { buffer: base, update: updateBase } = createUniformBufferBase()
  const { buffer: punctualLights, update: updatePunctualLights } = createUniformBufferPunctualLights()

  const albedoTexture = createMemo(() => {
    const ops = access(options ?? {})
    const _albedoTextureSource = ops.albedoTextureSource
    const _albedoTexture = ops.albedoTexture
    if (_albedoTexture) {
      return _albedoTexture
    } else if (_albedoTextureSource) {
      return createTextureFromImage({ format: ops.albedoTextureFormat ?? 'rgba8unorm-srgb' }, _albedoTextureSource)()
    } else {
      return defaultTexture
    }
  })

  const ormTexture = createMemo(() => {
    const ops = access(options ?? {})
    const _ormTextureSource = ops.occlusionRoughnessMetallicTextureSource
    const _ormTexture = ops.occlusionRoughnessMetallicTexture
    if (_ormTexture) {
      return _ormTexture
    } else if (_ormTextureSource) {
      return createTextureFromImage({ format: 'rgba8unorm' }, _ormTextureSource)()
    } else {
      return defaultTexture
    }
  })

  const occlusionTexture = createMemo(() => {
    const ops = access(options ?? {})
    if (ops.occlusionTexture) return ops.occlusionTexture
    if (ops.occlusionTextureSource)
      return createTextureFromImage({ format: 'rgba8unorm' }, ops.occlusionTextureSource)()
    return defaultTexture
  })

  const emissiveTexture = createMemo(() => {
    const ops = access(options ?? {})
    if (ops.emissiveTexture) return ops.emissiveTexture
    if (ops.emissiveTextureSource)
      return createTextureFromImage({ format: 'rgba8unorm-srgb' }, ops.emissiveTextureSource)()
    return defaultTexture
  })

  const normalTexture = createMemo(() => {
    const source = access(options ?? {}).normalTextureSource
    return source ? createTextureFromImage({ format: 'rgba8unorm' }, source)() : defaultTexture
  })

  const albedoSampler = createSampler(() => access(options ?? {}).albedoSampler ?? {})
  const ormSampler = createSampler(() => access(options ?? {}).ormSampler ?? {})
  const occlusionSampler = createSampler(() => access(options ?? {}).occlusionTextureSampler ?? {})
  const emissiveSampler = createSampler(() => access(options ?? {}).emissiveSampler ?? {})
  const normalSampler = createSampler(() => access(options ?? {}).normalSampler ?? {})

  const uniforms = () => [
    base,
    buffer,
    albedoTexture(),
    ormTexture(),
    occlusionTexture(),
    normalTexture(),
    emissiveTexture(),
    albedoSampler(),
    ormSampler(),
    occlusionSampler(),
    normalSampler(),
    emissiveSampler(),
    punctualLights,
  ]

  const shaderCode = createMemo(() => {
    const ops = access(options ?? {})
    const uv = (set: number | undefined) => `input.uv_${set ?? 0}`
    return pbrShaderCode
      .replaceAll('__BASE_COLOR_UV__', uv(ops.baseColorTexCoord))
      .replaceAll('__METALLIC_ROUGHNESS_UV__', uv(ops.metallicRoughnessTexCoord))
      .replaceAll('__OCCLUSION_UV__', uv(ops.occlusionTexCoord))
      .replaceAll('__NORMAL_UV__', uv(ops.normalTexCoord))
      .replaceAll('__EMISSIVE_UV__', uv(ops.emissiveTexCoord))
  })
  return createMaterial(
    shaderCode,
    uniforms,
    v => {
      updateBase(v)
      updatePunctualLights(v)
    },
    () => ({
      alphaMode: access(options ?? {}).alphaMode,
      alphaCutoff: access(options ?? {}).alphaCutoff,
      doubleSided: access(options ?? {}).doubleSided,
      supportsVertexColor: true,
    }),
  )
}

const defaultBitmap = await imageBitmapFromImageUrl(white1pxBase64)
export let defaultTexture: ReturnType<ReturnType<typeof createTextureFromImage>>
export let defaultMaterial: ReturnType<ReturnType<typeof createUnlitMaterial>>
createRoot(() => {
  defaultTexture = createTextureFromImage({ format: 'rgba8unorm' }, defaultBitmap)()
  defaultMaterial = createUnlitMaterial({ albedo: [0.5, 0.5, 0.5] })()
})
