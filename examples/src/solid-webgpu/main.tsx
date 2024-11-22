import { Quat } from 'math'
import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { PerspectiveCamera } from './camera'
import { Canvas } from './canvas'
import { Mesh } from './mesh'
import { Object3D } from './object3d'
import { PunctualLight } from './punctual_light'
import { CameraToken } from './tokenizer'

const App = () => {
  const [p, setP] = createSignal(1)
  const [s, setS] = createSignal(false)

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
        <Object3D>
          <Mesh position={[p(), 1, 1]} />

          <Object3D position={[2, 2, 2]}>
            <Show when={s()}>
              <Object3D position={[3, 3, 3]} />
            </Show>
          </Object3D>
        </Object3D>
      </Canvas>

      <button onClick={() => setS(v => !v)}>toggle show</button>
      <button onClick={() => setP(v => v + 1)}>set position</button>
    </>
  )
}

render(() => <App />, document.getElementById('app')!)
