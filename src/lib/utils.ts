import { Texture } from './material'

export const clamp = (min: number, max: number, v: number) => {
  return Math.max(min, Math.min(max, v))
}

export const imageBitmapFromImageUrl = async (url: string) => {
  const response = await fetch(url)
  const blob = await response.blob()
  return createImageBitmap(blob)
}

export const textureFromImageData = (source: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas) => {
  return {
    type: 'texture',
    image: source,
    descriptor: {
      size: { width: source.width, height: source.height }
    }
  } as Texture
}

export const textureFromUrl = async (url: string) => {
  const imgBitmap = await imageBitmapFromImageUrl(url)
  return textureFromImageData(imgBitmap)
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

// export const observable = <T extends object>(
//   obj: T,
//   callback: (
//     v:
//       | { action: 'set'; path: string; newValue: unknown; previousValue: unknown }
//       | {
//           action: 'delete'
//           path: string
//         }
//   ) => void,
//   tree: string[] = []
// ) => {
//   const getPath = (prop: string) => tree.concat(prop).join('.')

//   return new Proxy(obj, {
//     get(target, p: string, receiver) {
//       const value = Reflect.get(target, p, receiver)

//       if (value && typeof value === 'object' && ['Array', 'Object'].includes(value.constructor.name))
//         return observable<typeof value>(value, callback, tree.concat(p))

//       return value
//     },

//     set(target, p: string, value, receiver) {
//       callback({
//         action: 'set',
//         path: getPath(p),
//         newValue: value,
//         previousValue: Reflect.get(target, p, receiver)
//       })
//       return Reflect.set(target, p, value, receiver)
//     },

//     deleteProperty(target, p: string) {
//       callback({ action: 'delete', path: getPath(p) })
//       return Reflect.deleteProperty(target, p)
//     }
//   })
// }

export class MultipleKeyWeakMap<V> {
  wm: WeakMap<WeakKey, V | WeakMap<WeakKey, V>> = new WeakMap()

  set(keys: WeakKey[], value: V) {
    let current = this.wm
    for (let i = 0; i < keys.length - 1; i++) {
      const ki = keys[i]
      if (!current.has(ki)) {
        current.set(keys[i], new WeakMap<WeakKey, V>())
      }
      current = current.get(keys[i]) as WeakMap<WeakKey, V>
    }
    current.set(keys[keys.length - 1], value)
  }

  get(keys: WeakKey[]) {
    let current = this.wm
    for (let key of keys) {
      if (!current?.has(key)) {
        return undefined
      }
      current = current.get(key) as WeakMap<object, V>
    }
    return current as V
  }
}

let _weakCacheMap = new MultipleKeyWeakMap()
export const weakCached = <V>(
  keys: WeakKey[],
  onCreate: () => V,

  options?: {
    cacheMap?: MultipleKeyWeakMap<V>
    /**
     * check if old value stale, can also add dispose call for old value here
     */
    stale?: (old: V) => boolean
  }
): V => {
  const cacheMap = options?.cacheMap ?? _weakCacheMap
  let target = cacheMap.get(keys) as V | undefined
  if (target === undefined || options?.stale?.(target)) {
    target = onCreate()
    cacheMap.set(keys, target)
  }
  return target
}

let _cacheMap = new Map()
export const cached = <V>(
  k: string,
  onCreate: () => V,
  options?: {
    cacheMap?: Map<string, V>
    /**
     * check if old value stale, can also add dispose call for old value here
     */
    stale?: (old: V) => boolean
  }
): V => {
  let cacheMap = options?.cacheMap ?? (_cacheMap as Map<string, V>)
  let target = cacheMap.get(k)
  if (target === undefined || options?.stale?.(target)) {
    target = onCreate()
    cacheMap.set(k, target)
  }
  return target
}

export const setBitOfValue = (val: number, offset: number, bit: boolean) => {
  const mask = 1 << offset
  return (val = bit ? val | mask : val & ~mask)
}
