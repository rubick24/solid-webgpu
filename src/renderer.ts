import { Uniform } from './material'
import { Collection } from './utils'
import { Attribute, AttributeData } from './geometry'
import { Geometry } from './geometry'
import { Material } from './material'
import { Mesh } from './mesh'
import { Vec3 } from './math'

// GPUSamplerDescriptor

// type GPUFilterMode
// export type Filter = 'nearest' | 'linear'

// type GPUFrontFace = 'ccw' | 'cw'
// GPUCullMode
// const GPU_CULL_SIDES: Record<Side, string> = {
//   front: 'back',
//   back: 'front',
//   both: 'none'
// } as const

// GPUPrimitiveTopology
// const GPU_DRAW_MODES: Record<Mode, string> = {
//   points: 'point-list',
//   lines: 'line-list',
//   triangles: 'triangle-list'
// } as const

// GPUAddressMode
// const GPU_WRAPPING: Record<Wrapping, string> = {
//   clamp: 'clamp-to-edge',
//   repeat: 'repeat',
//   mirror: 'mirror-repeat'
// }

// Pad to 16 byte chunks of 2, 4 (std140 layout)
const pad2 = (n: number) => n + (n % 2)
const pad4 = (n: number) => n + ((4 - (n % 4)) % 4)

/**
 * Packs uniforms into a std140 compliant array buffer.
 */
function std140(uniforms: Uniform[], buffer?: Float32Array): Float32Array {
  const values = uniforms as Exclude<Uniform, GPUTexture>[]

  // Init buffer
  let offset = 0
  if (!buffer) {
    for (const value of values) {
      if (typeof value === 'number') {
        offset++ // leave empty space to stack primitives
      } else {
        const pad = value.length <= 2 ? pad2 : pad4
        offset = pad(offset) // fill in empty space
        offset += pad(value.length)
      }
    }
    offset = pad4(offset) // align to 4 bytes
    buffer = new Float32Array(offset)
  }

  // Pack buffer
  offset = 0
  for (const value of values) {
    if (typeof value === 'number') {
      buffer[offset++] = value
    } else {
      const pad = value.length <= 2 ? pad2 : pad4
      buffer.set(value, (offset = pad(offset)))
      offset += pad(value.length)
    }
  }

  return buffer
}

// /**
//  * Returns a list of used uniforms from shader uniform structs.
//  */
// function parseUniforms(...shaders: string[]): string[] | undefined {
//   shaders = shaders.filter(Boolean)

//   // Filter to most complete definition
//   if (shaders.length > 1) {
//     const definitions = shaders.map(shader => parseUniforms(shader))
//     return definitions.filter(Boolean).sort((a: any, b: any) => b.length - a.length)[0]
//   }

//   // Remove comments for parsing
//   const shader = shaders[0].replace(/\/\*(?:[^*]|\**[^*/])*\*+\/|\/\/.*/g, '')

//   // Detect and parse shader layout
//   const selector = shader.match(/var\s*<\s*uniform\s*>[^;]+(?:\s|:)(\w+);/)?.[1]
//   const layout = shader.match(new RegExp(`${selector}[^\\{]+\\{([^\\}]+)\\}`))?.[1]

//   // Parse definitions
//   if (layout) return Array.from(layout.match(/\w+(?=[;:])/g)!)
// }

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await (_adapter as GPUAdapter | null)?.requestDevice()

export interface WebGPURendererOptions {
  /**
   * An optional {@link HTMLCanvasElement} to draw to.
   */
  canvas: HTMLCanvasElement
  /**
   * An optional {@link GPUCanvasContext} to draw with.
   */
  context: GPUCanvasContext
  /**
   * An optional {@link GPUDevice} to send GPU commands to.
   */
  device: GPUDevice
  /**
   * An optional {@link GPUTextureFormat} to create texture views with.
   */
  format: GPUTextureFormat
}

/**
 * Constructs a WebGPU renderer object. Can be extended to draw to a canvas.
 */
export class WebGPURenderer {
  /**
   * Output {@link HTMLCanvasElement} to draw to.
   */
  readonly canvas: HTMLCanvasElement
  /**
   * Internal {@link GPUDevice} to send GPU commands to.
   */
  public device!: GPUDevice
  /**
   * Internal {@link GPUTextureFormat} to create texture views with.
   */
  public format!: GPUTextureFormat
  /**
   * Internal {@link GPUCanvasContext} to draw with.
   */
  public context!: GPUCanvasContext
  /**
   * Whether to clear the drawing buffer between renders. Default is `true`.
   */
  public autoClear = true
  /**
   * Number of samples to use for MSAA rendering. Default is `4`
   */
  public samples = 4

  private _buffers = new Collection<Attribute, GPUBuffer>()
  private _geometry = new Collection<Geometry, true>()
  private _UBOs = new Collection<Material, { data: Float32Array; buffer: GPUBuffer }>()
  private _pipelines = new Collection<Mesh, GPURenderPipeline | GPUComputePipeline>()
  // private _textures = new Collection<Texture, GPUTexture | GPUExternalTexture>()
  // private _FBOs = new Collection<
  //   RenderTarget,
  //   { views: GPUTextureView[]; depthTexture: GPUTexture; depthTextureView: GPUTextureView }
  // >()
  private _msaaTexture!: GPUTexture
  private _msaaTextureView!: GPUTextureView
  private _depthTexture!: GPUTexture
  private _depthTextureView!: GPUTextureView
  private _commandEncoder!: GPUCommandEncoder
  private _passEncoder!: GPURenderPassEncoder | GPUComputePassEncoder
  // private _renderTarget: RenderTarget | null = null
  private _v = Vec3.create()

  constructor({ canvas, context, format, device }: Partial<WebGPURendererOptions> = {}) {
    this.canvas = canvas ?? document.createElement('canvas')
    this.context = context ?? this.canvas.getContext('webgpu')!
    this.format = format ?? navigator.gpu.getPreferredCanvasFormat()
    this.device = device ?? _device!
    this._resizeSwapchain()
  }

  private _resizeSwapchain(): void {
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    })

    const size = [this.canvas.width, this.canvas.height, 1]
    const usage = GPUTextureUsage.RENDER_ATTACHMENT
    const sampleCount = this.samples

    if (this._msaaTexture) this._msaaTexture.destroy()
    this._msaaTexture = this.device.createTexture({
      format: this.format,
      size,
      usage,
      sampleCount
    })
    this._msaaTextureView = this._msaaTexture.createView()

    if (this._depthTexture) this._depthTexture.destroy()
    this._depthTexture = this.device.createTexture({
      format: 'depth24plus-stencil8',
      size,
      usage,
      sampleCount
    })
    this._depthTextureView = this._depthTexture.createView()
  }

  /**
   * Sets the canvas size.
   */
  setSize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this._resizeSwapchain()
  }

  private _createBuffer(data: AttributeData, usage: GPUBufferUsageFlags): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
      mappedAtCreation: true
    })

    new (data.constructor as Float32ArrayConstructor)(buffer.getMappedRange()).set(data)
    buffer.unmap()

    return buffer
  }

  private _writeBuffer(
    buffer: GPUBuffer,
    data: AttributeData,
    byteLength = data.byteLength,
    srcByteOffset = 0,
    dstByteOffset = data.byteOffset
  ): void {
    const size = data.BYTES_PER_ELEMENT
    this.device.queue.writeBuffer(buffer, dstByteOffset, data, srcByteOffset / size, byteLength / size)
  }
}
