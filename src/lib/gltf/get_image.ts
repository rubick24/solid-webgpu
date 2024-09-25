import { GlTF } from '../../generated/glTF'
import { imageBitmapFromImageUrl } from '../utils'

export const getImage = async (
  index: number,
  context: {
    json: GlTF
    buffers: ArrayBuffer[]
  }
) => {
  const { json, buffers } = context
  const image = json.images?.[index]
  if (!image) {
    throw new Error(`image ${index} not fount in gltf`)
  }
  if (image.uri) {
    return imageBitmapFromImageUrl(image.uri)
  } else if (image.bufferView) {
    if (!json.bufferViews || !buffers) {
      throw new Error('glTFLoader: no bufferViews or buffers')
    }
    const bufferView = json.bufferViews[image.bufferView]
    const byteOffset = bufferView.byteOffset || 0
    const bufferData = buffers[bufferView.buffer].slice(byteOffset, byteOffset + bufferView.byteLength)
    const blob = new Blob([bufferData], { type: image.mimeType })
    const url = URL.createObjectURL(blob)
    return imageBitmapFromImageUrl(url)
  } else {
    throw new Error('glTFLoader: neither image.uri or image.bufferView specified')
  }
}
