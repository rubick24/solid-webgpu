import { Accessor } from 'solid-js'

export const createWithCache = (cache: Map<string, unknown>) => {
  return <T>(key: string, fn: () => T, options?: { stale?: (old: T) => boolean }) => {
    let c = cache.get(key) as T | undefined
    if (c !== undefined && !options?.stale?.(c)) {
      return c
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

export const setBitOfValue = (val: number, offset: number, bit: boolean) => {
  const mask = 1 << offset
  return (val = bit ? val | mask : val & ~mask)
}

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

export type MaybeAccessor<T> = T | Accessor<T>
export type MaybeAccessorValue<T extends MaybeAccessor<unknown>> = T extends () => any ? ReturnType<T> : T

export const access = <T extends MaybeAccessor<any>>(v: T): MaybeAccessorValue<T> =>
  typeof v === 'function' && !v.length ? v() : v
