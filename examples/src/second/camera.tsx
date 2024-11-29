import { DEG2RAD, Mat4 } from 'math'
import { createEffect, mergeProps, splitProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { CameraContextProvider } from './context'
import { createObject3DContext, Object3DProps, Object3DRef } from './object3d'
import { CameraContext, StoreContext } from './types'

type CameraRefExtra = {
  camera: StoreContext<CameraContext>
}
export type CameraRef = Object3DRef<CameraRefExtra>
export type CameraProps = Object3DProps<CameraRefExtra>

export const Camera = (props: CameraProps) => {
  const { ref, Provider } = createObject3DContext(['Camera'], props)

  const context: CameraContext = {
    projectionMatrix: new Mat4(),
    viewMatrix: new Mat4(),
    projectionViewMatrix: new Mat4(),
    _lookAtMatrix: new Mat4()
  }

  const [store, setStore] = createStore(context)

  props.ref?.({ ...ref, camera: [store, setStore] satisfies StoreContext<CameraContext> })

  //   lookAt: (target: Vec3) => {
  //     Mat4.targetTo(token._lookAtMatrix, token.position, target, token.up)
  //     Mat4.getRotation(token.quaternion, token._lookAtMatrix)
  //   }

  createEffect(() => {
    const m = Mat4.create()
    m.copy(ref.object3d[0].matrix).invert()
    setStore('viewMatrix', m)
  })

  createEffect(() => {
    const m = Mat4.create()
    const p = store.projectionMatrix
    const v = store.viewMatrix
    m.copy(p).multiply(v)

    setStore('projectionViewMatrix', m)
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
    const m = Mat4.create()
    Mat4.perspectiveZO(m, local.fov, local.aspect, local.near, local.far)
    cameraRef.camera[1]('projectionMatrix', m)
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
    const m = Mat4.create()
    Mat4.orthoZO(m, local.left, local.right, local.bottom, local.top, local.near, local.far)
    cameraRef.camera[1]('projectionMatrix', m)
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
