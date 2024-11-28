import { createEffect, JSX, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import { GeometryContextProvider, useMeshContext } from './context'
import { CommonNodeProps, CommonNodeRef, createNodeContext } from './object3d'
import { GeometryContext, IndexBufferContext, StoreContext, TypedArray, VertexBufferContext } from './types'

type GeometryRefExtra = {
  geometry: StoreContext<GeometryContext>
}
export type GeometryRef = CommonNodeRef<GeometryRefExtra>
export type GeometryProps = CommonNodeProps<GeometryRefExtra> & {
  vertexBuffers: JSX.Element
  indexBuffer: JSX.Element
}

export const Geometry = (props: GeometryProps) => {
  const { ref: _ref, Provider } = createNodeContext(['Geometry'], props)
  const [store, setStore] = createStore<GeometryContext>({
    vertexBuffers: [],
    topology: 'triangle-list',
    instanceCount: 1,
    drawRange: { start: 0, count: Infinity }
  })

  const ref = { ..._ref, geometry: [store, setStore] satisfies StoreContext<GeometryContext> }
  props.ref?.(ref)

  const [_, setMesh] = useMeshContext()

  setMesh('geometry', ref)

  return (
    <Provider>
      <GeometryContextProvider value={[store, setStore]}>
        {props.vertexBuffers}
        {props.indexBuffer}
      </GeometryContextProvider>
    </Provider>
  )
}

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
  buffer: TypedArray
}
export const VertexBuffer = (props: VertexBufferProps) => {
  const { ref: _ref } = createNodeContext(['VertexBuffer'], props)
  const [store, setStore] = createStore<VertexBufferContext>({
    layout: untrack(() => props.layout),
    buffer: untrack(() => props.buffer)
  })

  createEffect(() => setStore('attribute', props.attribute))
  createEffect(() => setStore('layout', props.layout))
  createEffect(() => setStore('buffer', props.buffer))

  const ref = { ..._ref, vertexBuffer: [store, setStore] satisfies StoreContext<VertexBufferContext> }
  props.ref?.(ref)

  return null
}

type IndexBufferRefExtra = {
  indexBuffer: StoreContext<IndexBufferContext>
}
export type IndexBufferRef = CommonNodeRef<IndexBufferRefExtra>
export type IndexBufferProps = CommonNodeProps<IndexBufferRefExtra> & {
  buffer: TypedArray
}
export const IndexBuffer = (props: IndexBufferProps) => {
  const { ref: _ref } = createNodeContext(['IndexBuffer'], props)
  const [store, setStore] = createStore<IndexBufferContext>({
    buffer: untrack(() => props.buffer)
  })

  createEffect(() => setStore('buffer', props.buffer))

  const ref = { ..._ref, indexBuffer: [store, setStore] satisfies StoreContext<IndexBufferContext> }
  props.ref?.(ref)

  return null
}
