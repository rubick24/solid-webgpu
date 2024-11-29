import { batch, createEffect, JSX, onCleanup, untrack } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { GeometryContextProvider, useGeometryContext, useMeshContext, useSceneContext } from './context'
import { CommonNodeProps, CommonNodeRef, createNodeContext, NodeExtra } from './object3d'
import { GeometryContext, IndexBufferContext, StoreContext, TypedArray, VertexBufferContext } from './types'
import { createBuffer } from './utils'

export type GeometryExtra = NodeExtra & {
  geometry: GeometryContext
}
type GeometryRefExtra = {
  geometry: StoreContext<GeometryContext>
}
export type GeometryRef = CommonNodeRef<GeometryRefExtra>
export type GeometryProps = CommonNodeProps<GeometryRefExtra> & {
  vertexBuffers: JSX.Element
  indexBuffer: JSX.Element
}

export const Geometry = (props: GeometryProps) => {
  const { ref, Provider } = createNodeContext(['Geometry'], props)
  const [scene, setScene] = useSceneContext()

  const id = ref.node[0].id
  setScene(
    'nodes',
    id,
    produce(v => {
      v.geometry = {
        vertexBuffers: [],
        topology: 'triangle-list',
        instanceCount: 1,
        drawRange: { start: 0, count: Infinity }
      } satisfies GeometryContext
    })
  )

  const [store, setStore] = createStore<GeometryContext>((scene.nodes[id] as GeometryExtra).geometry)

  const cRef = { ...ref, geometry: [store, setStore] satisfies StoreContext<GeometryContext> }
  props.ref?.(cRef)

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

export type VertexBufferExtra = NodeExtra & { vertexBuffer: VertexBufferContext }
type VertexBufferRefExtra = {
  vertexBuffer: StoreContext<VertexBufferContext>
}
export type VertexBufferRef = CommonNodeRef<VertexBufferRefExtra>
export type VertexBufferProps = CommonNodeProps<VertexBufferRefExtra> & {
  attribute?: {
    name: string
    type: string
  }
  layout: GPUVertexBufferLayout
  value: TypedArray
}
export const VertexBuffer = (props: VertexBufferProps) => {
  const { ref } = createNodeContext(['VertexBuffer'], props)

  const [scene, setScene] = useSceneContext()
  const id = ref.node[0].id
  setScene(
    'nodes',
    id,
    produce(v => {
      v.vertexBuffer = {
        layout: untrack(() => props.layout),
        value: untrack(() => props.value)
      } satisfies VertexBufferContext
    })
  )

  const [store, setStore] = createStore<VertexBufferContext>((scene.nodes[id] as VertexBufferExtra).vertexBuffer)

  createEffect(() => setStore('attribute', props.attribute))
  createEffect(() => setStore('layout', props.layout))

  createEffect(() => {
    const { device } = scene
    const data = props.value
    const buffer = createBuffer({ device, data, usage: GPUBufferUsage.VERTEX })
    batch(() => {
      setStore('value', data)
      setStore('buffer', buffer)
    })

    onCleanup(() => buffer.destroy())
  })

  const cRef = { ...ref, vertexBuffer: [store, setStore] satisfies StoreContext<VertexBufferContext> }
  props.ref?.(cRef)

  const [_, setG] = useGeometryContext()
  setG('vertexBuffers', v => v.concat(id))

  return null
}

export type IndexBufferExtra = NodeExtra & {
  indexBuffer: IndexBufferContext
}
type IndexBufferRefExtra = {
  indexBuffer: StoreContext<IndexBufferContext>
}
export type IndexBufferRef = CommonNodeRef<IndexBufferRefExtra>
export type IndexBufferProps = CommonNodeProps<IndexBufferRefExtra> & {
  value: TypedArray
}
export const IndexBuffer = (props: IndexBufferProps) => {
  const { ref } = createNodeContext(['IndexBuffer'], props)
  const [scene, setScene] = useSceneContext()
  const id = ref.node[0].id
  setScene(
    'nodes',
    id,
    produce(v => {
      v.indexBuffer = { value: untrack(() => props.value) } satisfies IndexBufferContext
    })
  )
  const [store, setStore] = createStore<IndexBufferContext>((scene.nodes[id] as IndexBufferExtra).indexBuffer)

  createEffect(() => {
    const { device } = scene
    const data = props.value
    const buffer = createBuffer({ device, data, usage: GPUBufferUsage.INDEX })

    batch(() => {
      setStore('value', data)
      setStore('buffer', buffer)
    })

    onCleanup(() => buffer.destroy())
  })

  const cRef = { ...ref, indexBuffer: [store, setStore] satisfies StoreContext<IndexBufferContext> }
  props.ref?.(cRef)
  const [_, setG] = useGeometryContext()
  setG('indexBuffer', id)

  return null
}
