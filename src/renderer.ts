import { Camera } from './camera'
import { ExternalTexture, Sampler, Texture, Uniform } from './material'
import { Mat3, Mat4, Vec3 } from './math'
import { Mesh } from './mesh'
import { Object3D } from './object3d'
import { BufferData, cached } from './utils'

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await _adapter?.requestDevice()

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

export class WebGPURenderer implements WebGPURendererOptions {
  readonly canvas: HTMLCanvasElement
  public device: GPUDevice
  public format: GPUTextureFormat
  public context: GPUCanvasContext

  /**
   * Whether to clear the drawing buffer between renders. Default is `true`.
   */
  public autoClear = true
  /**
   * Number of samples to use for MSAA rendering. Default is `4`
   */
  public samples = 4

  private _msaaTexture!: GPUTexture
  private _msaaTextureView!: GPUTextureView
  private _depthTexture!: GPUTexture
  private _depthTextureView!: GPUTextureView
  private _commandEncoder!: GPUCommandEncoder
  private _passEncoder!: GPURenderPassEncoder

  private _cacheMap = new WeakMap()

  constructor({ canvas, context, format, device }: Partial<WebGPURendererOptions> = {}) {
    this.canvas = canvas ?? document.createElement('canvas')
    this.context = context ?? this.canvas.getContext('webgpu')!
    this.format = format ?? navigator.gpu.getPreferredCanvasFormat()
    this.device = device ?? _device!
    this._resizeSwapchain()
  }

  _cached<T extends WeakKey, U>(
    k: T,
    onCreate: () => U,
    options?: {
      stale?: (old: U) => boolean
    }
  ): U {
    return cached(k, onCreate, {
      ...options,
      cacheMap: this._cacheMap
    })
  }

