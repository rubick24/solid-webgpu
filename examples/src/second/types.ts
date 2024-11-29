import { Mat4, Quat, Vec3 } from 'math'
import { Accessor } from 'solid-js'
import { SetStoreFunction } from 'solid-js/store'

export type Optional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>

export type Updatable<T> = T & { needsUpdate?: boolean }

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
export type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor

// | HTMLVideoElement
export type ImageRepresentation =
  | ImageBitmap
  | ImageData
  | HTMLImageElement
  | VideoFrame
  | HTMLCanvasElement
  | OffscreenCanvas

export type ExternalTexture = Updatable<{
  type: 'externalTexture'
  descriptor: GPUTextureDescriptor
  video?: HTMLVideoElement
}>

export type MaybeAccessor<T> = T | Accessor<T>
export type MaybeAccessorValue<T extends MaybeAccessor<unknown>> = T extends () => any ? ReturnType<T> : T

export type StoreContext<T> = [T, SetStoreFunction<T>]

export type NodeContext = {
  type: string[]
  id: string
  label: string
  parent?: string
  children?: string[]
}

export type Object3DContext = {
  matrix: Mat4
  position: Vec3
  quaternion: Quat
  scale: Vec3
  up: Vec3
}

export type CameraContext = {
  projectionMatrix: Mat4
  viewMatrix: Mat4
  projectionViewMatrix: Mat4
  // lookAt: (target: Vec3) => void
}

export type PunctualLightContext = {
  color: Vec3
  intensity: number
  range?: number
  lightType: 'directional' | 'point' | 'spot'
  innerConeAngle: number
  outerConeAngle: number
}

export type MeshContext = {
  geometry?: string
  material?: string

  pipeline?: GPURenderPipeline
}

export type GeometryContext = {
  vertexBuffers: string[]
  indexBuffer?: string

  topology: GPUPrimitiveTopology
  instanceCount: number
  drawRange: { start: number; count: number }
}

export type VertexBufferContext = {
  attribute?: {
    name: string
    type: string
  }
  layout: GPUVertexBufferLayout
  value: TypedArray
  buffer?: GPUBuffer
}

export type IndexBufferContext = {
  value: TypedArray
  buffer?: GPUBuffer
  // arrayStride: number
}

// export type UniformRef = TextureRef | SamplerRef | UniformBufferRef
export type MaterialContext = {
  uniforms: string[]
  shaderCode: string
  cullMode: GPUCullMode
  transparent: boolean
  depthTest: boolean
  depthWrite: boolean
  blending?: GPUBlendState

  bindGroupLayout?: GPUBindGroupLayout
  bindGroupEntries?: GPUBindGroupEntry[]
  bindGroup?: GPUBindGroup
}

export type SamplerContext = {
  descriptor: GPUSamplerDescriptor
  sampler?: GPUSampler
}
export type TextureContext = {
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
  texture?: GPUTexture
}
export type UniformBufferContext = {
  value: TypedArray | ArrayBuffer
  builtIn?: string
  buffer?: GPUBuffer
}
// TODO: external texture ?
export type UniformContext = SamplerContext | TextureContext | UniformBufferContext
