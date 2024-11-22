import { createToken } from '@solid-primitives/jsx-tokenizer'
import { DEG2RAD, Mat4 } from 'math'
import { createEffect, mergeProps, splitProps } from 'solid-js'
import { Object3DProps, useObject3DToken } from './object3d'
import { CameraToken, Token, tokenizer } from './tokenizer'

export const isCamera = (v: Token): v is CameraToken => v.type.includes('Camera')

export type CameraProps = Omit<Object3DProps, 'ref'> & {
  ref?: (v: CameraToken) => void
}

export const Camera = createToken(tokenizer, (props: CameraProps) => {
  const token = useObject3DToken<CameraToken>(['Camera'], props, {
    projectionMatrix: new Mat4(),
    viewMatrix: new Mat4(),
    projectionViewMatrix: new Mat4(),
    _lookAtMatrix: new Mat4()
  })

  props.ref?.(token)
  return token
})

export type PerspectiveCameraProps = CameraProps & {
  fov?: number
  aspect?: number
  near?: number
  far?: number
}
export const PerspectiveCamera = (props: PerspectiveCameraProps) => {
  const [_local, others] = splitProps(props, ['ref', 'fov', 'aspect', 'near', 'far'])

  const local = mergeProps(
    {
      fov: 75 * DEG2RAD,
      aspect: 1,
      near: 0.1,
      far: 1000
    },
    _local
  ) as Required<PerspectiveCameraProps>

  let camera!: CameraToken

  createEffect(() => {
    Mat4.perspectiveZO(camera.projectionMatrix, local.fov, local.aspect, local.near, local.far)
  })

  return (
    <Camera
      {...others}
      ref={v => {
        camera = v
        local.ref?.(v)
      }}
    />
  )
}

export type OrthographicCameraProps = CameraProps & {
  near?: number
  far?: number
  left?: number
  right?: number
  bottom?: number
  top?: number
}
export const OrthographicCamera = (props: OrthographicCameraProps) => {
  const [_local, others] = splitProps(props, ['ref', 'near', 'far', 'left', 'right', 'bottom', 'top'])

  const local = mergeProps(
    {
      near: 0.1,
      far: 1000,
      left: -1,
      right: 1,
      bottom: -1,
      top: 1
    },
    _local
  ) as Required<OrthographicCameraProps>

  let camera!: CameraToken

  createEffect(() => {
    Mat4.orthoZO(camera.projectionMatrix, local.left, local.right, local.bottom, local.top, local.near, local.far)
  })

  return (
    <Camera
      {...others}
      ref={v => {
        camera = v
        local.ref?.(v)
      }}
    />
  )
}
