import { BufferData } from './utils'

export type Uniform = BufferData | GPUTexture | GPUSampler

/**
 * {@link Material} constructor parameters. Accepts shaders, their uniforms, and various blending & culling options.
 */
export interface MaterialOptions {
  /**
   * User-defined program uniforms.
   */
  readonly uniforms?: Uniform[]
  /**
   * Stringified vertex shader code.
   */
  readonly vertex: string
  /**
   * Stringified fragment shader code.
   */
  readonly fragment: string
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
  public vertex!: string
  public fragment!: string
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
