import { Vec3, Vec3Like } from 'math'
import { createEffect } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { PunctualLightContextProvider, useSceneContext } from './context'
import { createObject3DContext, Object3DExtra, Object3DProps, Object3DRef } from './object3d'
import { PunctualLightContext, StoreContext } from './types'

export type PunctualLightExtra = Object3DExtra & { punctualLight: PunctualLightContext }
export type PunctualLightRefExtra = {
  punctualLight: StoreContext<PunctualLightContext>
}
export type PunctualLightRef = Object3DRef<PunctualLightRefExtra>
export type PunctualLightProps = Object3DProps & {
  color?: Vec3Like
  intensity?: number
  range?: number
} & ({ type?: 'directional' | 'point' } | { type: 'spot'; innerConeAngle?: number; outerConeAngle?: number })

export const PunctualLight = (props: PunctualLightProps) => {
  const { ref, Provider } = createObject3DContext(['PunctualLight'], props)

  const [scene, setScene] = useSceneContext()

  const id = ref.node[0].id
  setScene(
    'nodes',
    id,
    produce(v => {
      v.punctualLight = {
        color: Vec3.create(),
        intensity: 1,
        range: Infinity,
        lightType: 'directional',
        innerConeAngle: 0,
        outerConeAngle: Math.PI / 4
      } satisfies PunctualLightContext
    })
  )

  const [store, setStore] = createStore<PunctualLightContext>((scene.nodes[id] as PunctualLightExtra).punctualLight)
  props.ref?.(ref)

  createEffect(() => setStore('color', Vec3.clone(props.color ?? [0, 0, 0])))
  createEffect(() => setStore('intensity', props.intensity ?? 1))
  createEffect(() => setStore('range', props.range))
  createEffect(() => setStore('lightType', props.type ?? 'directional'))
  createEffect(() =>
    setStore(
      'innerConeAngle',
      'innerConeAngle' in props && props.innerConeAngle !== undefined ? props.innerConeAngle : 0
    )
  )
  createEffect(() =>
    setStore(
      'outerConeAngle',
      'outerConeAngle' in props && props.outerConeAngle !== undefined ? props.outerConeAngle : Math.PI / 4
    )
  )

  setScene('lightList', v => v.concat(id))

  return (
    <Provider>
      <PunctualLightContextProvider value={[store, setStore]}>{props.children}</PunctualLightContextProvider>
    </Provider>
  )
}
