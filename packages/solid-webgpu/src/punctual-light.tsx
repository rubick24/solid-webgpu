import { Vec3, Vec3Like } from '@rubick24/math'
import { children, createEffect, createSignal, onSettled, untrack } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { createObject3DRef, Object3DProps, wgpuCompRender } from './object3d'
import { $PUNCTUAL_LIGHT, Object3DComponent, PunctualLightExtra, PunctualLightRef } from './types'

export type PunctualLightProps = Object3DProps<PunctualLightRef> & {
  color?: Vec3Like
  intensity?: number
  range?: number
} & ({ type?: 'directional' | 'point' } | { type: 'spot'; innerConeAngle?: number; outerConeAngle?: number })

const DEFAULT_COLOR: Vec3Like = [0, 0, 0]

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

  const id = comp.id

  onSettled(() => {
    untrack(() => props.ref?.(store))
  })

  createEffect(
    () => ({
      color: new Vec3(props.color ?? DEFAULT_COLOR),
      setColor: store.setColor,
      intensity: props.intensity ?? 1,
      range: props.range,
      lightType: props.type ?? 'directional',
      innerConeAngle:
        'innerConeAngle' in props && props.innerConeAngle !== undefined ? props.innerConeAngle : 0,
      outerConeAngle:
        'outerConeAngle' in props && props.outerConeAngle !== undefined ? props.outerConeAngle : Math.PI / 4,
      invalidate: store.scene()?.[0].invalidate
    }),
    values => {
      values.setColor(color => {
        color.copy(values.color)
        return color
      })
      setStore(light => {
        light.intensity = values.intensity
        light.range = values.range
        light.lightType = values.lightType
        light.innerConeAngle = values.innerConeAngle
        light.outerConeAngle = values.outerConeAngle
      })
      values.invalidate?.()
    }
  )

  createEffect(
    () => ({ setScene: store.scene()?.[1], invalidate: store.scene()?.[0].invalidate }),
    ({ setScene, invalidate }) => {
      if (!setScene) return
      setScene(scene => {
        scene.lightList.push(id)
      })
      invalidate?.()
      return () => {
        setScene(scene => {
          const index = scene.lightList.indexOf(id)
          if (index !== -1) scene.lightList.splice(index, 1)
        })
        invalidate?.()
      }
    }
  )

  createEffect(
    () => ({ invalidate: store.scene()?.[0].invalidate, matrix: store.matrix() }),
    ({ invalidate }) => invalidate?.()
  )

  return {
    ...comp,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies Object3DComponent as unknown as JSX.Element
}
