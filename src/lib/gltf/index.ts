import { GlTF } from '../../generated/glTF'
import { Object3D } from '../object3d'
import { cached } from '../utils'
import { getNode } from './get_node'
import { parseGLB } from './parse_glb'
import { LoaderContext } from './types'

const relativeURL = (base: string, target: string) => {
  if (base.lastIndexOf('/') !== -1) {
    return base.slice(0, base.lastIndexOf('/')) + '/' + target
  } else {
    return target
  }
}

export const loadGLTF = async (url: string) => {
  let json: GlTF
  let buffers: ArrayBuffer[]

  const cacheMap = new Map<string, unknown>()

  if (/\.gltf$/.test(url)) {
    json = (await fetch(url).then(res => res.json())) as GlTF
    if (!json.buffers) {
      throw new Error('no buffer specified in gltf file')
    }
    buffers = await Promise.all(
      json.buffers.map(buffer => {
        if (!buffer.uri) {
          throw new Error('buffer.uri not specified')
        }
        const binURL = relativeURL(url, buffer.uri)
        return fetch(binURL).then(res => res.arrayBuffer())
      })
    )
  } else if (/\.glb$/.test(url)) {
    const r = await parseGLB(url)
    json = r[0]
    buffers = r[1]
  } else {
    throw new Error('file suffix not support')
  }

  const context: LoaderContext = {
    json,
    buffers,
    _cached: <T>(
      k: string,
      onCreate: () => T,
      options?: {
        stale?: (old: T) => boolean
      }
    ): T => {
      return cached(k, onCreate, {
        ...options,
        cacheMap: cacheMap as Map<string, T>
      })
    }
  }

  const _node = (i: number) => context._cached(`node_${i}`, () => getNode(i, context))

  const scenes = await Promise.all(
    json.scenes?.map(async scene => {
      const obj = new Object3D()
      const nodes = await Promise.all(scene.nodes?.map(async nodeIndex => _node(nodeIndex)) ?? [])
      obj.add(...nodes)
      return obj
    }) ?? []
  )

  return { json, scenes }
}
