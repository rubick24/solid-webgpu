import { createResource, createSignal } from 'solid-js'
import { Dynamic, render } from 'solid-js/web'
import { Canvas, createOrbitControl, PerspectiveCamera, PunctualLight, Quat, type CameraRef } from 'solid-webgpu'
import { loadGLTF } from 'solid-webgpu-gltf'

const App = () => {
  const [model] = createResource(async () => loadGLTF('../../static/suzanne.glb'))

  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  return (
    <Canvas camera={camera()} ref={setCanvas}>
      <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
      <PunctualLight
        type="spot"
        position={[0, 5, 5]}
        quaternion={Quat.fromEuler(Quat.create(), 120, 0, 0)}
        color={[1, 1, 1]}
        intensity={50}
      />

      <Dynamic component={model()?.scenes[0]} />
    </Canvas>
  )
}

render(() => <App />, document.getElementById('app')!)
