import { createPBRMaterial, createUnlitMaterial, Vec3 } from 'solid-webgpu'
import { getTexture } from './get-texture'
import { LoaderContext } from './types'

export const getMaterial = async (index: number, context: LoaderContext) => {
  const _texture = (i: number) => context.withCache(`texture_${i}`, () => getTexture(i, context))
  const json = context.json.materials?.[index]
  if (!json) {
    throw new Error(`material ${index} not fount in gltf`)
  }
  if (!json.pbrMetallicRoughness) {
    throw new Error('gltf: only support pbrMetallicRoughness & KHR_materials_unlit now')
  }
  const mr = json.pbrMetallicRoughness

  if (json.extensions?.KHR_materials_unlit) {
    const albedoTexture = mr.baseColorTexture !== undefined ? await _texture(mr.baseColorTexture.index) : undefined
    return () =>
      createUnlitMaterial({
        albedo: mr.baseColorFactor
          ? Vec3.fromValues(...(mr.baseColorFactor?.slice(0, 3) as [number, number, number]))
          : undefined,
        albedoTexture
      })
  }

  const albedoTexture = mr.baseColorTexture !== undefined ? await _texture(mr.baseColorTexture.index) : undefined
  const occlusionRoughnessMetallicTexture =
    mr.metallicRoughnessTexture !== undefined ? await _texture(mr.metallicRoughnessTexture.index) : undefined
  /**
   * TODO: handle
   * + base color alpha channel
   * + samplers
   * + json.normalTexture
   * + json.occlusionTexture (merge to occlusionRoughnessMetallicTexture?)
   * + json.emissiveTexture
   */

  return () =>
    createPBRMaterial({
      albedo: mr.baseColorFactor
        ? Vec3.fromValues(...(mr.baseColorFactor?.slice(0, 3) as [number, number, number]))
        : undefined,

      metallic: mr.metallicFactor,
      roughness: mr.roughnessFactor,
      albedoTexture,
      occlusionRoughnessMetallicTexture
    })
}