  _resizeSwapchain() {
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    })
    const size = [this.canvas.width, this.canvas.height]
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

  private _createBuffer(data: BufferData, usage: GPUBufferUsageFlags) {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
      mappedAtCreation: true
    })
    new (data.constructor as Float32ArrayConstructor)(buffer.getMappedRange()).set(data)
    buffer.unmap()
    return buffer
  }

  private _updateSampler(sampler: Sampler) {
    return this._cached(
      sampler,
      () => {
        const target = this.device.createSampler(sampler.descriptor)
        sampler.needsUpdate = false
        return target
      },
      {
        stale: () => sampler.needsUpdate ?? false
      }
    )
  }

  private _updateTexture(texture: Texture | ExternalTexture) {
    return this._cached(
      texture,
      () => {
        const target = this.device.createTexture({
          ...texture.descriptor,
          usage:
            (texture.descriptor.usage ?? 0) |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_SRC
        })
        if ('image' in texture && texture.image) {
          this.device.queue.copyExternalImageToTexture(
            { source: texture.image },
            { texture: target },
            texture.descriptor.size
          )
        }
        texture.needsUpdate = false
        return target
      },
      {
        stale: o => {
          const res = texture.needsUpdate ?? false
          if (res && 'destroy' in o) {
            o.destroy()
          }
          return res
        }
      }
    )
  }

  private _updatePipeline(mesh: Mesh, camera: Camera) {
    const baseUniformBuffer = new Float32Array(73)
    const modelMatrix = Mat4.copy(baseUniformBuffer.subarray(0, 16), mesh.matrix)
    const viewMatrix = Mat4.copy(baseUniformBuffer.subarray(16, 32), camera.viewMatrix)
    // projectionMatrix
    Mat4.copy(baseUniformBuffer.subarray(32, 48), camera.projectionMatrix)
    const modelViewMatrix = Mat4.copy(baseUniformBuffer.subarray(48, 64), viewMatrix)
    Mat4.mul(modelViewMatrix, modelViewMatrix, modelMatrix)
    // normalMatrix
    Mat3.normalFromMat4(baseUniformBuffer.subarray(64, 73), modelViewMatrix)

    // TODO: check update here?
    const uniforms: Uniform[] = [
      {
        type: 'buffer',
        value: baseUniformBuffer
      },
      ...mesh.material.uniforms
    ]

    const transparent = mesh.material.transparent
    const cullMode = mesh.material.cullMode
    const topology = mesh.topology
    const depthWriteEnabled = mesh.material.depthWrite
    const depthCompare = (mesh.material.depthTest ? 'less' : 'always') as GPUCompareFunction
    const blending = mesh.material.blending
    const colorAttachments = 1
    const samples = this.samples

    const vertexBufferLayouts = mesh.geometry.vertexBuffers.map(v => v.layout)
    const pipelineCacheKey = JSON.stringify([
      transparent,
      cullMode,
      topology,
      depthWriteEnabled,
      depthCompare,
      vertexBufferLayouts,
      blending,
      colorAttachments,
      samples
    ])

    // uniform
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: uniforms.map((v, i) => {
        if (v.type === 'buffer') {
          return {
            binding: i,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {}
          }
        } else if (v.type === 'texture' || v.type === 'externalTexture') {
          return {
            binding: i,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {}
          }
        } else {
          // sampler
          return {
            binding: i,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {}
          }
        }
      })
    })
    const entries: GPUBindGroupEntry[] = uniforms.map((v, i) => {
      if (v.type === 'buffer') {
        const buffer = this._cached(v, () => this._createBuffer(v.value, GPUBufferUsage.UNIFORM))
        return { binding: i, resource: { buffer } }
      } else if (v.type === 'texture' || v.type === 'externalTexture') {
        const texture = this._updateTexture(v)
        return {
          binding: i,
          resource: 'createView' in texture ? texture.createView() : texture
        }
      } else {
        const sampler = this._updateSampler(v)
        return { binding: i, resource: sampler }
      }
    })

    // pipeline
    const pipeline = this._cached(
      mesh,
      () => {
        const shaderModule = this.device.createShaderModule({ code: mesh.material.shaderCode })

        return this.device.createRenderPipeline({
          layout: this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
          }),
          label: pipelineCacheKey,
          vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: vertexBufferLayouts
          },
          fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [
              {
                format: this.format
              }
            ]
          },
          primitive: {
            frontFace: 'ccw',
            cullMode,
            topology
          },
          depthStencil: {
            depthWriteEnabled,
            depthCompare,
            format: 'depth24plus-stencil8'
          },
          multisample: { count: samples }
        })
      },
      {
        stale: o => o.label !== pipelineCacheKey
      }
    )
    this._passEncoder.setPipeline(pipeline)

    const ib = mesh.geometry.indexBuffer
    if (ib) {
      const buffer = this._cached(ib, () => {
        return this._createBuffer(ib, GPUBufferUsage.INDEX)
      })
      this._passEncoder.setIndexBuffer(buffer, `uint${ib.BYTES_PER_ELEMENT * 8}` as GPUIndexFormat)
    }
    mesh.geometry.vertexBuffers.forEach((vb, i) => {
      const buffer = this._cached(vb, () => {
        vb.needsUpdate = false
        return this._createBuffer(vb.buffer, GPUBufferUsage.INDEX)
      })

      if (vb.needsUpdate) {
        const data = vb.buffer
        this.device.queue.writeBuffer(buffer, data.byteOffset, data, 0, data.length)
        vb.needsUpdate = false
      }
      this._passEncoder.setVertexBuffer(i, buffer)
    })

    if (entries.length) {
      const bindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries
      })
      this._passEncoder.setBindGroup(0, bindGroup)
    }
  }

  /**
   * Returns a list of visible meshes. Will frustum cull and depth-sort with a camera if available.
   */
  sort(scene: Object3D, camera?: Camera): Mesh[] {
    const renderList: Mesh[] = []

    if (camera?.matrixAutoUpdate) {
      camera.projectionViewMatrix.copy(camera.projectionMatrix).multiply(camera.viewMatrix)
      // camera.frustum.fromMatrix4(camera.projectionViewMatrix)
      // camera.frustum.normalNDC()
    }

    scene.traverse(node => {
      // Skip invisible nodes
      if (!node.visible) return true

      // Filter to meshes
      if (!(node instanceof Mesh)) return

      // Frustum cull if able
      // if (camera && node.frustumCulled) {
      //   const inFrustum = camera.frustum.contains(node)
      //   if (!inFrustum) return true
      // }

      renderList.push(node)
    })

    return renderList.sort((a, b) => {
      // Push UI to front
      let res = (b.material.depthTest as unknown as number) - (a.material.depthTest as unknown as number)

      // Depth sort with a camera if able
      if (!!camera) {
        Vec3.set(tempVec3, b.matrix[12], b.matrix[13], b.matrix[14])
        Vec3.transformMat4(tempVec3, tempVec3, camera.projectionViewMatrix)
        const tempZ = tempVec3.z
        Vec3.set(tempVec3, a.matrix[12], a.matrix[13], a.matrix[14])
        Vec3.transformMat4(tempVec3, tempVec3, camera.projectionViewMatrix)
        res = res || tempZ - tempVec3.z
      }
      // Reverse painter's sort transparent
      res = res || (a.material.transparent as unknown as number) - (b.material.transparent as unknown as number)
      return res
    })
  }

  render(scene: Object3D, camera: Camera) {}
}

const tempVec3 = Vec3.create()
