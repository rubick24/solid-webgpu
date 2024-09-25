import { GlTF } from '../../generated/glTF'
import { Vec3 } from '../../math'
import { PBRMaterial } from '../pbr_material'
import { getTexture } from './get_texture'

export const defaultMaterial = new PBRMaterial()
export const getMaterial = async (index: number, context: { json: GlTF; buffers: ArrayBuffer[] }) => {
  const json = context.json.materials?.[index]
  if (!json) {
    throw new Error(`material ${index} not fount in gltf`)
  }
  if (!json.pbrMetallicRoughness) {
    throw new Error('glTFLoader: only support pbrMetallicRoughness & KHR_materials_unlit now')
  }
  const mr = json.pbrMetallicRoughness

  return new PBRMaterial({
    /**
     * TODO: handle
     * + base color alpha channel
     * + samplers
     * + json.normalTexture
     * + json.occlusionTexture (merge to occlusionRoughnessMetallicTexture?)
     * + json.emissiveTexture
     */
    albedo: mr.baseColorFactor
      ? Vec3.fromValues(...(mr.baseColorFactor?.slice(0, 3) as [number, number, number]))
      : undefined,
    metallic: mr.metallicFactor,
    roughness: mr.roughnessFactor,
    albedoTexture: mr.baseColorTexture !== undefined ? await getTexture(mr.baseColorTexture.index, context) : undefined,
    occlusionRoughnessMetallicTexture:
      mr.metallicRoughnessTexture !== undefined
        ? await getTexture(mr.metallicRoughnessTexture.index, context)
        : undefined
  })
}
