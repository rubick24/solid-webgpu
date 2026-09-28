import { createPBRMaterial, createUnlitMaterial, Vec3 } from 'solid-webgpu'
import type { Material } from './generated/glTF'
import { getTexture } from './get-texture'
import type { LoaderContext } from './types'

const color3 = (value: number[] | undefined, fallback: [number, number, number]) =>
  value ? Vec3.fromValues(value[0], value[1], value[2]) : Vec3.fromValues(...fallback)

export const getMaterial = async (index: number | undefined, context: LoaderContext) => {
  const material: Material = index === undefined ? {} : (context.json.materials?.[index] as Material)
  if (!material) throw new Error(`Material ${index} not found`)
  const mr = material.pbrMetallicRoughness
  const isUnlit = !!(material.extensions && 'KHR_materials_unlit' in material.extensions)
  const texture = (i: number | undefined) =>
    i === undefined ? undefined : context.withCache(`texture_${i}`, () => getTexture(i, context))

  const baseColor = mr?.baseColorFactor
  const baseColorTexture = mr?.baseColorTexture?.index
  const alphaMode = material.alphaMode ?? 'OPAQUE'
  if (!['OPAQUE', 'MASK', 'BLEND'].includes(alphaMode)) throw new Error(`Unsupported alphaMode: ${alphaMode}`)

  if (isUnlit) {
    const baseTexture = await texture(baseColorTexture)
    return () =>
      createUnlitMaterial({
        albedo: color3(baseColor?.slice(0, 3), [1, 1, 1]),
        alpha: baseColor?.[3] ?? 1,
        albedoTextureSource: baseTexture?.image,
        albedoSampler: baseTexture?.sampler,
        albedoTextureFormat: 'rgba8unorm-srgb',
        alphaMode: alphaMode as 'OPAQUE' | 'MASK' | 'BLEND',
        alphaCutoff: material.alphaCutoff ?? 0.5,
        doubleSided: material.doubleSided ?? false,
        albedoTexCoord: mr?.baseColorTexture?.texCoord ?? 0,
      })
  }

  const [baseTexture, ormTexture, occlusionTexture, emissiveTexture, normalTexture] = await Promise.all([
    texture(baseColorTexture),
    texture(mr?.metallicRoughnessTexture?.index),
    texture(material.occlusionTexture?.index),
    texture(material.emissiveTexture?.index),
    texture(material.normalTexture?.index),
  ])

  return () =>
    createPBRMaterial({
      albedo: color3(baseColor?.slice(0, 3), [1, 1, 1]),
      alpha: baseColor?.[3] ?? 1,
      metallic: mr?.metallicFactor ?? 1,
      roughness: mr?.roughnessFactor ?? 1,
      albedoTextureSource: baseTexture?.image,
      albedoTextureFormat: 'rgba8unorm-srgb',
      albedoSampler: baseTexture?.sampler,
      occlusionRoughnessMetallicTextureSource: ormTexture?.image,
      ormSampler: ormTexture?.sampler,
      occlusionTextureSource: occlusionTexture?.image,
      occlusionTextureSampler: occlusionTexture?.sampler,
      occlusionStrength: material.occlusionTexture?.strength ?? 1,
      emissive: color3(material.emissiveFactor, [0, 0, 0]),
      emissiveTextureSource: emissiveTexture?.image,
      emissiveSampler: emissiveTexture?.sampler,
      baseColorTexCoord: mr?.baseColorTexture?.texCoord ?? 0,
      metallicRoughnessTexCoord: mr?.metallicRoughnessTexture?.texCoord ?? 0,
      normalTexCoord: material.normalTexture?.texCoord ?? 0,
      occlusionTexCoord: material.occlusionTexture?.texCoord ?? 0,
      emissiveTexCoord: material.emissiveTexture?.texCoord ?? 0,
      normalTextureSource: normalTexture?.image,
      normalSampler: normalTexture?.sampler,
      normalScale: material.normalTexture?.scale ?? 1,
      alphaMode: alphaMode as 'OPAQUE' | 'MASK' | 'BLEND',
      alphaCutoff: material.alphaCutoff ?? 0.5,
      doubleSided: material.doubleSided ?? false,
    })
}
