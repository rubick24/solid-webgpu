import { device } from './hks'

export type GeometryOptions = {
  indexBuffer?: {
    buffer: GPUBuffer
    BYTES_PER_ELEMENT: number
  }
  vertexBuffers: {
    buffer: GPUBuffer
    layout: GPUVertexBufferLayout
    name?: string
    type?: string
  }[]

  primitive?: GPUPrimitiveState
  depthStencil?: GPUDepthStencilState

  instanceCount?: number
  drawRange?: { start: number; count: number }
}
export const createPlaneGeometry = (): GeometryOptions => {
  const vbs = [
    new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0]),
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    new Float32Array(4 * 4).fill(0),
    new Float32Array([1, 1, 0, 1, 0, 0, 1, 0])
  ].map(v => {
    const buffer = device.createBuffer({
      size: v.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(buffer, 0, v)
    return buffer
  })

  const ibVal = new Uint32Array([0, 1, 2, 0, 2, 3])
  const ib = device.createBuffer({
    size: ibVal.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(ib, 0, ibVal)

  return {
    indexBuffer: {
      buffer: ib,
      BYTES_PER_ELEMENT: Uint32Array.BYTES_PER_ELEMENT
    },
    vertexBuffers: [
      {
        buffer: vbs[0],
        layout: {
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3'
            } // POSITION
          ],
          arrayStride: 12
        }
      },
      {
        buffer: vbs[1],
        layout: {
          attributes: [
            {
              shaderLocation: 1,
              offset: 0,
              format: 'float32x3'
            } // NORMAL
          ],
          arrayStride: 12
        }
      },

      {
        buffer: vbs[2],
        layout: {
          attributes: [
            {
              shaderLocation: 2,
              offset: 0,
              format: 'float32x4'
            } // TANGENT
          ],
          arrayStride: 16
        }
      },
      {
        buffer: vbs[3],
        layout: {
          attributes: [
            {
              shaderLocation: 3,
              offset: 0,
              format: 'float32x2'
            } // UV
          ],
          arrayStride: 8
        }
      }
    ]
  }
}
