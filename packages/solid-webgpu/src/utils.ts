import { Accessor } from 'solid-js'
import { MaybeAccessor, MaybeAccessorValue } from './types'

// export const createWithCache = (cache: Map<string, unknown>) => {
//   return <T>(key: string, fn: () => T, options?: { stale?: (old: T) => boolean }) => {
//     let c = cache.get(key) as T | undefined
//     if (c !== undefined && !options?.stale?.(c)) {
//       return c
//     }
//     c = fn()
//     cache.set(key, c)
//     return c as T
//   }
// }

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

export const access = <T extends MaybeAccessor<any>>(v: T): MaybeAccessorValue<T> =>
  typeof v === 'function' && !v.length ? v() : v

export const isAccessor = <T>(v: MaybeAccessor<T>): v is Accessor<T> => typeof v === 'function' && !v.length
