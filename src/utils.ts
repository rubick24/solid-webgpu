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

export type BufferData =
  | Float32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array

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

/**
 * A collection of disposable objects and their GPU resource.
 */
// export class Collection<K extends object, V> extends WeakMap<K, V> {
//   set<T extends K & { dispose?: never }>(object: T, compiled: V): this
//   set<T extends K & { dispose(): void }>(object: T, compiled: V, dispose: () => void): this
//   set(object: K, compiled: V, dispose?: () => void): this {
//     if ('dispose' in object && typeof object.dispose === 'function') {
//       const prevDispose = object.dispose.bind(object)
//       object.dispose = () => {
//         dispose?.()
//         prevDispose()
//         this.delete(object)
//       }
//     }
//     return super.set(object, compiled)
//   }
// }
