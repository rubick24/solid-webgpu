import { For } from 'solid-js'
import { Object3D } from 'solid-webgpu'
import type { GlTF } from './generated/glTF'
import { getAnimations } from './get-animations'
import { getNode } from './get-node'
import { parseGLBData } from './parse-glb'
import type { LoaderContext } from './types'
import { createWithCache } from './utils'

export type { AnimationPlayback, GLTFAnimation } from './get-animations'

const fetchBuffer = async (uri: string, baseUrl: string) => {
  const response = await fetch(new URL(uri, baseUrl))
  if (!response.ok) throw new Error(`Failed to load glTF resource (${response.status}): ${uri}`)
  return response.arrayBuffer()
}

export const loadGLTF = async (url: string) => {
  const baseUrl = typeof document === 'undefined' ? url : new URL(url, document.baseURI).href
  let json: GlTF
  let buffers: ArrayBuffer[]
  let binaryChunks: ArrayBuffer[] = []

  const cacheMap = new Map<string, unknown>()

  const response = await fetch(baseUrl)
  if (!response.ok) throw new Error(`Failed to load glTF (${response.status}): ${url}`)
  const bytes = await response.arrayBuffer()
  if (url.split(/[?#]/, 1)[0].toLowerCase().endsWith('.glb')) {
    ;[json, binaryChunks] = parseGLBData(bytes)
    buffers = await Promise.all(
      (json.buffers ?? []).map((buffer, index) => {
        if (buffer.uri) return fetchBuffer(buffer.uri, baseUrl)
        if (index === 0 && binaryChunks[0]) return binaryChunks[0]
        throw new Error(`GLB buffer ${index} has no URI or BIN chunk`)
      }),
    )
  } else if (url.split(/[?#]/, 1)[0].toLowerCase().endsWith('.gltf')) {
    json = JSON.parse(new TextDecoder().decode(bytes)) as GlTF
    buffers = await Promise.all(
      (json.buffers ?? []).map((buffer, index) => {
        if (buffer.uri) return fetchBuffer(buffer.uri, baseUrl)
        throw new Error(`Buffer ${index} has no URI`)
      }),
    )
  } else {
    throw new Error('glTF URL must end in .gltf or .glb')
  }

  const version = /^(\d+)\.(\d+)$/.exec(json.asset?.version ?? '')
  if (!version || Number(version[1]) !== 2) throw new Error(`Unsupported glTF asset version: ${json.asset?.version}`)
  const minVersion = /^(\d+)\.(\d+)$/.exec(json.asset.minVersion ?? '2.0')
  if (!minVersion) throw new Error(`Invalid glTF minVersion: ${json.asset.minVersion}`)
  const minMajor = Number(minVersion[1])
  const minMinor = Number(minVersion[2])
  if (minMajor > 2 || (minMajor === 2 && minMinor > 0)) {
    throw new Error(`This loader does not support required glTF version ${json.asset.minVersion}`)
  }
  const supportedExtensions = new Set(['KHR_materials_unlit', 'KHR_lights_punctual'])
  const unsupported = (json.extensionsRequired ?? []).filter(name => !supportedExtensions.has(name))
  if (unsupported.length) throw new Error(`Required glTF extensions are not supported: ${unsupported.join(', ')}`)

  const nodes = json.nodes ?? []
  const parents = new Int32Array(nodes.length).fill(-1)
  nodes.forEach((node, index) => {
    if (node.matrix && (node.translation || node.rotation || node.scale)) {
      throw new Error(`Node ${index} cannot define both matrix and TRS transforms`)
    }
    for (const child of node.children ?? []) {
      if (!Number.isInteger(child) || !nodes[child]) throw new Error(`Node ${index} references missing child ${child}`)
      if (parents[child] !== -1) throw new Error(`Node ${child} has multiple parents`)
      parents[child] = index
    }
  })
  const visited = new Uint8Array(nodes.length)
  const visit = (index: number) => {
    if (visited[index] === 1) throw new Error(`Node hierarchy contains a cycle at node ${index}`)
    if (visited[index] === 2) return
    visited[index] = 1
    for (const child of nodes[index].children ?? []) visit(child)
    visited[index] = 2
  }
  nodes.forEach((_, index) => {
    visit(index)
  })
  json.scenes?.forEach((scene, sceneIndex) => {
    for (const node of scene.nodes ?? []) {
      if (!nodes[node]) throw new Error(`Scene ${sceneIndex} references missing node ${node}`)
      if (parents[node] !== -1) throw new Error(`Scene ${sceneIndex} node ${node} is not a root node`)
    }
  })
  if (json.scene !== undefined && !json.scenes?.[json.scene])
    throw new Error(`Default scene ${json.scene} does not exist`)

  for (let i = 0; i < (json.buffers?.length ?? 0); i++) {
    if (!buffers[i] || buffers[i].byteLength < json.buffers![i].byteLength) {
      throw new Error(`Buffer ${i} is missing or shorter than its declared byteLength`)
    }
  }

  const withCache = createWithCache(cacheMap)

  const context: LoaderContext = {
    json,
    buffers,
    baseUrl,
    withCache,
    nodeRefs: new Map(),
    nodeWeights: new Map(),
  }

  json.nodes?.forEach((node, index) => {
    if (node.mesh === undefined) return
    const mesh = json.meshes?.[node.mesh]
    if (!mesh) throw new Error(`Node ${index} references a missing mesh`)
    const targetCount = mesh.primitives[0]?.targets?.length ?? 0
    if (mesh.primitives.some(primitive => (primitive.targets?.length ?? 0) !== targetCount)) {
      throw new Error(`Mesh ${node.mesh} primitives have different morph target counts`)
    }
    const initialWeights = node.weights ?? mesh.weights ?? Array.from({ length: targetCount }, () => 0)
    if (initialWeights.length !== targetCount)
      throw new Error(`Node ${index} morph weight count does not match its mesh`)
    context.nodeWeights.set(index, { value: Float32Array.from(initialWeights), count: initialWeights.length })
  })

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
    }) ?? [],
  )

  const animations = getAnimations(context)
  return { json, scenes, defaultScene: scenes[json.scene ?? 0], buffers, animations }
}
