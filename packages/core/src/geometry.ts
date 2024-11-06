import { TypedArray, Updatable } from './utils'

export type VertexBuffer = Updatable<{
  attribute?: {
    name: string
    type: string
  }
  layout: GPUVertexBufferLayout
  buffer: TypedArray
}>

export type GeometryProps = {
  vertexBuffers: VertexBuffer[]
  indexBuffer?: {
    buffer: TypedArray
  }
  topology?: GPUPrimitiveTopology
  instanceCount?: number
  drawRange?: { start: number; count: number }
}

export class Geometry {
  vertexBuffers: VertexBuffer[] = []
  indexBuffer?: Updatable<{
    buffer: TypedArray
    arrayStride: number
  }>

  topology: GPUPrimitiveTopology = 'triangle-list'
  instanceCount = 1
  drawRange: { start: number; count: number } = { start: 0, count: Infinity }

  constructor(options?: GeometryProps) {
    Object.assign(this, options)
  }
}

export type GeometryConstructor = typeof Geometry
