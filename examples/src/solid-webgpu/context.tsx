import { createContext, useContext } from 'solid-js'
import { SetStoreFunction } from 'solid-js/store'
import type { CameraToken, PunctualLightToken, Token, UniformToken } from './tokenizer'

export type SceneContextT = {
  camera?: CameraToken

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

  lightList?: PunctualLightToken[]

  parent: Record<string, Token>
  mesh: Record<string, MeshContextT>
}

export const SceneContext = createContext<[SceneContextT, SetStoreFunction<SceneContextT>]>()
export const useSceneContext = () => useContext(SceneContext)!

export type MeshContextT = {
  uniforms?: UniformToken[]
  bindGroupLayout?: GPUBindGroupLayout
  bindGroupEntries?: GPUBindGroupEntry[]
  pipeline?: GPURenderPipeline
}
