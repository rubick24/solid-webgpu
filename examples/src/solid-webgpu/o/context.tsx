// import { Camera, Object3D, OrbitControl, PerspectiveCamera, WebGPURenderer, WebGPURendererProps } from 'core'
// import { children, createContext, createEffect, onCleanup, onMount, ParentProps, useContext } from 'solid-js'
// import { createStore, SetStoreFunction } from 'solid-js/store'

// type RendererStore = {
//   renderer: WebGPURenderer
//   camera: Camera
// }
// const RendererContext = createContext<[RendererStore, SetStoreFunction<RendererStore>]>()

// export const RendererContextProvider = (props: ParentProps & WebGPURendererProps & { camera?: Camera }) => {
//   const [store, setStore] = createStore<RendererStore>({
//     renderer: new WebGPURenderer(props),
//     camera: props?.camera ?? new PerspectiveCamera({ aspect: 16 / 9, position: [0, 0, 5] })
//   })
//   const c = children(() => props.children).toArray()
//   const scene = Array.isArray(c)
//     ? new Object3D({ children: c.filter(v => v instanceof Object3D) as unknown as Object3D[] })
//     : (props.children as unknown as Object3D)

//   let raf = NaN
//   const animate = (t: number) => {
//     store.renderer.render(scene, store.camera)
//     raf = requestAnimationFrame(animate)
//   }
//   onMount(() => {
//     const renderer = store.renderer
//     renderer.setSize(960, 540)
//     const control = new OrbitControl(store.camera)
//     control.connect(renderer.canvas)
//     document.body.appendChild(renderer.canvas)
//     raf = requestAnimationFrame(animate)
//   })
//   onCleanup(() => {
//     document.body.removeChild(store.renderer.canvas)
//     cancelAnimationFrame(raf)
//   })

//   return <RendererContext.Provider value={[store, setStore]} children={c}></RendererContext.Provider>
// }

// export const useRendererContext = () => {
//   return useContext(RendererContext)
// }

// export const useFrame = (fn: (time: number) => void) => {
//   createEffect(() => {
//     let animationFrameId: number
//     const animate = (time: number) => {
//       fn(time)
//       animationFrameId = requestAnimationFrame(animate)
//     }
//     animationFrameId = requestAnimationFrame(animate)
//     onCleanup(() => {
//       cancelAnimationFrame(animationFrameId)
//     })
//   })
// }
