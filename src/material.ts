export type Uniform = number | number[] | Float32Array | GPUTexture


export type BlendOperation = 'add' | 'subtract' | 'reverse-subtract' | 'min' | 'max'

export type BlendFactor =
  | 'zero'
  | 'one'
  | 'src'
  | 'one-minus-src'
  | 'src-alpha'
  | 'one-minus-src-alpha'
  | 'dst'
  | 'one-minus-dst'
  | 'dst-alpha'
  | 'one-minus-dst-alpha'
  | 'src-alpha-saturated'
  | 'constant'
  | 'one-minus-constant'

/**
 * Describes blending between a material and a color buffer's components.
 */
export interface BlendComponent {
  /**
   * The {@link BlendOperation} to use when applying blending.
   */
  operation?: BlendOperation
  /**
   * The {@link BlendFactor} to be used on values from the fragment shader.
   */
  srcFactor?: BlendFactor
  /**
   * The {@link BlendFactor} to be used on values to a color buffer.
   */
  dstFactor?: BlendFactor
}

/**
 * How a material should blend into a color buffer and its components.
 */
export interface Blending {
  /**
   * The {@link BlendComponent} to use for color values.
   */
  color: BlendComponent
  /**
   * The {@link BlendComponent} to use for alpha values.
   */
  alpha: BlendComponent
}

/**
 * {@link Material} constructor parameters. Accepts shaders, their uniforms, and various blending & culling options.
 */
export interface MaterialOptions {
  /**
   * User-defined program uniforms.
   */
  uniforms?: Record<string, Uniform>
  /**
   * Stringified vertex shader code.
   */
  vertex: string
  /**
   * Stringified fragment shader code.
   */
  fragment: string
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
  blending?: Blending
}

export class Material implements MaterialOptions {
  readonly uniforms: Record<string, Uniform> = {}
  public vertex!: string
  public fragment!: string
  public cullMode: GPUCullMode = 'back'
  public transparent = false
  public depthTest = true
  public depthWrite = true
  public blending?: Blending

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

  /**
   * Disposes material from GPU memory.
   */
  dispose(): void {
    // Implemented by renderer
  }
}
