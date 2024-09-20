import { BufferData } from './utils'

export class Geometry {
  bufferLayouts: GPUVertexBufferLayout[] = []
  buffers: {
    layout: GPUVertexBufferLayout
    buffer: BufferData
    needsUpdate: boolean
  }[] = []

  constructor() {}
}
