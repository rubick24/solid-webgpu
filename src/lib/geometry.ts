import { BufferData, Updatable } from './utils'

export type VertexBuffer = Updatable<{
  layout: GPUVertexBufferLayout
  buffer: BufferData
}>

export class Geometry {
  vertexBuffers: VertexBuffer[] = []
  indexBuffer?: Updatable<{
    buffer: BufferData
    arrayStride: number
  }>

  topology: GPUPrimitiveTopology = 'triangle-list'
  instanceCount = 1
  drawRange: { start: number; count: number } = { start: 0, count: Infinity }

  constructor(options?: {
    vertexBuffers: VertexBuffer[]
    indexBuffer?: {
      buffer: BufferData
    }
    topology?: GPUPrimitiveTopology
    instanceCount?: number
    drawRange?: { start: number; count: number }
  }) {
    Object.assign(this, options)
  }
}
