import { DEG2RAD, Mat4, Quat, Vec3 } from 'math'
import { createEffect, createSignal, mergeProps, splitProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { CameraContextProvider, useSceneContext } from './context'
import { createObject3DContext, Object3DProps, Object3DRef } from './object3d'
import { CameraContext, CameraExtra } from './types'

export type CameraRef = Object3DRef<CameraContext>
export type CameraProps = Object3DProps<CameraContext>

const tempM = Mat4.create()

export const lookAt = (outQuat: Quat, position: Vec3, up: Vec3, target: Vec3) => {
  Mat4.targetTo(tempM, position, target, up)
  Mat4.getRotation(outQuat, tempM)
  return outQuat
}

export const Camera = (props: CameraProps) => {
  const { ref, Provider } = createObject3DContext<CameraContext>(['Camera'], props, {
    projectionMatrix: createSignal(new Mat4(), { equals: false }),
    viewMatrix: createSignal(new Mat4(), { equals: false }),
    projectionViewMatrix: createSignal(new Mat4(), { equals: false })
  } satisfies CameraExtra)

  const [scene] = useSceneContext()

  const id = ref[0].id
  const [store, setStore] = createStore(scene.nodes[id] as CameraContext)

  createEffect(() => {
    store.viewMatrix[1](m => {
      const mat = store.matrix[0]()
      m.copy(mat).invert()
      return m
    })
  })

  props.ref?.([store, setStore])

  createEffect(() => {
    store.projectionViewMatrix[1](m => {
      const p = store.projectionMatrix[0]()
      const v = store.viewMatrix[0]()
      m.copy(p).multiply(v)
      return m
    })
  })

  return (
    <Provider>
      <CameraContextProvider value={[store, setStore]}>{props.children}</CameraContextProvider>
    </Provider>
  )
}

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

  let cameraRef!: CameraRef

  createEffect(() => {
    cameraRef[0].projectionMatrix[1](m => {
      Mat4.perspectiveZO(m, local.fov, local.aspect, local.near, local.far)
      return m
    })
  })

  return (
    <Camera
      {...others}
      ref={v => {
        cameraRef = v
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

  let cameraRef!: CameraRef

  createEffect(() => {
    cameraRef[0].projectionMatrix[1](m => {
      Mat4.orthoZO(m, local.left, local.right, local.bottom, local.top, local.near, local.far)
      return m
    })
  })

  return (
    <Camera
      {...others}
      ref={v => {
        cameraRef = v
        local.ref?.(v)
      }}
    />
  )
}
