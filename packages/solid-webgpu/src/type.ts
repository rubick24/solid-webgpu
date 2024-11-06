import { MeshProps, Object3DProps, OrthographicCameraProps, PerspectiveCameraProps, PunctualLightProps } from 'core'

export type SolidWebGPUTags = {
  object3d: Object3DProps
  mesh: MeshProps
  camera: Object3DProps
  perspective_camera: PerspectiveCameraProps
  orthographic_camera: OrthographicCameraProps
  punctual_light: PunctualLightProps
}
