import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { CameraToken, Canvas, Object3D, PerspectiveCamera } from './tokenizer'

const App = () => {
  const [p, setP] = createSignal(0)
  const [s, setS] = createSignal(false)

  const [camera, setCamera] = createSignal<CameraToken>()

  return (
    <>
      <Canvas camera={camera()}>
        <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
        <Object3D>
          <Object3D position={[p(), 1, 1]}></Object3D>

          <Show when={s()}>
            <Object3D position={[2, 2, 2]}></Object3D>
            <Object3D position={[3, 3, 3]}></Object3D>
          </Show>
        </Object3D>
      </Canvas>

      <button onClick={() => setS(v => !v)}>toggle show</button>
      <button onClick={() => setP(v => v + 1)}>set position</button>
    </>
  )
}

render(() => <App />, document.getElementById('app')!)
