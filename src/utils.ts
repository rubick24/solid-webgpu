export const textureFromImageData = (
  device: GPUDevice,
  source: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
) => {
  const textureDescriptor: GPUTextureDescriptor = {
    size: { width: source.width, height: source.height },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
  }
  const texture = device.createTexture(textureDescriptor)
  device.queue.copyExternalImageToTexture({ source }, { texture }, textureDescriptor.size)
  return texture
}

export const textureFromImageUrl = async (device: GPUDevice, url: string) => {
  const response = await fetch(url)
  const blob = await response.blob()
  const imgBitmap = await createImageBitmap(blob)

  return textureFromImageData(device, imgBitmap)
}
