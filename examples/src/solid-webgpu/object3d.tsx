import { createToken } from '@solid-primitives/jsx-tokenizer'
import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'
import { createEffect, createUniqueId, ParentProps } from 'solid-js'
import { useSceneContext } from './canvas'
import { Object3DToken, Token, tokenizer, useParentToken } from './tokenizer'

export type Object3DProps = ParentProps & {
  ref?: (v: Token) => void
  label?: string
  position?: Vec3Like
  quaternion?: QuatLike
  scale?: Vec3Like
}

export const useObject3DToken = (props: Omit<Object3DProps, 'ref'>) => {
  const resolve = useParentToken(props)
  const id = createUniqueId()

  const token: Object3DToken = {
    type: ['Object3D'],
    id,
    label: props.label ?? '',
    resolve,

    matrix: Mat4.create(),
    position: Vec3.create(),
    quaternion: Quat.create(),
    scale: Vec3.create()
  }
  createEffect(() => {
    if (props.position !== undefined) {
      token.position.copy(props.position)
    }
  })
  createEffect(() => {
    if (props.quaternion !== undefined) {
      token.quaternion.copy(props.quaternion)
    }
  })
  createEffect(() => {
    if (props.scale !== undefined) {
      token.scale.copy(props.scale)
    }
  })
  return token
}

export const Object3D = createToken(tokenizer, (props: Object3DProps) => {
  const token = useObject3DToken(props)
  const scene = useSceneContext()
  scene.nodes[token.id] = token
  props.ref?.(token)
  return token
})

export const isObject3D = (v: Token): v is Object3DToken => v.type.includes('Object3D')
