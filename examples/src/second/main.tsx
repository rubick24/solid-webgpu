import { Quat } from 'math'
import { createEffect, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { CameraRef, PerspectiveCamera } from './camera'
import { Canvas } from './canvas'
import { Geometry, IndexBuffer, VertexBuffer } from './geometry'
import { PBRMaterial } from './material/pbr-material'
import { Mesh } from './mesh'
import { Object3D } from './object3d'
import { PunctualLight } from './punctual_light'
import { imageBitmapFromImageUrl } from './utils'

const t = await imageBitmapFromImageUrl('/a.png')

const App = () => {
  const [p, setP] = createSignal(0)
  const [camera, setCamera] = createSignal<CameraRef>()
  // const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createEffect(() => {
    console.log('effect', camera())
  })

  // createOrbitControl(canvas, camera)
  return (
    <>
      <Canvas>
        <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
        <PunctualLight
          type="spot"
          position={[0, 1.5, 0.5]}
          quaternion={Quat.fromEuler(Quat.create(), 90, 0, 0)}
          color={[1, 1, 1]}
          intensity={100}
        />
        <Object3D position={[p(), 0, 0]} label={`xxx-${p()}`} />
        <Mesh
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
          material={<PBRMaterial albedoTexture={t} />}
        />
      </Canvas>

      <button onClick={() => setP(v => v + 1)}>set position</button>
    </>
  )
}

render(() => <App />, document.getElementById('app')!)
