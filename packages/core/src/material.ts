import { Optional, TypedArray, Updatable } from './utils'

// needsUpdate

// | HTMLVideoElement
export type ImageRepresentation =
  | ImageBitmap
  | ImageData
  | HTMLImageElement
  | VideoFrame
  | HTMLCanvasElement
  | OffscreenCanvas

export type UniformBuffer = Updatable<{ type: 'buffer'; value: TypedArray | ArrayBuffer }>

export type Texture = Updatable<{
  type: 'texture'
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
}>

export type ExternalTexture = Updatable<{
  type: 'externalTexture'
  descriptor: GPUTextureDescriptor
  video?: HTMLVideoElement
}>

export type Sampler = Updatable<{ type: 'sampler'; descriptor: GPUSamplerDescriptor }>

export type BuiltinUniformType = 'base' | 'punctual_lights'
export type BuiltinUniform<T extends BuiltinUniformType = BuiltinUniformType> = { builtin_type: T }
export type BuiltinUniformInternal<T extends BuiltinUniformType = BuiltinUniformType> = BuiltinUniform<T> &
  {
    base: UniformBuffer
    punctual_lights: UniformBuffer
  }[T]

export type Uniform = UniformBuffer | Texture | ExternalTexture | Sampler | BuiltinUniform
export type UniformInternal = UniformBuffer | Texture | ExternalTexture | Sampler | BuiltinUniformInternal

/**
 * {@link Material} constructor parameters. Accepts shaders, their uniforms, and various blending & culling options.
 */
export interface MaterialOptions {
  uniforms?: Uniform[]
  /**
   * Stringified vertex shader code.
   */
  shaderCode: string
  /**
   * cull mode
   */
  cullMode?: GPUCullMode
  /**
   * Whether the material should support transparent rendering. Default is `false`.
   */
  transparent?: boolean
  /**
   * Whether the material should be affected by depth or distance from view. Default is `true`.
   */
  depthTest?: boolean
  /**
   * Whether the material should contribute to world depth and occlude objects. Default is `true`.
   */
  depthWrite?: boolean
  /**
   * How the material should blend into a color buffer and its components.
   */
  blending?: GPUBlendState
}

export class Material implements MaterialOptions {
  readonly uniforms: Uniform[] = []
  public shaderCode!: string
  public cullMode: GPUCullMode = 'back'
  public transparent = false
  public depthTest = true
  public depthWrite = true
  public blending?: GPUBlendState

  constructor(options?: MaterialOptions) {
    if (options?.transparent) {
      this.blending = {
        color: {
          operation: 'add',
          srcFactor: 'src-alpha',
          dstFactor: 'one-minus-src-alpha'
        },
        alpha: {
          operation: 'add',
          srcFactor: 'one',
          dstFactor: 'one-minus-src-alpha'
        }
      }
    }

    Object.assign(this, options)
  }
}

export type MaterialConstructor = typeof Material
