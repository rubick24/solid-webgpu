import { imageBitmapFromImageUrl } from '../utils'
import { LoaderContext } from './types'

export const getImage = async (index: number, context: LoaderContext) => {
  const { json, buffers } = context
  const image = json.images?.[index]
  if (!image) {
    throw new Error(`image ${index} not fount in gltf`)
  }
  if (image.uri) {
    return imageBitmapFromImageUrl(image.uri)
  } else if (image.bufferView !== undefined) {
    const bufferView = json.bufferViews?.[image.bufferView]
    if (!bufferView) {
      throw new Error('gltf bufferView not found')
    }
    const byteOffset = bufferView.byteOffset || 0
    const bufferData = buffers[bufferView.buffer].slice(byteOffset, byteOffset + bufferView.byteLength)
    const blob = new Blob([bufferData], { type: image.mimeType })
    const url = URL.createObjectURL(blob)
    return imageBitmapFromImageUrl(url)
  } else {
    throw new Error('gltf neither image.uri or image.bufferView specified')
  }
}
