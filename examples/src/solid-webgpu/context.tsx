import { createContext, useContext } from 'solid-js'
import { SetStoreFunction } from 'solid-js/store'
// import type {  } from './tokenizer'
import { CameraContext, MeshContext, Object3DContext, PunctualLightContext } from './types'

export type SceneContextT = {
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

  parent: Record<string, string>
  mesh: Record<string, MeshContext>
  object3d: Record<string, Object3DContext>
  camera: Record<string, CameraContext>
}

export const SceneContext = createContext<[SceneContextT, SetStoreFunction<SceneContextT>]>()
export const useSceneContext = () => useContext(SceneContext)!
