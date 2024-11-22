export const createWithCache = (cache: Map<string, unknown>) => {
  return <T>(key: string, fn: () => T) => {
    let c = cache.get(key)
    if (c !== undefined) {
      return c as T
    }
    c = fn()
    cache.set(key, c)
    return c as T
  }
}

export const clamp = (min: number, max: number, v: number) => {
  return Math.max(min, Math.min(max, v))
}

export const imageBitmapFromImageUrl = async (url: string) => {
  const response = await fetch(url)
  const blob = await response.blob()
  return createImageBitmap(blob)
}

// export const textureFromImageData = (source: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas) => {
//   return {
//     type: 'texture',
//     image: source,
//     descriptor: {
//       size: { width: source.width, height: source.height }
//     }
//   } as Texture
// }

// export const textureFromUrl = async (url: string) => {
//   const imgBitmap = await imageBitmapFromImageUrl(url)
//   return textureFromImageData(imgBitmap)
// }

export const white1pxBase64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='

export type Optional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>

export type Updatable<T> = T & { needsUpdate?: boolean }

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
export type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor

// | HTMLVideoElement
export type ImageRepresentation =
  | ImageBitmap
  | ImageData
  | HTMLImageElement
  | VideoFrame
  | HTMLCanvasElement
  | OffscreenCanvas

export type ExternalTexture = Updatable<{
  type: 'externalTexture'
  descriptor: GPUTextureDescriptor
  video?: HTMLVideoElement
}>

// export type BuiltinUniformType = 'base' | 'punctual_lights'
// export type BuiltinUniform<T extends BuiltinUniformType = BuiltinUniformType> = { builtin_type: T }
// export type BuiltinUniformInternal<T extends BuiltinUniformType = BuiltinUniformType> = BuiltinUniform<T> &
//   {
//     base: UniformBuffer
//     punctual_lights: UniformBuffer
//   }[T]

// export type Uniform = UniformBuffer | Texture | ExternalTexture | Sampler | BuiltinUniform
// export type UniformInternal = UniformBuffer | Texture | ExternalTexture | Sampler | BuiltinUniformInternal
