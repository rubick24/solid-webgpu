import { Camera } from './camera'
import { BuiltinUniformInternal, ExternalTexture, Sampler, Texture, UniformInternal } from './material'
import { Mat3, Mat4, Vec3 } from './math'
import { Mesh } from './mesh'
import { Object3D } from './object3d'
import { PunctualLight } from './punctual_light'
import { MultipleKeyWeakMap, TypedArray, weakCached } from './utils'

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

  private _cacheMap = new Map<string, MultipleKeyWeakMap<unknown>>()

  constructor({ canvas, context, format, device }: Partial<WebGPURendererOptions> = {}) {
    this.canvas = canvas ?? document.createElement('canvas')
    this.context = context ?? this.canvas.getContext('webgpu')!
    this.format = format ?? navigator.gpu.getPreferredCanvasFormat()
    this.device = device ?? _device!
    this._resizeSwapchain()
  }

  _cached<V>(
    keys: WeakKey[],
    onCreate: () => V,
    options?: {
      space?: string
      stale?: (old: V) => boolean
    }
  ): V {
    const space = options?.space ?? ''
    let cache = this._cacheMap.get(space)
    if (!cache) {
      cache = new MultipleKeyWeakMap()
      this._cacheMap.set(space, cache)
    }

    return weakCached([this, ...keys], onCreate, {
      ...options,
      cacheMap: cache as MultipleKeyWeakMap<V>
    })
  }

  _resizeSwapchain() {
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    })
    const size = [this.canvas.width, this.canvas.height]
    const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
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

  private _createBuffer(data: TypedArray | ArrayBuffer, usage: GPUBufferUsageFlags, label?: string) {
    const buffer = this.device.createBuffer({
      label,
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    })
    this.device.queue.writeBuffer(buffer, 0, data)
    return buffer
  }

  private _updateSampler(sampler: Sampler) {
    return this._cached(
      [sampler],
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
      [texture],
      () => {
        const target = this.device.createTexture({
          ...texture.descriptor,
          format: texture.descriptor.format ?? this.format,
          usage:
            (texture.descriptor.usage ?? 0) |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.COPY_DST
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

  private _updatePipeline(mesh: Mesh, camera: Camera, lightList: PunctualLight[]) {
    /**
     * uniform setup
     */
    const { uniforms, bindGroupLayout } = this._cached([mesh.material], () => {
      const uniforms = mesh.material.uniforms.map(v => {
        if ('builtin_type' in v) {
          if (v.builtin_type === 'base') {
            const baseUniformBuffer = new Float32Array(80)
            return {
              builtin_type: 'base',
              type: 'buffer',
              value: baseUniformBuffer
            } satisfies BuiltinUniformInternal<'base'>
          } else if (v.builtin_type === 'punctual_lights') {
            const baseUniformBuffer = new Float32Array(16 * 4)
            return {
              builtin_type: 'punctual_lights',
              type: 'buffer',
              value: baseUniformBuffer
            } satisfies BuiltinUniformInternal<'punctual_lights'>
          }
        }
        return v
      }) as UniformInternal[]
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
      return { uniforms, bindGroupLayout }
    })

    /**
     * update built-in uniform
     */
    for (const uniform of uniforms) {
      if ('builtin_type' in uniform) {
        if (uniform.builtin_type === 'base') {
          const bo = uniform.value as Float32Array
          const modelMatrix = Mat4.copy(bo.subarray(0, 16), mesh.matrix)
          const viewMatrix = Mat4.copy(bo.subarray(16, 32), camera.viewMatrix)
          // projectionMatrix
          Mat4.copy(bo.subarray(32, 48), camera.projectionMatrix)
          const modelViewMatrix = Mat4.copy(bo.subarray(48, 64), viewMatrix)
          Mat4.mul(modelViewMatrix, modelViewMatrix, modelMatrix)
          // normalMatrix
          Mat3.normalFromMat4(bo.subarray(64, 73), modelViewMatrix)
          // cameraPosition
          Vec3.copy(bo.subarray(76, 79), camera.matrix.subarray(12, 15))
          uniform.needsUpdate = true
        } else if (uniform.builtin_type === 'punctual_lights') {
          const lightValues = uniform.value as Float32Array
          for (let i = 0; i < lightList.length; i++) {
            const light = lightList[i]
            const offset = i * 16
            if (lightValues.length < offset + 16) {
              console.warn('extra lights are ignored')
              break
            }
            // position
            Vec3.copy(lightValues.subarray(offset + 0, offset + 3), light.matrix.subarray(12, 15))
            // direction
            Vec3.copy(lightValues.subarray(offset + 4, offset + 7), light.matrix.subarray(8, 11))
            Vec3.copy(lightValues.subarray(offset + 8, offset + 11), light.color)

            lightValues[offset + 11] = light.intensity
            lightValues[offset + 12] = light.range ?? Infinity
            lightValues[offset + 13] = light.innerConeAngle
            lightValues[offset + 14] = light.outerConeAngle

            const m: Record<typeof light.type, number> = {
              directional: 1,
              point: 2,
              spot: 3
            }

            // if (offset === 16) {
            //   console.log(m[light.type])
            // }
            new DataView(lightValues.buffer).setUint32((offset + 15) * 4, m[light.type], true)
          }
          uniform.needsUpdate = true
        }
      }
    }

    /**
     * uniform binding
     */
    const bindGroupEntries: GPUBindGroupEntry[] = uniforms.map((uniform, i) => {
      if (uniform.type === 'buffer') {
        const buffer = this._cached([uniform], () =>
          this._createBuffer(uniform.value, GPUBufferUsage.UNIFORM, `uniform ${i} ${uniform.type}`)
        )
        if (uniform.needsUpdate) {
          const data = uniform.value
          this.device.queue.writeBuffer(buffer, 'byteOffset' in data ? data.byteOffset : 0, data)
          uniform.needsUpdate = false
        }
        return { binding: i, resource: { buffer } }
      } else if (uniform.type === 'texture' || uniform.type === 'externalTexture') {
        const texture = this._updateTexture(uniform)
        return {
          binding: i,
          resource: 'createView' in texture ? texture.createView() : texture
        }
      } else {
        const sampler = this._updateSampler(uniform)
        return { binding: i, resource: sampler }
      }
    })

    /**
     * pipeline setup
     */
    const pipelineOption = {
      transparent: mesh.material.transparent,
      cullMode: mesh.material.cullMode,
      topology: mesh.geometry.topology,
      depthWriteEnabled: mesh.material.depthWrite,
      depthCompare: (mesh.material.depthTest ? 'less' : 'always') as GPUCompareFunction,
      vertexBufferLayouts: mesh.geometry.vertexBuffers.map(v => v.layout),
      blending: mesh.material.blending,
      colorAttachments: 1,
      samples: this.samples
    }
    const pipelineCacheKey = JSON.stringify(pipelineOption)
    const pipeline = this._cached(
      [mesh],
      () => {
        let code = mesh.material.shaderCode
        /**
         * set builtin vertexInput if defined in vertexBuffer
         */
        const vertexInputStr = mesh.geometry.vertexBuffers
          .filter(v => v.attribute?.name && builtinAttributeNames.includes(v.attribute?.name))
          .map((v, i) => `  @location(${i}) ${v.attribute!.name}: ${v.attribute!.type}`)
          .join(',\n')
        if (vertexInputStr) {
          const old = code.match(/^struct VertexInput {\n(.|\n)*?}/)?.[0]
          const rep = `struct VertexInput {\n${vertexInputStr}\n}`
          code = old?.length ? code.replace(old, rep) : rep + '\n' + code
        }

        const shaderModule = this.device.createShaderModule({ code })

        return this.device.createRenderPipeline({
          layout: this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
          }),
          label: pipelineCacheKey,
          vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: pipelineOption.vertexBufferLayouts
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
            cullMode: mesh.material.cullMode,
            topology: mesh.geometry.topology
          },
          depthStencil: {
            depthWriteEnabled: pipelineOption.depthWriteEnabled,
            depthCompare: pipelineOption.depthCompare,
            format: 'depth24plus-stencil8'
          },
          multisample: { count: pipelineOption.samples }
        })
      },
      {
        stale: o => o.label !== pipelineCacheKey
      }
    )
    this._passEncoder.setPipeline(pipeline)

    const ib = mesh.geometry.indexBuffer
    if (ib) {
      const buffer = this._cached([ib], () => {
        return this._createBuffer(ib.buffer, GPUBufferUsage.INDEX)
      })
      this._passEncoder.setIndexBuffer(buffer, `uint${ib.buffer.BYTES_PER_ELEMENT * 8}` as GPUIndexFormat)
    }
    mesh.geometry.vertexBuffers.forEach((vb, i) => {
      const buffer = this._cached([vb], () => {
        vb.needsUpdate = false
        return this._createBuffer(vb.buffer, GPUBufferUsage.VERTEX)
      })

      if (vb.needsUpdate) {
        const data = vb.buffer
        this.device.queue.writeBuffer(buffer, data.byteOffset, data)
        vb.needsUpdate = false
      }
      this._passEncoder.setVertexBuffer(i, buffer)
    })

    if (bindGroupEntries.length) {
      const bindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries: bindGroupEntries
      })
      this._passEncoder.setBindGroup(0, bindGroup)
    }
  }

  /**
   * Returns a list of visible meshes. Will frustum cull and depth-sort with a camera if available.
   */
  sort(
    scene: Object3D,
    camera?: Camera
  ): {
    renderList: Mesh[]
    lightList: PunctualLight[]
  } {
    const renderList: Mesh[] = []
    const lightList: PunctualLight[] = []

    if (camera?.matrixAutoUpdate) {
      camera.projectionViewMatrix.copy(camera.projectionMatrix).multiply(camera.viewMatrix)
      // camera.frustum.fromMatrix4(camera.projectionViewMatrix)
    }

    scene.traverse(node => {
      // Skip invisible nodes
      if (!node.visible) return true

      // Filter to meshes
      if (node instanceof PunctualLight) {
        lightList.push(node)
      } else if (node instanceof Mesh) {
        // TODO: Frustum cull if able
        // if (camera && node.frustumCulled) {
        //   const inFrustum = camera.frustum.contains(node)
        //   if (!inFrustum) return true
        // }
        renderList.push(node)
      }
    })

    renderList.sort((a, b) => {
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

    return { renderList, lightList }
  }

  render(scene: Object3D, camera: Camera) {
    // FBO and render target?

    const samples = this.samples
    if (this._msaaTexture.sampleCount !== samples) {
      this._resizeSwapchain()
    }

    const renderViews = [this._msaaTextureView]
    const resolveTarget = this.context.getCurrentTexture().createView()
    const loadOp: GPULoadOp = this.autoClear ? 'clear' : 'load'
    const storeOp: GPUStoreOp = 'store'
    this._commandEncoder = this.device.createCommandEncoder()
    const colorAttachments = renderViews.map<GPURenderPassColorAttachment>(view => ({
      view,
      resolveTarget,
      loadOp,
      storeOp,
      clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
    }))
    this._passEncoder = this._commandEncoder.beginRenderPass({
      colorAttachments,
      depthStencilAttachment: {
        view: this._depthTextureView,
        depthClearValue: 1,
        depthLoadOp: loadOp,
        depthStoreOp: storeOp,
        stencilClearValue: 0,
        stencilLoadOp: loadOp,
        stencilStoreOp: storeOp
      }
    })
    this._passEncoder.setViewport(0, 0, this.canvas.width, this.canvas.height, 0, 1)

    scene.updateMatrix()
    camera?.updateMatrix()

    const { renderList, lightList } = this.sort(scene, camera)
    for (const node of renderList) {
      this._updatePipeline(node, camera, lightList)

      const indexBuffer = node.geometry.indexBuffer
      const position = node.geometry.vertexBuffers[0]

      // Alternate drawing for indexed and non-indexed children
      if (indexBuffer) {
        const count = Math.min(node.geometry.drawRange.count, indexBuffer.buffer.length)
        this._passEncoder.drawIndexed(count, node.geometry.instanceCount, node.geometry.drawRange.start ?? 0)
      } else if (position) {
        const count = Math.min(node.geometry.drawRange.count, position.buffer.length / position.layout.arrayStride)
        this._passEncoder.draw(count, node.geometry.instanceCount, node.geometry.drawRange.start ?? 0)
      } else {
        this._passEncoder.draw(3, node.geometry.instanceCount)
      }
    }
    this._passEncoder.end()
    this.device.queue.submit([this._commandEncoder.finish()])
  }
}

const tempVec3 = Vec3.create()
const builtinAttributeNames = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']
