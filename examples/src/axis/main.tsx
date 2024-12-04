import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Canvas, createOrbitControl, PerspectiveCamera, PunctualLight, Quat, type CameraRef } from 'solid-webgpu'
import { loadGLTF } from 'solid-webgpu-gltf'

const { json, scenes } = await loadGLTF('../../static/axis.glb')
const GLTFModel = scenes[0]

console.log(json)

const App = () => {
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  return (
    <Canvas camera={camera()} ref={setCanvas}>
      <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
      <PunctualLight
        type="spot"
        position={[0, 3, 0.5]}
        quaternion={Quat.fromEuler(Quat.create(), 90, 0, 0)}
        color={[1, 1, 1]}
        intensity={100}
      />

      <GLTFModel />
    </Canvas>
  )
}

render(() => <App />, document.getElementById('app')!)
