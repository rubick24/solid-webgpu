import { batch, createEffect, createSignal, JSX, onCleanup, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import { GeometryContextProvider, useGeometryContext, useMeshContext, useSceneContext } from '../context'
import { createNodeContext } from '../object3d'
import {
  GeometryContext,
  GeometryExtra,
  IndexBufferContext,
  IndexBufferExtra,
  NodeProps,
  NodeRef,
  TypedArray,
  VertexBufferContext,
  VertexBufferExtra
} from '../types'
import { createBuffer } from '../utils'

export type GeometryRef = NodeRef<GeometryContext>
export type GeometryProps = NodeProps<GeometryContext> & {
  vertexBuffers: JSX.Element
  indexBuffer: JSX.Element
}

export const Geometry = (props: GeometryProps) => {
  const {
    store: _s,
    setStore: _setS,
    Provider
  } = createNodeContext(['Geometry'], props, {
    vertexBuffers: [],
    topology: 'triangle-list',
    instanceCount: 1,
    drawRange: { start: 0, count: Infinity }
  } as GeometryExtra)
  const [scene, setScene] = useSceneContext()

  const id = _s.id

  const [store, setStore] = createStore(scene.nodes[id] as GeometryContext)

  props.ref?.(store)

  const [_, setMesh] = useMeshContext()

  setMesh('geometry', id)

  return (
    <Provider>
      <GeometryContextProvider value={[store, setStore]}>
        {props.vertexBuffers}
        {props.indexBuffer}
      </GeometryContextProvider>
    </Provider>
  )
}

export type VertexBufferRef = NodeRef<VertexBufferContext>
export type VertexBufferProps = NodeProps<VertexBufferContext> & {
  attribute?: {
    name: string
    type: string
  }
  layout: GPUVertexBufferLayout
  value: TypedArray
}
export const VertexBuffer = (props: VertexBufferProps) => {
  const val = createSignal(
    untrack(() => props.value),
    { equals: false }
  )
  const { store: _s, setStore: _setS } = createNodeContext(['VertexBuffer'], props, {
    layout: untrack(() => props.layout),
    value: val[0],
    setValue: val[1]
  } satisfies VertexBufferExtra)

  const [scene] = useSceneContext()
  const id = _s.id

  const [store, setStore] = createStore(scene.nodes[id] as VertexBufferContext)

  createEffect(() => setStore('attribute', props.attribute))
  createEffect(() => setStore('layout', props.layout))

  createEffect(() => {
    const { device } = scene
    const data = props.value
    const buffer = createBuffer({ device, data, usage: GPUBufferUsage.VERTEX })
    batch(() => {
      store.setValue(data)
      setStore('buffer', buffer)
    })

    onCleanup(() => buffer.destroy())
  })

  props.ref?.(store)

  const [_, setG] = useGeometryContext()
  setG('vertexBuffers', v => v.concat(id))

  return null
}

export type IndexBufferRef = NodeRef<IndexBufferContext>
export type IndexBufferProps = NodeProps<IndexBufferContext> & {
  value: TypedArray
}
export const IndexBuffer = (props: IndexBufferProps) => {
  const val = createSignal(
    untrack(() => props.value),
    { equals: false }
  )
  const { store: _s, setStore: _setS } = createNodeContext(['IndexBuffer'], props, {
    value: val[0],
    setValue: val[1]
  } satisfies IndexBufferExtra)
  const [scene] = useSceneContext()
  const id = _s.id

  const [store, setStore] = createStore(scene.nodes[id] as IndexBufferContext)

  createEffect(() => {
    const { device } = scene
    const data = props.value
    const buffer = createBuffer({ device, data, usage: GPUBufferUsage.INDEX })

    batch(() => {
      store.setValue(data)
      setStore('buffer', buffer)
    })

    onCleanup(() => buffer.destroy())
  })

  props.ref?.(store)
  const [_, setG] = useGeometryContext()
  setG('indexBuffer', id)

  return null
}
