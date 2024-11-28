import { createToken } from '@solid-primitives/jsx-tokenizer'
import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'
import { createEffect, ParentProps, splitProps } from 'solid-js'
import { useSceneContext } from './context'
import { tokenizer, useToken } from './tokenizer'
import { CommonTokenProps, Object3DContext, Token } from './types'

export type Object3DProps = CommonTokenProps &
  ParentProps & {
    position?: Vec3Like
    quaternion?: QuatLike
    scale?: Vec3Like
  }

export const createObject3DContext = (
  token: Token,
  props: Omit<Object3DProps, keyof (CommonTokenProps & ParentProps)>
) => {
  const [o3dProps] = splitProps(props, ['position', 'quaternion', 'scale'])

  const object3DContext: Object3DContext = {
    matrix: Mat4.create(),
    position: Vec3.create(),
    quaternion: Quat.create(),
    scale: Vec3.fromValues(1, 1, 1),
    up: Vec3.fromValues(0, 1, 0)
  }

  const [_, setSceneContext] = useSceneContext()

  setSceneContext('object3d', token.id, object3DContext)

  createEffect(() => {
    setSceneContext('object3d', token.id, 'position', Vec3.clone(o3dProps.position ?? [0, 0, 0]))
  })

  createEffect(() => {
    setSceneContext('object3d', token.id, 'quaternion', Quat.clone(o3dProps.quaternion ?? [0, 0, 0, 1]))
  })

  createEffect(() => {
    setSceneContext('object3d', token.id, 'scale', Vec3.clone(o3dProps.scale ?? [1, 1, 1]))
  })
}

export const Object3D = createToken(tokenizer, (props: Object3DProps) => {
  const [tokenProps, local] = splitProps(props, ['children', 'label', 'ref'])
  const token = useToken(['Object3D'], tokenProps)

  createObject3DContext(token, local)

  return token
})

export const isObject3D = (v: Token) => v.type.includes('Object3D')
