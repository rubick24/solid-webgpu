import { BufferData } from './utils'

export type VertexBuffer = {
  layout: GPUVertexBufferLayout
  buffer: BufferData
  needsUpdate: boolean
}

export class Geometry {
  vertexBuffers: VertexBuffer[] = []

  indexBuffer?: BufferData

  constructor() {}
}
