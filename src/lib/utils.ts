import { Texture } from './material'

export const clamp = (min: number, max: number, v: number) => {
  return Math.max(min, Math.min(max, v))
}

// const gpuTextureFromImageData = (
//   device: GPUDevice,
//   source: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
// ) => {
//   const textureDescriptor: GPUTextureDescriptor = {
//     size: { width: source.width, height: source.height },
//     format: 'rgba8unorm',
//     usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
//   }
//   const texture = device.createTexture(textureDescriptor)
//   device.queue.copyExternalImageToTexture({ source }, { texture }, textureDescriptor.size)
//   return texture
// }
// const textureFromImageUrl = async (device: GPUDevice, url: string) => {
//   const imgBitmap = await imageBitmapFromImageUrl(url)
//   return gpuTextureFromImageData(device, imgBitmap)
// }

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

let _cacheMap = new WeakMap()
export const cached = <T extends WeakKey, U>(
  k: T,
  onCreate: () => U,
  options?: {
    cacheMap?: WeakMap<T, U>
    /**
     * check if old value stale, can also add dispose call for old value here
     */
    stale?: (old: U) => boolean
  }
): U => {
  let cacheMap = options?.cacheMap ?? (_cacheMap as WeakMap<T, U>)
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
