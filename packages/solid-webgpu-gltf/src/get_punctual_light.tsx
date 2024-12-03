import { PunctualLight, Vec3 } from 'solid-webgpu'
import { LoaderContext } from './types'

export const getPunctualLight = (index: number, context: LoaderContext) => {
  const json = (
    context.json.extensions?.KHR_lights_punctual as {
      lights: {
        name?: string
        type: 'directional' | 'point' | 'spot'
        color?: [number, number, number]
        intensity?: number
        range?: number
        spot?: {
          innerConeAngle?: number
          outerConeAngle?: number
        }
      }[]
    }
  ).lights[index]
  if (!json) {
    throw new Error('light not found')
  }

  const Light = () => (
    <PunctualLight
      label={json.name}
      type={json.type}
      color={json.color ? Vec3.fromValues(...json.color) : undefined}
      intensity={json.intensity}
      range={json.range}
      innerConeAngle={json.spot?.innerConeAngle}
      outerConeAngle={json.spot?.outerConeAngle}
    />
  )

  return Light
}
