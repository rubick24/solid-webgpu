import { batch, children, createEffect, createSignal, JSX, onCleanup, untrack } from 'solid-js'
import { createNodeContext, wgpuCompRender } from '../object3d'
import {
  $GEOMETRY,
  $INDEX_BUFFER,
  $VERTEX_BUFFER,
  GeometryComponent,
  GeometryContext,
  GeometryExtra,
  IndexBufferComponent,
  IndexBufferContext,
  IndexBufferExtra,
  isIndexBufferComponent,
  isVertexBufferComponent,
  MeshContext,
  NodeProps,
  NodeRef,
  StoreContext,
  TypedArray,
  VertexBufferComponent,
  VertexBufferContext,
  VertexBufferExtra
} from '../types'
import { createBuffer } from '../utils'

export type GeometryRef = NodeRef<GeometryContext>
export type GeometryProps = NodeProps<GeometryContext>

export const Geometry = (props: GeometryProps) => {
  const ch = children(() => props.children)
  const ext = {
    [$GEOMETRY]: true,
    vertexBuffers: [],
    topology: 'triangle-list',
    instanceCount: 1,
    drawRange: { start: 0, count: Infinity }
  } as GeometryExtra
  const { store, setStore, comp } = createNodeContext<GeometryContext>(props, ch, ext)

  props.ref?.(store)

  const [meshCtx, setMeshCtx] = createSignal<StoreContext<MeshContext>>()
  createEffect(() => {
    meshCtx()?.[1]('geometry', store.id)
    setStore('mesh', meshCtx()?.[0].id)

    onCleanup(() => {
      setStore('mesh', undefined)
      meshCtx()?.[1]('geometry', undefined)
    })
  })

  return {
    ...comp,
    [$GEOMETRY]: true as const,
    setMeshCtx,
    render: () => {
      comp.render()
      ch.toArray().forEach(child => {
        if (isVertexBufferComponent(child) || isIndexBufferComponent(child)) {
          child.setGeometryCtx([store, setStore])
        }
      })
      return wgpuCompRender(ch)
    }
  } satisfies GeometryComponent as unknown as JSX.Element
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
  const ch = children(() => props.children)
  const val = createSignal(
    untrack(() => props.value),
    { equals: false }
  )
  const ext: VertexBufferExtra = {
    [$VERTEX_BUFFER]: true,
    layout: untrack(() => props.layout),
    value: val[0],
    setValue: val[1]
  }
  const { store, setStore, comp } = createNodeContext<VertexBufferContext>(props, ch, ext)

  createEffect(() => setStore('attribute', props.attribute))
  createEffect(() => setStore('layout', props.layout))

  createEffect(() => {
    const { device } = store.scene()?.[0] ?? {}
    if (!device) {
      return
    }
    let buffer = untrack(() => store.buffer)
    const data = props.value
    if (!buffer || buffer.size !== data.byteLength) {
      buffer?.destroy()
      buffer = createBuffer({ device, data, usage: GPUBufferUsage.VERTEX })
      batch(() => {
        store.setValue(data)
        setStore('buffer', buffer)
      })
    } else {
      device.queue.writeBuffer(buffer, 0, data)
    }
  })

  props.ref?.(store)

  const [geometryCtx, setGeometryCtx] = createSignal<StoreContext<GeometryContext>>()

  createEffect(() => {
    geometryCtx()?.[1]('vertexBuffers', v => v.concat(store.id))
    onCleanup(() => {
      geometryCtx()?.[1]('vertexBuffers', v => v.filter(x => x !== store.id))
    })
  })

  return {
    ...comp,
    [$VERTEX_BUFFER]: true,
    setGeometryCtx,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies VertexBufferComponent as unknown as JSX.Element
}

export type IndexBufferRef = NodeRef<IndexBufferContext>
export type IndexBufferProps = NodeProps<IndexBufferContext> & {
  value: TypedArray
}
export const IndexBuffer = (props: IndexBufferProps) => {
  const ch = children(() => props.children)
  const val = createSignal(
    untrack(() => props.value),
    { equals: false }
  )
  const ext: IndexBufferExtra = {
    [$INDEX_BUFFER]: true,
    value: val[0],
    setValue: val[1]
  }
  const { store, setStore, comp } = createNodeContext<IndexBufferContext>(props, ch, ext)

  const id = store.id

  createEffect(() => {
    const { device } = store.scene()?.[0] ?? {}
    if (!device) {
      return
    }

    let buffer = untrack(() => store.buffer)
    const data = props.value
    if (!buffer || buffer.size !== data.byteLength) {
      buffer?.destroy()
      buffer = createBuffer({ device, data, usage: GPUBufferUsage.INDEX })
      batch(() => {
        store.setValue(data)
        setStore('buffer', buffer)
      })
    } else {
      device.queue.writeBuffer(buffer, 0, data)
    }
    batch(() => {
      store.setValue(data)
      setStore('buffer', buffer)
    })

    onCleanup(() => buffer.destroy())
  })

  props.ref?.(store)

  const [geometryCtx, setGeometryCtx] = createSignal<StoreContext<GeometryContext>>()

  createEffect(() => {
    geometryCtx()?.[1]('indexBuffer', id)
    onCleanup(() => {
      geometryCtx()?.[1]('indexBuffer', undefined)
    })
  })

  return {
    ...comp,
    [$INDEX_BUFFER]: true,
    setGeometryCtx,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } as IndexBufferComponent as unknown as JSX.Element
}
