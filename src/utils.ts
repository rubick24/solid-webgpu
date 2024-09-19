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

/**
 * A collection of disposable objects and their GPU resource.
 */
export class Collection<K extends object, V> extends WeakMap<K, V> {
  set<T extends K & { dispose?: never }>(object: T, compiled: V): this
  set<T extends K & { dispose(): void }>(object: T, compiled: V, dispose: () => void): this
  set(object: K, compiled: V, dispose?: () => void): this {
    if ('dispose' in object && typeof object.dispose === 'function') {
      const prevDispose = object.dispose.bind(object)
      object.dispose = () => {
        dispose?.()
        prevDispose()
        this.delete(object)
      }
    }
    return super.set(object, compiled)
  }
}
