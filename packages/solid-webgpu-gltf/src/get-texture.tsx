import { getImage } from './get-image'
import type { LoaderContext } from './types'

export const getTexture = async (textureIndex: number, context: LoaderContext) => {
  const json = context.json.textures?.[textureIndex]
  if (!json) {
    throw new Error('gltf texture not found')
  }
  if (json.source === undefined) {
    throw new Error('gltf texture.source is undefined')
  }

  const image = await context.withCache(`image_${json.source}`, () => getImage(json.source!, context))
  const sampler = json.sampler === undefined ? undefined : context.json.samplers?.[json.sampler]
  if (json.sampler !== undefined && !sampler) throw new Error(`Texture ${textureIndex} references a missing sampler`)
  const addressMode = (mode: number | undefined): GPUAddressMode =>
    (
      ({
        33071: 'clamp-to-edge',
        33648: 'mirror-repeat',
        10497: 'repeat',
      }) as Record<number, GPUAddressMode>
    )[mode ?? 10497]
  const filter = (value: number | undefined) => (value === 9728 ? ('nearest' as const) : ('linear' as const))
  const minFilter = sampler?.minFilter ?? 9729
  const mipmapFilter = minFilter === 9984 || minFilter === 9986 ? 'nearest' : 'linear'

  return {
    image,
    sampler: {
      addressModeU: addressMode(sampler?.wrapS),
      addressModeV: addressMode(sampler?.wrapT),
      magFilter: filter(sampler?.magFilter),
      minFilter: filter(
        minFilter === 9984 || minFilter === 9986
          ? 9728
          : minFilter === 9729 || minFilter === 9985 || minFilter === 9987
            ? 9729
            : minFilter,
      ),
      mipmapFilter,
    } satisfies GPUSamplerDescriptor,
  }
}
