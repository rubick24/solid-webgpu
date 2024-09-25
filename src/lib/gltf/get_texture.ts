import { GlTF } from '../../generated/glTF'
import { textureFromImageData } from '../utils'
import { getImage } from './get_image'

export const getTexture = async (
  textureIndex: number,
  context: {
    json: GlTF
    buffers: ArrayBuffer[]
  }
) => {
  const json = context.json.textures?.[textureIndex]
  if (!json) {
    throw new Error('gltf texture not found')
  }
  if (json.source === undefined) {
    throw new Error('gltf texture.source is undefined')
  }

  // TODO: sampler
  // const sJSON = tJSON.sampler
  //   ? Object.assign(
  //       defaultSampler,
  //       json.samplers && json.samplers.length > tJSON.sampler ? json.samplers[tJSON.sampler] : defaultSampler
  //     )
  //   : defaultSampler

  const image = await getImage(json.source, context)

  return textureFromImageData(image)
}
