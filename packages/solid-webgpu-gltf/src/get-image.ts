import { imageBitmapFromImageUrl } from 'solid-webgpu'
import type { LoaderContext } from './types'

export const getImage = async (index: number, context: LoaderContext) => {
  const { json, buffers } = context
  const image = json.images?.[index]
  if (!image) {
    throw new Error(`Image ${index} not found in glTF`)
  }
  if (image.uri && image.bufferView !== undefined)
    throw new Error(`Image ${index} must define either uri or bufferView`)
  if (image.uri) {
    return imageBitmapFromImageUrl(new URL(image.uri, context.baseUrl).href)
  } else if (image.bufferView !== undefined) {
    const bufferView = json.bufferViews?.[image.bufferView]
    if (!bufferView) {
      throw new Error('gltf bufferView not found')
    }
    const buffer = buffers[bufferView.buffer]
    if (!buffer) throw new Error(`Image ${index} references a missing buffer`)
    const byteOffset = bufferView.byteOffset ?? 0
    if (byteOffset + bufferView.byteLength > buffer.byteLength) throw new Error(`Image ${index} exceeds its buffer`)
    if (!image.mimeType) throw new Error(`Image ${index} in a bufferView has no mimeType`)
    const bufferData = buffer.slice(byteOffset, byteOffset + bufferView.byteLength)
    return createImageBitmap(new Blob([bufferData], { type: image.mimeType }), { imageOrientation: 'flipY' })
  } else {
    throw new Error(`Image ${index} has neither uri nor bufferView`)
  }
}
