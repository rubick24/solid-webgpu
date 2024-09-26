import { GlTF } from '../../generated/glTF'

export type LoaderContext = {
  json: GlTF
  buffers: ArrayBuffer[]
  _cached: <T>(
    k: string,
    onCreate: () => T,
    options?: {
      stale?: (old: T) => boolean
    }
  ) => T
}
