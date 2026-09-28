import { Dynamic, render } from '@solidjs/web'
import { createEffect, createMemo, createSignal, For, Loading } from 'solid-js'
import {
  type CameraRef,
  Canvas,
  createOrbitControl,
  Object3D,
  PerspectiveCamera,
  PunctualLight,
  Quat,
} from 'solid-webgpu'
import { loadGLTF } from 'solid-webgpu-gltf'

const clips = ['swim', 'ATTACK'] as const

const App = () => {
  const modelPromise = loadGLTF('../../static/whale.glb')
  // Solid 2 memo accessors await PromiseLike values before returning them.
  const model = createMemo(() => modelPromise)
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()
  const [activeClip, setActiveClip] = createSignal<(typeof clips)[number]>('swim')

  createOrbitControl(canvas, camera)

  createEffect(
    () => ({ clipName: activeClip(), gltf: model() }),
    ({ clipName, gltf }) => {
      const clip = gltf.animations.find(animation => animation.name === clipName)
      return clip?.play().stop
    },
  )

  return (
    <Loading fallback={null}>
      <main>
        <Canvas camera={camera()} ref={setCanvas} clearValue={{ r: 0.02, g: 0.06, b: 0.1, a: 1 }}>
          <PerspectiveCamera label="whale_camera" ref={setCamera} position={[0, 0, 32]} aspect={16 / 9} />
          <PunctualLight
            type="spot"
            position={[0, 13, 11]}
            quaternion={Quat.fromEuler(Quat.create(), -50, 0, 0)}
            color={[0.78, 0.91, 1]}
            intensity={900}
            range={40}
            outerConeAngle={Math.PI / 3}
          />
          <Object3D
            position={[6.5, -6, 0]}
            quaternion={Quat.fromEuler(Quat.create(), 0, 90, 0)}
            scale={[1.8, 1.8, 1.8]}
          >
            <Dynamic component={model().scenes[0]} />
          </Object3D>
        </Canvas>
        <nav aria-label="Whale animation">
          <For each={clips}>
            {clip => (
              <button type="button" aria-pressed={activeClip() === clip} onClick={() => setActiveClip(clip)}>
                {clip === 'swim' ? '游动' : '攻击'}
              </button>
            )}
          </For>
        </nav>
      </main>
    </Loading>
  )
}

render(() => <App />, document.getElementById('app')!)
