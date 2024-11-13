import {
  Camera,
  Geometry,
  GeometryProps,
  Material,
  MaterialProps,
  Mesh,
  Object3D,
  Object3DProps,
  PunctualLight,
  PunctualLightProps
} from 'core'

export const wgpuElements = {
  object3d: Object3D,
  mesh: Mesh,
  camera: Camera,
  punctual_light: PunctualLight,

  material: Material,
  geometry: Geometry
} as const
export type WGPUElementKey = keyof typeof wgpuElements
export type WGPUElement = InstanceType<(typeof wgpuElements)[WGPUElementKey]>
export const builtinElementKeys = Object.keys(wgpuElements) as WGPUElementKey[]

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements extends WGPUElements {}

    interface ElementChildrenAttribute {
      children: {}
    }

    type WGPUElements = {
      object3d: Object3DProps
      mesh: Object3DProps & {
        geometry: Geometry | JSX.Element
        material: Material | JSX.Element
      }
      material: MaterialProps
      geometry: GeometryProps

      camera: Object3DProps
      // perspective_camera: PerspectiveCameraProps
      // orthographic_camera: OrthographicCameraProps
      punctual_light: PunctualLightProps
    }
  }
}

export { JSX } from 'solid-js'
