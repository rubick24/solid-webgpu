import { For } from 'solid-js'
import { Object3D } from 'solid-webgpu'
import { GlTF } from './generated/glTF'
import { getNode } from './get-node'
import { parseGLB } from './parse-glb'
import { LoaderContext } from './types'
import { createWithCache } from './utils'

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

  const withCache = createWithCache(cacheMap)

  const context: LoaderContext = {
    json,
    buffers,
    withCache
  }

  const _node = (i: number) => context.withCache(`node_${i}`, () => getNode(i, context))

  const scenes = await Promise.all(
    json.scenes?.map(async scene => {
      const nodes = await Promise.all(scene.nodes?.map(async nodeIndex => _node(nodeIndex)) ?? [])

      const Scene = () => (
        <Object3D>
          <For each={nodes}>{ChildNode => <ChildNode />}</For>
        </Object3D>
      )
      return Scene
    }) ?? []
  )

  return { json, scenes }
}
