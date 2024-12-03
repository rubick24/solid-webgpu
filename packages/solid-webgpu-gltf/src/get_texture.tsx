// import { textureFromImageData } from 'core'
import { getImage } from './get_image'
import { LoaderContext } from './types'

export const getTexture = async (textureIndex: number, context: LoaderContext) => {
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

  const image = await context.withCache(`image_${json.source}`, () => getImage(json.source!, context))

  return image
  // const Tex = () => <Texture image={image} descriptor={{ size: { width: image.width, height: image.height } }} />
  // return Tex
}
