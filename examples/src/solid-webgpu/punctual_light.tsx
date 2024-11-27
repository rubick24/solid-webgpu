import { createToken } from '@solid-primitives/jsx-tokenizer'
import { Vec3, Vec3Like } from 'math'
import { createEffect } from 'solid-js'
import { Object3DProps, useObject3DToken } from './object3d'
import { PunctualLightToken, Token, tokenizer } from './tokenizer'

export type PunctualLightProps = Omit<Object3DProps, 'ref'> & {
  ref?: (v: PunctualLightToken) => void
  color?: Vec3Like
  intensity?: number
  range?: number
} & ({ type?: 'directional' | 'point' } | { type: 'spot'; innerConeAngle?: number; outerConeAngle?: number })

export const PunctualLight = createToken(tokenizer, (props: PunctualLightProps) => {
  const token = useObject3DToken(['PunctualLight'], props, {
    color: Vec3.create(),
    intensity: 1,
    range: undefined,
    lightType: 'directional',
    innerConeAngle: 0,
    outerConeAngle: Math.PI / 4
  }) as PunctualLightToken

  props.ref?.(token)
  console.log(111, token.id)

  createEffect(() => token.color.copy(props.color ?? [0, 0, 0]))
  createEffect(() => (token.intensity = props.intensity ?? 1))
  createEffect(() => (token.range = props.range))
  createEffect(() => (token.lightType = props.type === undefined ? 'directional' : props.type))
  createEffect(() => {
    token.innerConeAngle = 'innerConeAngle' in props && props.innerConeAngle !== undefined ? props.innerConeAngle : 0
  })
  createEffect(() => {
    token.outerConeAngle =
      'outerConeAngle' in props && props.outerConeAngle !== undefined ? props.outerConeAngle : Math.PI / 4
  })

  return token
})

export const isPunctualLight = (v: Token): v is PunctualLightToken => v.type.includes('PunctualLight')
