import { Quat } from 'math'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { PerspectiveCamera } from './camera'
import { Canvas } from './canvas'
import { Geometry, IndexBuffer, VertexBuffer } from './geometry'
import { PBRMaterial } from './material/pbr-material'
import { Mesh } from './mesh'
import { PunctualLight } from './punctual_light'
import { CameraToken } from './tokenizer'

const App = () => {
  const [p, setP] = createSignal(1)
  const [camera, setCamera] = createSignal<CameraToken>()

  return (
    <>
      <Canvas camera={camera()}>
        <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
        <PunctualLight
          type="spot"
          position={[0, 1.5, 0.5]}
          quaternion={Quat.fromEuler(Quat.create(), 90, 0, 0)}
          color={[1, 1, 1]}
          intensity={100}
        />
        <Mesh
          position={[p(), 1, 1]}
          geometry={
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
                    buffer={new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0])}
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
                    buffer={new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])}
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
                    buffer={new Float32Array(4 * 4).fill(0)}
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
                    buffer={new Float32Array([1, 1, 0, 1, 0, 0, 1, 0])}
                  />
                </>
              }
              indexBuffer={<IndexBuffer buffer={new Uint32Array([0, 1, 2, 0, 2, 3])} />}
            />
          }
          material={<PBRMaterial albedo={[0, 0.5, 0]} />}
        />
      </Canvas>

      <button onClick={() => setP(v => v + 1)}>set position</button>
    </>
  )
}

render(() => <App />, document.getElementById('app')!)
