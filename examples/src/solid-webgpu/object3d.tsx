import { createToken } from '@solid-primitives/jsx-tokenizer'
import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'
import { createEffect, ParentProps } from 'solid-js'
import { CommonTokenProps, Object3DToken, Token, tokenizer, useCommonToken, useParentToken } from './tokenizer'

export type Object3DProps = CommonTokenProps<Object3DToken> &
  ParentProps & {
    position?: Vec3Like
    quaternion?: QuatLike
    scale?: Vec3Like
  }

export const useObject3DToken = <T extends Object3DToken>(
  types: string[],
  props: Omit<Object3DProps, 'ref'>,
  init?: object
) => {
  const resolveChildren = useParentToken(props)

  const token = useCommonToken<T>(['Object3D'].concat(types), props, {
    matrix: Mat4.create(),
    position: Vec3.create(),
    quaternion: Quat.create(),
    scale: Vec3.fromValues(1, 1, 1),
    up: Vec3.fromValues(0, 1, 0),
    resolveChildren,
    ...init
  })

  createEffect(() => token.position.copy(props.position ?? [0, 0, 0]))
  createEffect(() => token.quaternion.copy(props.quaternion ?? [0, 0, 0, 1]))
  createEffect(() => token.scale.copy(props.scale ?? [1, 1, 1]))
  return token
}

export const Object3D = createToken(tokenizer, (props: Object3DProps) => {
  const token = useObject3DToken([], props)
  props.ref?.(token)
  return token
})

export const isObject3D = (v: Token): v is Object3DToken => v.type.includes('Object3D')
