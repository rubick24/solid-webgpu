import type { Mat4, Quat, Vec3 } from 'math'
import type { Accessor, JSX, Setter } from 'solid-js'
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

export const $WGPU_COMPONENT = Symbol('solid-webgpu component')
export type WgpuComponent = {
  [$WGPU_COMPONENT]: true
  id: string
  render: () => JSX.Element
  setSceneCtx: Setter<StoreContext<SceneContext> | undefined>
}
export type NodeRef<T = {}> = T & NodeContext
export type NodeProps<T = {}> = {
  label?: string
  ref?: (v: NodeRef<T>) => void
  children?: JSX.Element
}
export type NodeContext = {
  [$WGPU_COMPONENT]: true
  id: string
  label: string

  scene: Accessor<StoreContext<SceneContext> | undefined>
}
export const isWgpuComponent = (value: unknown): value is Object3DComponent => {
  return !!value && typeof value === 'object' && $WGPU_COMPONENT in value
}

export const $OBJECT3D = Symbol('Object3D')
export type Object3DComponent = WgpuComponent & {
  [$OBJECT3D]: true
  setParentCtx: Setter<StoreContext<Object3DContext> | undefined>
}
export type Object3DExtra = {
  [$OBJECT3D]: true
  matrix: Accessor<Mat4>
  setMatrix: Setter<Mat4>
  position: Accessor<Vec3>
  setPosition: Setter<Vec3>
  quaternion: Accessor<Quat>
  setQuaternion: Setter<Quat>
  scale: Accessor<Vec3>
  setScale: Setter<Vec3>
  up: Accessor<Vec3>
  setUp: Setter<Vec3>
}
export type Object3DContext = NodeContext & Object3DExtra
export const isObject3DComponent = (value: unknown): value is Object3DComponent => {
  return isWgpuComponent(value) && $OBJECT3D in value
}

export const $CAMERA = Symbol('Camera')
export type CameraExtra = {
  [$CAMERA]: true
  projectionMatrix: Accessor<Mat4>
  setProjectionMatrix: Setter<Mat4>
  viewMatrix: Accessor<Mat4>
  setViewMatrix: Setter<Mat4>
  projectionViewMatrix: Accessor<Mat4>
  setProjectionViewMatrix: Setter<Mat4>
}
export type CameraContext = Object3DContext & CameraExtra

export const $PUNCTUAL_LIGHT = Symbol('Camera')
export type PunctualLightExtra = {
  [$PUNCTUAL_LIGHT]: true
  color: Accessor<Vec3>
  setColor: Setter<Vec3>
  intensity: number
  range?: number
  lightType: 'directional' | 'point' | 'spot'
  innerConeAngle: number
  outerConeAngle: number
}
export type PunctualLightContext = Object3DContext & PunctualLightExtra

export const $MESH = Symbol('Mesh')
export type MeshExtra = {
  [$MESH]: true
  geometry?: string
  material?: string

  pipeline?: GPURenderPipeline
}
export type MeshContext = Object3DContext & MeshExtra

export const $GEOMETRY = Symbol('Geometry')
export type GeometryComponent = WgpuComponent & {
  [$GEOMETRY]: true
  setMeshCtx: Setter<StoreContext<MeshContext> | undefined>
}
export const isGeometryComponent = (value: unknown): value is GeometryComponent => {
  return isWgpuComponent(value) && $GEOMETRY in value
}
export type GeometryExtra = {
  [$GEOMETRY]: true
  mesh?: string

  vertexBuffers: string[]
  indexBuffer?: string

  topology: GPUPrimitiveTopology
  instanceCount: number
  drawRange: { start: number; count: number }
}
export type GeometryContext = NodeContext & GeometryExtra

export const $VERTEX_BUFFER = Symbol('VertexBuffer')
export type VertexBufferComponent = WgpuComponent & {
  [$VERTEX_BUFFER]: true
  setGeometryCtx: Setter<StoreContext<GeometryContext> | undefined>
}
export const isVertexBufferComponent = (value: unknown): value is VertexBufferComponent => {
  return isWgpuComponent(value) && $VERTEX_BUFFER in value
}
export type VertexBufferExtra = {
  [$VERTEX_BUFFER]: true
  attribute?: {
    name: string
    type: string
  }
  layout: GPUVertexBufferLayout
  value: Accessor<TypedArray>
  setValue: Setter<TypedArray>
  buffer?: GPUBuffer
}
export type VertexBufferContext = NodeContext & VertexBufferExtra

