import type { Object3DRef } from 'solid-webgpu'
import type { GlTF } from './generated/glTF'
import type { WithCache } from './utils'

export type LoaderContext = {
  json: GlTF
  buffers: ArrayBuffer[]
  baseUrl: string
  withCache: WithCache
  nodeRefs: Map<number, Set<Object3DRef>>
  nodeWeights: Map<number, { value: Float32Array; count: number }>
}
