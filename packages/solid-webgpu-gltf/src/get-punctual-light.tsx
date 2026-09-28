import { PunctualLight, Vec3 } from 'solid-webgpu'
import type { Component } from 'solid-js'
import type { LoaderContext } from './types'

type LightDefinition = {
  name?: string
  type: 'directional' | 'point' | 'spot'
  color?: [number, number, number]
  intensity?: number
  range?: number
  spot?: {
    innerConeAngle?: number
    outerConeAngle?: number
  }
}

export const getPunctualLight = (index: number, context: LoaderContext): Component => {
  const extension = context.json.extensions?.KHR_lights_punctual as { lights?: LightDefinition[] } | undefined
  const light = extension?.lights?.[index]
  if (!light) throw new Error(`Node references missing KHR_lights_punctual light ${index}`)

  return () => (
    <PunctualLight
      label={light.name ?? `glTF light ${index}`}
      type={light.type}
      color={Vec3.fromValues(...(light.color ?? [1, 1, 1]))}
      intensity={light.intensity}
      range={light.range}
      innerConeAngle={light.spot?.innerConeAngle}
      outerConeAngle={light.spot?.outerConeAngle}
    />
  )
}
