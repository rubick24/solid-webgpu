import { PBRMaterial, textureFromUrl } from 'core'
import { Quat } from 'math'
import { createContext, createSignal } from 'solid-js'
import { render } from 'solid-webgpu'

import { Camera, Object3D, OrbitControl, PerspectiveCamera, WebGPURenderer, WebGPURendererProps } from 'core'
import { children, onCleanup, onMount, ParentProps } from 'solid-js'
import { createStore, SetStoreFunction } from 'solid-js/store'
import { useFrame } from './context'

type RendererStore = {
  renderer: WebGPURenderer
  camera: Camera
}

const RendererContext = createContext<[RendererStore, SetStoreFunction<RendererStore>]>()

export const RendererContextProvider = (props: ParentProps & WebGPURendererProps & { camera?: Camera }) => {
  const [store, setStore] = createStore<RendererStore>({
    renderer: new WebGPURenderer(props),
    camera: props?.camera ?? new PerspectiveCamera({ aspect: 16 / 9, position: [0, 0, 5] })
  })
  const c = children(() => props.children).toArray()
  const scene = Array.isArray(c)
    ? new Object3D({ children: c.filter(v => v instanceof Object3D) as unknown as Object3D[] })
    : (props.children as unknown as Object3D)

  let raf = NaN
  const animate = (t: number) => {
    store.renderer.render(scene, store.camera)
    raf = requestAnimationFrame(animate)
  }
  onMount(() => {
    const renderer = store.renderer
    renderer.setSize(960, 540)
    const control = new OrbitControl(store.camera)
    control.connect(renderer.canvas)
    document.body.appendChild(renderer.canvas)
    raf = requestAnimationFrame(animate)
  })
  onCleanup(() => {
    document.body.removeChild(store.renderer.canvas)
    cancelAnimationFrame(raf)
  })

  return <RendererContext.Provider value={[store, setStore]} children={c}></RendererContext.Provider>
}

const texture = await textureFromUrl('/a.png')
const Box = () => {
  // console.log(store?.renderer)
  const g = (
    <geometry
      vertexBuffers={[
        {
          layout: {
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3'
              } // POSITION
            ],
            arrayStride: 12
          },
          buffer: new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0])
        },
        {
          layout: {
            attributes: [
              {
                shaderLocation: 1,
                offset: 0,
                format: 'float32x3'
              } // NORMAL
            ],
            arrayStride: 12
          },
          buffer: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
        },
        {
          layout: {
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: 'float32x4'
              } // TANGENT
            ],
            arrayStride: 16
          },
          buffer: new Float32Array(4 * 4).fill(0)
        },
        {
          layout: {
            attributes: [
              {
                shaderLocation: 3,
                offset: 0,
                format: 'float32x2'
              } // UV
            ],
            arrayStride: 8
          },
          buffer: new Float32Array([1, 1, 0, 1, 0, 0, 1, 0])
        }
      ]}
      indexBuffer={{
        buffer: new Uint32Array([0, 1, 2, 0, 2, 3])
      }}
    />
  )
  const material = new PBRMaterial({
    albedoTexture: texture,
    occlusionRoughnessMetallicTexture: texture
  })

  const [count, setCount] = createSignal(0)

  useFrame(t => {
    setCount((t / 1000) % 2)
  })

  return <mesh position={[count(), 0, 0] as any} geometry={g} material={material}></mesh>
}

const App = () => {
  return (
    <>
      <Box />
      <punctual_light
        type="spot"
        position={[0, 1.5, 0.5]}
        quaternion={Quat.fromEuler(Quat.create(), 90, 0, 0)}
        color={[1, 1, 1]}
        intensity={100}
      />
    </>

    //   <RendererContextProvider>
    // </RendererContextProvider>
  )
}

render(() => <App />, new Object3D())
