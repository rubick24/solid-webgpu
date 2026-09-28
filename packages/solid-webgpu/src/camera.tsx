import { DEG2RAD, Mat4, type Quat, type Vec3 } from '@rubick24/math'
import type { JSX } from '@solidjs/web'
import {
  type Accessor,
  children,
  createEffect,
  createMemo,
  createSignal,
  merge,
  omit,
  onSettled,
  untrack,
} from 'solid-js'
import { createObject3DRef, type Object3DProps, wgpuCompRender } from './object3d'
import { $CAMERA, type CameraExtra, type CameraRef, type Object3DComponent } from './types'

export type CameraProps = Object3DProps<CameraRef>

const tempM = Mat4.create()

export const lookAt = (outQuat: Quat, position: Vec3, up: Vec3, target: Vec3) => {
  Mat4.targetTo(tempM, position, target, up)
  Mat4.getRotation(outQuat, tempM)
  return outQuat
}

export const Camera = (props: CameraProps) => {
  const ch = children(() => props.children)

  const p = createSignal(new Mat4(), { equals: false })
  let readViewMatrix!: Accessor<Mat4>
  let readProjectionViewMatrix!: Accessor<Mat4>
  const cameraExt = {
    [$CAMERA]: true,
    projectionMatrix: p[0],
    setProjectionMatrix: p[1],
    viewMatrix: () => readViewMatrix(),
    projectionViewMatrix: () => readProjectionViewMatrix(),
  } satisfies CameraExtra
  const { store, comp } = createObject3DRef<CameraRef>(props, ch, cameraExt)
  const id = comp.id
  readViewMatrix = createMemo(() => Mat4.invert(new Mat4(), store.matrix()) ?? new Mat4())
  readProjectionViewMatrix = createMemo(() => Mat4.mul(new Mat4(), p[0](), readViewMatrix()))

  createEffect(
    () => store.scene()?.[1],
    setScene => {
      if (!setScene) return
      setScene(scene => {
        scene.currentCamera ??= id
      })
      return () =>
        setScene(scene => {
          if (scene.currentCamera === id) scene.currentCamera = undefined
        })
    },
  )

  onSettled(() => {
    untrack(() => props.ref?.(store))
  })

  return {
    ...comp,
    render: () => wgpuCompRender(ch),
  } satisfies Object3DComponent as unknown as JSX.Element
}

export type PerspectiveCameraProps = CameraProps & {
  fov?: number
  aspect?: number
  near?: number
  far?: number
}
export const PerspectiveCamera = (props: PerspectiveCameraProps) => {
  const others = omit(props, 'ref', 'fov', 'aspect', 'near', 'far')

  const local = merge(
    {
      fov: 75 * DEG2RAD,
      aspect: undefined,
      near: 0.1,
      far: 1000,
    },
    props,
  )

  const [cameraRef, setCameraRef] = createSignal<CameraRef>()

  createEffect(
    () => ({
      setProjectionMatrix: cameraRef()?.setProjectionMatrix,
      fov: local.fov,
      aspect:
        local.aspect ??
        (() => {
          const scene = cameraRef()?.scene()?.[0]
          return scene?.height ? scene.width / scene.height : 1
        })(),
      near: local.near,
      far: local.far,
    }),
    ({ setProjectionMatrix, fov, aspect, near, far }) => {
      setProjectionMatrix?.(m => {
        Mat4.perspectiveZO(m, fov, aspect, near, far)
        return m
      })
    },
  )

  return (
    <Camera
      {...others}
      ref={v => {
        setCameraRef(v)
        untrack(() => local.ref?.(v))
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
  const others = omit(props, 'ref', 'near', 'far', 'left', 'right', 'bottom', 'top')

  const local = merge(
    {
      near: 0.1,
      far: 1000,
      left: -1,
      right: 1,
      bottom: -1,
      top: 1,
    },
    props,
  )

  const [cameraRef, setCameraRef] = createSignal<CameraRef>()

  createEffect(
    () => ({
      setProjectionMatrix: cameraRef()?.setProjectionMatrix,
      left: local.left,
      right: local.right,
      bottom: local.bottom,
      top: local.top,
      near: local.near,
      far: local.far,
    }),
    ({ setProjectionMatrix, left, right, bottom, top, near, far }) => {
      setProjectionMatrix?.(m => {
        Mat4.orthoZO(m, left, right, bottom, top, near, far)
        return m
      })
    },
  )

  return (
    <Camera
      {...others}
      ref={v => {
        setCameraRef(v)
        untrack(() => local.ref?.(v))
      }}
    />
  )
}
