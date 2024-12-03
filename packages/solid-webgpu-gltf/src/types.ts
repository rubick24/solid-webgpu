import type { GlTF } from './generated/glTF'
import type { WithCache } from './utils'

export type LoaderContext = {
  json: GlTF
  buffers: ArrayBuffer[]
  withCache: WithCache
}
