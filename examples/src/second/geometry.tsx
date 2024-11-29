import { batch, createEffect, JSX, onCleanup, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import { GeometryContextProvider, useGeometryContext, useMeshContext, useSceneContext } from './context'
import { CommonNodeProps, CommonNodeRef, createNodeContext } from './object3d'
import { GeometryContext, IndexBufferContext, StoreContext, TypedArray, VertexBufferContext } from './types'
import { createBuffer } from './utils'

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
  value: TypedArray
}
export const VertexBuffer = (props: VertexBufferProps) => {
  const { ref: _ref } = createNodeContext(['VertexBuffer'], props)
  const [store, setStore] = createStore<VertexBufferContext>({
    layout: untrack(() => props.layout),
    value: untrack(() => props.value)
  })

  createEffect(() => setStore('attribute', props.attribute))
  createEffect(() => setStore('layout', props.layout))

  const [scene] = useSceneContext()
  createEffect(() => {
    const { device } = scene
    const data = props.value
    const buffer = createBuffer({ device, data, usage: GPUBufferUsage.VERTEX })
    device.queue.writeBuffer(buffer, data.byteOffset, data)
    batch(() => {
      setStore('value', data)
      setStore('buffer', buffer)
    })

    onCleanup(() => buffer.destroy())
  })

  const ref = { ..._ref, vertexBuffer: [store, setStore] satisfies StoreContext<VertexBufferContext> }
  props.ref?.(ref)

  const [_, setG] = useGeometryContext()
  setG('vertexBuffers', v => v.concat(ref))
  // setM('uniforms', v => v.concat(ref))

  return null
}

type IndexBufferRefExtra = {
  indexBuffer: StoreContext<IndexBufferContext>
}
export type IndexBufferRef = CommonNodeRef<IndexBufferRefExtra>
export type IndexBufferProps = CommonNodeProps<IndexBufferRefExtra> & {
  value: TypedArray
}
export const IndexBuffer = (props: IndexBufferProps) => {
  const { ref: _ref } = createNodeContext(['IndexBuffer'], props)
  const [store, setStore] = createStore<IndexBufferContext>({
    value: untrack(() => props.value)
  })

  const [scene] = useSceneContext()
  createEffect(() => {
    const { device } = scene
    const data = props.value
    const buffer = createBuffer({ device, data, usage: GPUBufferUsage.INDEX })
    device.queue.writeBuffer(buffer, data.byteOffset, data)

    batch(() => {
      setStore('value', data)
      setStore('buffer', buffer)
    })

    onCleanup(() => buffer.destroy())
  })

  const ref = { ..._ref, indexBuffer: [store, setStore] satisfies StoreContext<IndexBufferContext> }
  props.ref?.(ref)
  const [_, setG] = useGeometryContext()
  setG('indexBuffer', ref)

  return null
}
