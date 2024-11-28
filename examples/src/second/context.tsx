import { createContext, useContext } from 'solid-js'
import { SetStoreFunction } from 'solid-js/store'
import {
  CameraContext,
  GeometryContext,
  MaterialContext,
  MeshContext,
  NodeContext,
  Object3DContext,
  PunctualLightContext
} from './types'

export type SceneContext = {
  currentCamera?: CameraContext

  width: number
  height: number
  format: GPUTextureFormat
  autoClear: boolean
  samples: number

  device: GPUDevice
  canvas?: HTMLCanvasElement
  context?: GPUCanvasContext

  _msaaTexture?: GPUTexture
  _msaaTextureView?: GPUTextureView
  _depthTexture?: GPUTexture
  _depthTextureView?: GPUTextureView
  _commandEncoder?: GPUCommandEncoder
  _passEncoder?: GPURenderPassEncoder

  lightList?: PunctualLightContext[]
}

// mesh: Record<string, MeshContext>
// object3d: Record<string, Object3DContext>
// camera: Record<string, CameraContext>

export const _SceneContext = createContext<[SceneContext, SetStoreFunction<SceneContext>]>()
export const SceneContextProvider = _SceneContext.Provider
export const useSceneContext = () => useContext(_SceneContext)!

export const _NodeContext = createContext<[NodeContext, SetStoreFunction<NodeContext>]>()
export const NodeContextProvider = _NodeContext.Provider
export const useNodeContext = () => useContext(_NodeContext)!

export const _Object3DContext = createContext<[Object3DContext, SetStoreFunction<Object3DContext>]>()
export const Object3DContextProvider = _Object3DContext.Provider
export const useObject3DContext = () => useContext(_Object3DContext)!

export const _MeshContext = createContext<[MeshContext, SetStoreFunction<MeshContext>]>()
export const MeshContextProvider = _MeshContext.Provider
export const useMeshContext = () => useContext(_MeshContext)!

export const _CameraContext = createContext<[CameraContext, SetStoreFunction<CameraContext>]>()
export const CameraContextProvider = _CameraContext.Provider
export const useCameraContext = () => useContext(_CameraContext)!

export const _PunctualLightContext = createContext<[PunctualLightContext, SetStoreFunction<PunctualLightContext>]>()
export const PunctualLightContextProvider = _PunctualLightContext.Provider
export const usePunctualLightContext = () => useContext(_PunctualLightContext)!

export const _GeometryContext = createContext<[GeometryContext, SetStoreFunction<GeometryContext>]>()
export const GeometryContextProvider = _GeometryContext.Provider
export const useGeometryContext = () => useContext(_GeometryContext)!

export const _MaterialContext = createContext<[MaterialContext, SetStoreFunction<MaterialContext>]>()
export const MaterialContextProvider = _MaterialContext.Provider
export const useMaterialContext = () => useContext(_MaterialContext)!
