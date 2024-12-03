import type { Mat4, Quat, Vec3 } from 'math'
import type { Accessor, JSX, Signal } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'

export type Optional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>

export type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor

export type TypedArray = InstanceType<TypedArrayConstructor>

// | HTMLVideoElement
export type ImageRepresentation =
  | ImageBitmap
  | ImageData
  | HTMLImageElement
  | VideoFrame
  | HTMLCanvasElement
  | OffscreenCanvas

// export type ExternalTexture ={
//   type: 'externalTexture'
//   descriptor: GPUTextureDescriptor
//   video?: HTMLVideoElement
// }

export type MaybeAccessor<T> = T | Accessor<T>
export type MaybeAccessorValue<T extends MaybeAccessor<unknown>> = T extends () => any ? ReturnType<T> : T

export type StoreContext<T> = [T, SetStoreFunction<T>]

export type NodeRef<T = {}> = StoreContext<T & NodeContext>
export type NodeProps<T = {}> = {
  label?: string
  ref?: (v: NodeRef<T>) => void
  children?: JSX.Element
}
export type NodeContext = {
  type: string[]
  id: string
  label: string
  parent?: string
  children?: string[]
}

export type Object3DExtra = {
  matrix: Signal<Mat4>
  position: Signal<Vec3>
  quaternion: Signal<Quat>
  scale: Signal<Vec3>
  up: Signal<Vec3>
}
export type Object3DContext = NodeContext & Object3DExtra

export type CameraExtra = {
  projectionMatrix: Signal<Mat4>
  viewMatrix: Signal<Mat4>
  projectionViewMatrix: Signal<Mat4>
  // lookAt: (target: Vec3) => void
}
export type CameraContext = Object3DContext & CameraExtra

export type PunctualLightExtra = {
  color: Signal<Vec3>
  intensity: number
  range?: number
  lightType: 'directional' | 'point' | 'spot'
  innerConeAngle: number
  outerConeAngle: number
}
export type PunctualLightContext = Object3DContext & PunctualLightExtra

export type MeshExtra = {
  geometry?: string
  material?: string

  pipeline?: GPURenderPipeline
}
export type MeshContext = Object3DContext & MeshExtra

export type GeometryExtra = {
  vertexBuffers: string[]
  indexBuffer?: string

  topology: GPUPrimitiveTopology
  instanceCount: number
  drawRange: { start: number; count: number }
}
export type GeometryContext = NodeContext & GeometryExtra

export type VertexBufferExtra = {
  attribute?: {
    name: string
    type: string
  }
  layout: GPUVertexBufferLayout
  value: Signal<TypedArray>
  buffer?: GPUBuffer
}
export type VertexBufferContext = NodeContext & VertexBufferExtra

export type IndexBufferExtra = {
  value: Signal<TypedArray>
  buffer?: GPUBuffer
  // arrayStride: number
}
export type IndexBufferContext = NodeContext & IndexBufferExtra

export type MaterialExtra = {
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
export type MaterialContext = NodeContext & MaterialExtra

export type SamplerExtra = {
  descriptor: GPUSamplerDescriptor
  sampler?: GPUSampler
}
export type SamplerContext = NodeContext & SamplerExtra
export type TextureExtra = {
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
  texture?: GPUTexture
}
export type TextureContext = NodeContext & TextureExtra
export type UniformBufferExtra = {
  value: Signal<TypedArray | ArrayBuffer>
  builtIn?: string
  buffer?: GPUBuffer
}
export type UniformBufferContext = NodeContext & UniformBufferExtra
// TODO: external texture ?
export type UniformContext = SamplerContext | TextureContext | UniformBufferContext
