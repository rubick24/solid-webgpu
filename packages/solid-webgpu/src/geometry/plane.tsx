import { Geometry, IndexBuffer, VertexBuffer } from './geometry'

export const Plane = () => {
  return (
    <Geometry
      vertexBuffers={
        <>
          <VertexBuffer
            layout={{
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x3'
                } // POSITION
              ],
              arrayStride: 12
            }}
            value={new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0])}
          />
          <VertexBuffer
            layout={{
              attributes: [
                {
                  shaderLocation: 1,
                  offset: 0,
                  format: 'float32x3'
                } // NORMAL
              ],
              arrayStride: 12
            }}
            value={new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])}
          />
          <VertexBuffer
            layout={{
              attributes: [
                {
                  shaderLocation: 2,
                  offset: 0,
                  format: 'float32x4'
                } // TANGENT
              ],
              arrayStride: 16
            }}
            value={new Float32Array(4 * 4).fill(0)}
          />
          <VertexBuffer
            layout={{
              attributes: [
                {
                  shaderLocation: 3,
                  offset: 0,
                  format: 'float32x2'
                } // UV
              ],
              arrayStride: 8
            }}
            value={new Float32Array([1, 1, 0, 1, 0, 0, 1, 0])}
          />
        </>
      }
      indexBuffer={<IndexBuffer value={new Uint32Array([0, 1, 2, 0, 2, 3])} />}
    />
  )
}
