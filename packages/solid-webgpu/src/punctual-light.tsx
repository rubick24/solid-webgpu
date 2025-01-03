import { Vec3, Vec3Like } from 'math'
import { children, createEffect, createSignal, JSX, onCleanup } from 'solid-js'
import { createObject3DRef, Object3DProps, wgpuCompRender } from './object3d'
import { $PUNCTUAL_LIGHT, Object3DComponent, PunctualLightExtra, PunctualLightRef } from './types'

export type PunctualLightProps = Object3DProps<PunctualLightRef> & {
  color?: Vec3Like
  intensity?: number
  range?: number
} & ({ type?: 'directional' | 'point' } | { type: 'spot'; innerConeAngle?: number; outerConeAngle?: number })

export const PunctualLight = (props: PunctualLightProps) => {
  const ch = children(() => props.children)

  const c = createSignal(Vec3.create(), { equals: false })
  const lightExt = {
    [$PUNCTUAL_LIGHT]: true,
    color: c[0],
    setColor: c[1],
    intensity: 1,
    range: Infinity,
    lightType: 'directional',
    innerConeAngle: 0,
    outerConeAngle: Math.PI / 4
  } satisfies PunctualLightExtra
  const { store, setStore, comp } = createObject3DRef<PunctualLightRef>(props, ch, lightExt)

  const id = store.id

  props.ref?.(store)

  createEffect(() =>
    store.setColor(v => {
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

  createEffect(() => {
    const setScene = store.scene()?.[1]
    setScene?.('lightList', v => v.concat(id))
    onCleanup(() => {
      setScene?.('lightList', v => v.filter(x => id !== x))
    })
  })

  return {
    ...comp,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies Object3DComponent as unknown as JSX.Element
}
