import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import type { CameraRef, QuatLike, Vec3Like } from 'solid-webgpu'
import {
  Canvas,
  createOrbitControl,
  imageBitmapFromImageUrl,
  Mesh,
  Object3D,
  PBRMaterial,
  PerspectiveCamera,
  Plane,
  PunctualLight,
  Quat,
  UnlitMaterial
} from 'solid-webgpu'

const t = await imageBitmapFromImageUrl('../../static/a.png')

const Avatar = (props: { position?: Vec3Like; quaternion?: QuatLike }) => {
  return (
    <Mesh {...props}>
      <Plane />
      <PBRMaterial albedoTexture={t} occlusionRoughnessMetallicTexture={t} />
    </Mesh>
  )
}

const App = () => {
  const [p, setP] = createSignal(0)
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  const [r, setR] = createSignal(Quat.create(), { equals: false })
  const af = (t: number) => {
    setR(v => {
      Quat.fromEuler(v, 0, 0, t / 20)
      return v
    })
    requestAnimationFrame(af)
  }
  requestAnimationFrame(af)

  const unlit = (
    <Mesh position={[-3, 0, 0]} quaternion={r()}>
      <Plane />
      <UnlitMaterial albedoTexture={t} />
    </Mesh>
  )

  return (
    <>
      <Canvas camera={camera()} ref={setCanvas}>
        <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />
        <PunctualLight
          type="spot"
          position={[0, 1.5, 0.5]}
          quaternion={Quat.fromEuler(Quat.create(), 90, 0, 0)}
          color={[1, 1, 1]}
          intensity={100}
        />

        <Avatar position={[0, p(), 0]} quaternion={r()} />

        <Show when={p() % 2 === 0}>
          <Object3D position={[3, 0, 0]} quaternion={r()}>
            <Avatar position={[1, 0, 0]} />
          </Object3D>
        </Show>

        {unlit}
      </Canvas>

      <button onClick={() => setP(v => (v + 1) % 5)}>set position</button>
    </>
  )
}

render(() => <App />, document.getElementById('app')!)
