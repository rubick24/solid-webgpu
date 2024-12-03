import { Vec3, Vec3Like } from 'math'
import { createEffect, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { PunctualLightContextProvider, useSceneContext } from './context'
import { createObject3DContext, Object3DProps, Object3DRef } from './object3d'
import { PunctualLightContext, PunctualLightExtra } from './types'

export type PunctualLightRef = Object3DRef<PunctualLightContext>
export type PunctualLightProps = Object3DProps<PunctualLightContext> & {
  color?: Vec3Like
  intensity?: number
  range?: number
} & ({ type?: 'directional' | 'point' } | { type: 'spot'; innerConeAngle?: number; outerConeAngle?: number })

export const PunctualLight = (props: PunctualLightProps) => {
  const { ref, Provider } = createObject3DContext(['PunctualLight'], props, {
    color: createSignal(Vec3.create(), { equals: false }),
    intensity: 1,
    range: Infinity,
    lightType: 'directional',
    innerConeAngle: 0,
    outerConeAngle: Math.PI / 4
  } satisfies PunctualLightExtra)

  const [scene, setScene] = useSceneContext()

  const id = ref[0].id

  const [store, setStore] = createStore(scene.nodes[id] as PunctualLightContext)
  props.ref?.([store, setStore])

  createEffect(() =>
    store.color[1](v => {
      v.copy(props.color ?? [0, 0, 0])
      return v
    })
  )
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
