# Solid WebGPU

Aims to be thin layer between solid-js and WebGPU with minimal abstraction and performance overhead.

**[demos](https://solid-webgpu.vercel.app/)**<br/>
view source code of these demos in `packages/examples` folder.

Mainly using solid-js store and context API.

Packed with a forked version of `gl-matrix` v4 beta at `packages/math`, it may be externalized once it's in stable.

## Get Started

```tsx
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import type { CameraRef, QuatLike, Vec3Like } from 'solid-webgpu'
import {
  Canvas,
  createOrbitControl,
  createPBRMaterial,
  createPlaneGeometry,
  imageBitmapFromImageUrl,
  Mesh,
  PerspectiveCamera,
  PunctualLight,
  Quat
} from 'solid-webgpu'

const t = await imageBitmapFromImageUrl('../../static/a.png')

const Avatar = (props: { position?: Vec3Like; quaternion?: QuatLike }) => {
  const planeGeo = createPlaneGeometry()
  const pbrMat = createPBRMaterial({ albedoTexture: t })
  return <Mesh geometry={planeGeo} material={pbrMat()} {...props} />
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
      </Canvas>

      <button onClick={() => setP(v => (v + 1) % 5)}>set position</button>
    </>
  )
}

render(() => <App />, document.getElementById('app')!)
```

## Built-in Components

```tsx
<Canvas />
<Object3D />
<Mesh />
<Camera />
<PunctualLight />

<PerspectiveCamera />
<OrthographicCamera />
```

## Methods

```ts
createPBRMaterial
createUnlitMaterial
createPlaneGeometry
createOrbitControl
```