export const $INDEX_BUFFER = Symbol('IndexBuffer')
export type IndexBufferComponent = WgpuComponent & {
  [$INDEX_BUFFER]: true
  setGeometryCtx: Setter<StoreContext<GeometryContext> | undefined>
}
export const isIndexBufferComponent = (value: unknown): value is IndexBufferComponent => {
  return isWgpuComponent(value) && $INDEX_BUFFER in value
}
export type IndexBufferExtra = {
  [$INDEX_BUFFER]: true
  value: Accessor<TypedArray>
  setValue: Setter<TypedArray>
  buffer?: GPUBuffer
  // arrayStride: number
}
export type IndexBufferContext = NodeContext & IndexBufferExtra

export const $MATERIAL = Symbol('Material')
export type MaterialComponent = WgpuComponent & {
  [$MATERIAL]: true
  setMeshCtx: Setter<StoreContext<MeshContext> | undefined>
}
export const isMaterialComponent = (value: unknown): value is MaterialComponent => {
  return isWgpuComponent(value) && $MATERIAL in value
}
export type MaterialExtra = {
  [$MATERIAL]: true
  mesh?: string

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

export const $SAMPLER = Symbol('Sampler')
export type SamplerComponent = WgpuComponent & {
  [$SAMPLER]: true
  setMaterialCtx: Setter<StoreContext<MaterialContext> | undefined>
}
export const isSamplerComponent = (value: unknown): value is SamplerComponent => {
  return isWgpuComponent(value) && $SAMPLER in value
}
export type SamplerExtra = {
  [$SAMPLER]: true
  descriptor: GPUSamplerDescriptor
  sampler?: GPUSampler
}
export type SamplerContext = NodeContext & SamplerExtra

export const $TEXTURE = Symbol('Texture')
export type TextureComponent = WgpuComponent & {
  [$TEXTURE]: true
  setMaterialCtx: Setter<StoreContext<MaterialContext> | undefined>
}
export const isTextureComponent = (value: unknown): value is TextureComponent => {
  return isWgpuComponent(value) && $TEXTURE in value
}
export type TextureExtra = {
  [$TEXTURE]: true
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
  texture?: GPUTexture
}
export type TextureContext = NodeContext & TextureExtra

export const $UNIFORM_BUFFER = Symbol('UniformBuffer')
export type UniformBufferComponent = WgpuComponent & {
  [$UNIFORM_BUFFER]: true
  setMaterialCtx: Setter<StoreContext<MaterialContext> | undefined>
}
export const isUniformBufferComponent = (value: unknown): value is UniformBufferComponent => {
  return isWgpuComponent(value) && $UNIFORM_BUFFER in value
}
export type UniformBufferExtra = {
  [$UNIFORM_BUFFER]: true
  value: Accessor<TypedArray | ArrayBuffer>
  setValue: Setter<TypedArray | ArrayBuffer>
  builtIn?: string
  buffer?: GPUBuffer
}
export type UniformBufferContext = NodeContext & UniformBufferExtra
// TODO: external texture ?
export type UniformContext = SamplerContext | TextureContext | UniformBufferContext

export const $RENDER_TARGET = Symbol('RenderTarget')
export type RenderTargetComponent = WgpuComponent & {
  [$RENDER_TARGET]: true
}
export type RenderTargetExtra = {
  [$RENDER_TARGET]: true
  colorAttachments: GPURenderPassColorAttachment[]
  depthStencilAttachment?: GPURenderPassDepthStencilAttachment
}
export type RenderTargetContext = NodeContext & RenderTargetExtra

export type SceneContext = {
  nodes: Record<string, NodeContext & Record<string, unknown>>

  width: number
  height: number
  format: GPUTextureFormat
  autoClear: boolean
  samples: number

  device: GPUDevice
  canvas?: HTMLCanvasElement
  context?: GPUCanvasContext

  msaaTexture?: GPUTexture
  msaaTextureView?: GPUTextureView
  depthTexture?: GPUTexture
  depthTextureView?: GPUTextureView

  renderList: string[]
  renderOrder: string[]
  lightList: string[]
  currentCamera?: string
}
