import { Mat3, Mat4, Vec3 } from 'math'
import { batch, children, createEffect, createMemo, JSX, mapArray, onCleanup } from 'solid-js'

import { createStore } from 'solid-js/store/types/server.js'
import {
  CameraRef,
  isWgpuComponent,
  MaybeAccessor,
  MeshRef,
  Optional,
  PunctualLightRef,
  SceneContext,
  TypedArray
} from './types'
import { access, isAccessor } from './utils'

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
export const device = await _adapter?.requestDevice()!

export const createBuffer = (options: MaybeAccessor<GPUBufferDescriptor>) =>
  createMemo(() => {
    const buffer = device.createBuffer(access(options))
    onCleanup(() => buffer.destroy())
    return buffer
  })

export const createBufferFromValue = (
  options: MaybeAccessor<Omit<GPUBufferDescriptor, 'size'>>,
  value: MaybeAccessor<TypedArray | ArrayBuffer>
) => {
  if (!isAccessor(value) && !isAccessor(options)) {
  }
  const buffer = createBuffer(() => ({
    size: access(value).byteLength,
    ...access(options)
  }))

  createEffect(() => {
    const val = access(value)
    device.queue.writeBuffer(buffer(), 0, val)
  })
  return buffer
}

export const createTexture = (options: MaybeAccessor<GPUTextureDescriptor>) =>
  createMemo<GPUTexture>(() => {
    const v = device.createTexture(access(options))
    onCleanup(() => v.destroy())
    return v
  })
export const createTextureFromImage = (
  options: MaybeAccessor<Optional<Omit<GPUTextureDescriptor, 'size'>, 'usage'>>,
  image: MaybeAccessor<ImageBitmap>
) => {
  const img = access(image)
  const size = { width: img.width, height: img.height }
  const ops = access(options)
  const texture = createTexture(() => ({
    ...ops,
    usage:
      (ops.usage ?? 0) |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST,
    size
  }))

  createEffect(() => {
    const img = access(image)
    const size = { width: img.width, height: img.height }
    device.queue.copyExternalImageToTexture({ source: img }, { texture: texture() }, size)
  })
  return texture
}

export const createSampler = (options?: MaybeAccessor<GPUSamplerDescriptor>) =>
  createMemo<GPUSampler>(() => device.createSampler(access(options)))

const builtInBufferLength = {
  base: 80,
  punctual_lights: 16 * 4
} as const

export const createUniformBufferBase = () => {
  const val = new Float32Array(builtInBufferLength.base)
  const buffer = device.createBuffer({
    size: val.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(buffer, 0, val)

  const update = (ref: MeshRef) => {
    const scene = ref.scene()?.[0]
    if (!scene) {
      return
    }
    const cameraID = scene.currentCamera
    if (!cameraID) {
      return
    }

    const camera = scene.nodes[cameraID] as CameraRef
    const modelMatrix = Mat4.copy(val.subarray(0, 16), ref.matrix())
    const viewMatrix = Mat4.copy(val.subarray(16, 32), camera.viewMatrix())
    // projectionMatrix
    Mat4.copy(val.subarray(32, 48), camera.projectionMatrix())
    const modelViewMatrix = Mat4.copy(val.subarray(48, 64), viewMatrix)
    Mat4.mul(modelViewMatrix, modelViewMatrix, modelMatrix)
    // normalMatrix
    Mat3.normalFromMat4(val.subarray(64, 73), modelViewMatrix)
    // cameraPosition
    Vec3.copy(val.subarray(76, 79), camera.matrix().subarray(12, 15))

    device.queue.writeBuffer(buffer, 0, val)
  }

  return { buffer, update }
}

export const createUniformBufferPunctualLights = () => {
  const lightValues = new Float32Array(builtInBufferLength.punctual_lights)
  const buffer = device.createBuffer({
    size: lightValues.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(buffer, 0, lightValues)

  const update = (ref: MeshRef) => {
    const scene = ref?.scene()?.[0]
    if (!scene) {
      return
    }
    const { lightList } = scene
    for (let i = 0; i < lightList.length; i++) {
      const lightID = lightList[i]
      const light = scene.nodes[lightID] as PunctualLightRef

      const offset = i * 16
      if (lightValues.length < offset + 16) {
        console.warn('extra lights are ignored')
        break
      }
      // position
      Vec3.copy(lightValues.subarray(offset + 0, offset + 3), light.matrix().subarray(12, 15))
      // direction
      Vec3.copy(lightValues.subarray(offset + 4, offset + 7), light.matrix().subarray(8, 11))
      Vec3.copy(lightValues.subarray(offset + 8, offset + 11), light.color())

      lightValues[offset + 11] = light.intensity
      lightValues[offset + 12] = light.range ?? Infinity
      lightValues[offset + 13] = light.innerConeAngle
      lightValues[offset + 14] = light.outerConeAngle

      const m: Record<typeof light.lightType, number> = {
        directional: 1,
        point: 2,
        spot: 3
      }

      new DataView(lightValues.buffer).setUint32((offset + 15) * 4, m[light.lightType], true)
    }

    device.queue.writeBuffer(buffer, 0, lightValues)
  }

  return { buffer, update }
}

export const createBindGroupLayoutDescriptor = (uniforms: MaybeAccessor<(GPUTexture | GPUSampler | GPUBuffer)[]>) =>
  createMemo<GPUBindGroupLayoutDescriptor>(prev => {
    const us = access(uniforms)
    if (
      prev &&
      us.every((u, i) => {
        const p = (prev.entries as GPUBindGroupLayoutEntry[])[i]
        return (
          (p.texture && u instanceof GPUTexture) ||
          (p.sampler && u instanceof GPUSampler) ||
          (p.buffer && u instanceof GPUBuffer)
        )
      })
    )
      return prev

    return {
      entries: us.map((u, index) => {
        return {
          binding: index,
          visibility:
            u instanceof GPUBuffer ? GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT : GPUShaderStage.FRAGMENT,
          ...{
            texture: u instanceof GPUTexture ? {} : undefined,
            sampler: u instanceof GPUSampler ? {} : undefined,
            buffer: u instanceof GPUBuffer ? {} : undefined
          }
        }
      })
    }
  })

export const createBindGroupLayout = (uniforms: MaybeAccessor<(GPUTexture | GPUSampler | GPUBuffer)[]>) => {
  const descriptor = createBindGroupLayoutDescriptor(uniforms)
  return createMemo<GPUBindGroupLayout>(() => device.createBindGroupLayout(access(descriptor)))
}

export const createBindGroupEntries = (uniforms: MaybeAccessor<(GPUTexture | GPUSampler | GPUBuffer)[]>) =>
  createMemo<GPUBindGroupEntry[]>(() =>
    access(uniforms).map((u, index) => {
      const resource = u instanceof GPUTexture ? u.createView() : u instanceof GPUSampler ? u : { buffer: u }
      return {
        binding: index,
        resource
      }
    })
  )

export const createBindGroup = (
  options: MaybeAccessor<{
    layout: GPUBindGroupLayout
    entries: GPUBindGroupEntry[]
  }>
) => createMemo<GPUBindGroup>(() => device.createBindGroup(access(options)))

const builtinAttributeNames = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']
export const createRenderPipeline = (
  options: MaybeAccessor<{
    shaderCode: string
    bindGroupLayout: GPUBindGroupLayout
    vertexBuffers: {
      buffer: GPUBuffer
      layout: GPUVertexBufferLayout
      name?: string
      type?: string
    }[]

    vertexEntryPoint?: string
    fragmentEntryPoint?: string
    format?: GPUTextureFormat

    primitive?: GPUPrimitiveState
    depthStencil?: GPUDepthStencilState
  }>
) => {
  const pipeline = createMemo<GPURenderPipeline>(() => {
    const ops = access(options)

    let code = ops.shaderCode
    const vertexInputStr = ops.vertexBuffers
      .filter(v => v.name && builtinAttributeNames.includes(v.name))
      .map((v, i) => `  @location(${i}) ${v.name}: ${v.type}`)
      .join(',\n')
    if (vertexInputStr) {
      const old = code.match(/^struct VertexInput {\n(.|\n)*?}/)?.[0]
      const rep = `struct VertexInput {\n${vertexInputStr}\n}`
      code = old?.length ? code.replace(old, rep) : rep + '\n' + code
    }
    const shaderModule = device.createShaderModule({ code })

    return device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [access(ops.bindGroupLayout)]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: ops.vertexEntryPoint ?? 'vs_main',
        buffers: ops.vertexBuffers.map(v => access(v.layout))
      },
      fragment: {
        module: shaderModule,
        entryPoint: ops.fragmentEntryPoint ?? 'fs_main',
        targets: [{ format: ops.format ?? navigator.gpu.getPreferredCanvasFormat() }]
      },
      primitive: {
        frontFace: 'ccw',
        cullMode: 'back',
        topology: 'triangle-list',
        ...ops.primitive
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus-stencil8',
        ...ops.depthStencil
      },
      multisample: { count: 4 }
    })
  })

  return pipeline
}

const tempVec3 = Vec3.create()
export const createRenderScene = (
  options: MaybeAccessor<{
    children: JSX.Element
    camera?: CameraRef
    autoClear?: boolean
    clearValue?: GPUColor

    // render to texture
    texture?: GPUTexture

    // render to canvas
    width?: number
    height?: number
    format?: GPUTextureFormat
    sampleCount?: number
  }>
) => {
  const defaultOptions = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    sampleCount: 4
  }

  const [scene, setScene] = createStore<SceneContext>({
    ...defaultOptions,
    nodes: {},
    renderList: [],
    renderOrder: [],
    lightList: []
  })
  createEffect(() => {
    const opts = access(options)
    setScene(v => {
      return {
        ...v,
        width: opts.texture?.width ?? opts.width,
        height: opts.texture?.height ?? opts.height,
        format: opts.texture?.format ?? opts.format,
        sampleCount: opts.texture?.sampleCount ?? opts.sampleCount,
        autoClear: opts.autoClear,
        clearValue: opts.clearValue,
        currentCamera: opts.camera?.id,
        texture: opts.texture
      }
    })
  })

  /**
   * resize swapchain
   */
  createEffect(() => {
    const { canvas, context, format } = scene
    if (!canvas || !context) {
      return
    }
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied'
    })
    const size = [scene.width, scene.height]
    const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    const sampleCount = scene.sampleCount

    const msaaTexture = device.createTexture({
      format,
      size,
      usage,
      sampleCount
    })
    const depthTexture = device.createTexture({
      format: 'depth24plus-stencil8',
      size,
      usage,
      sampleCount
    })

    batch(() => {
      setScene('msaaTexture', msaaTexture)
      setScene('msaaTextureView', msaaTexture.createView())
      setScene('depthTexture', depthTexture)
      setScene('depthTextureView', depthTexture.createView())
    })

    onCleanup(() => {
      msaaTexture.destroy()
      depthTexture.destroy()
    })
  })

  /**
   * update render order
   */
  createEffect(() => {
    if (!scene.currentCamera) {
      return
    }
    const camera = scene.nodes[scene.currentCamera] as CameraRef
    if (!camera) {
      return
    }
    const projectionViewMatrix = camera.projectionViewMatrix()

    const renderOrder = scene.renderList
      .map(id => {
        const v = scene.nodes[id] as MeshRef
        return {
          m: v.matrix(),
          id: v.id
        }
      })
      .sort((a, b) => {
        let res = 0
        // TODO: handle depthTest disabled
        const am = a.m
        const bm = b.m

        Vec3.set(tempVec3, am[12], am[13], am[14])
        Vec3.transformMat4(tempVec3, tempVec3, projectionViewMatrix)
        const tempZ = tempVec3.z
        Vec3.set(tempVec3, bm[12], bm[13], bm[14])
        Vec3.transformMat4(tempVec3, tempVec3, projectionViewMatrix)
        res = res || tempZ - tempVec3.z
        return res
      })
      .map(v => v.id)

    setScene('renderOrder', renderOrder)
  })

  // render function
  createEffect(() => {
    const { msaaTextureView, depthTextureView, context, renderOrder } = scene
    if (!context || !msaaTextureView || !depthTextureView) {
      return
    }

    const resolveTarget = scene.texture?.createView() ?? context.getCurrentTexture().createView()
    const loadOp: GPULoadOp = scene.autoClear ? 'clear' : 'load'
    const storeOp: GPUStoreOp = 'store'
    const commandEncoder = device.createCommandEncoder()

    const colorAttachment: GPURenderPassColorAttachment = {
      view: msaaTextureView,
      resolveTarget,
      loadOp,
      storeOp,
      clearValue: scene.clearValue
    }

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [colorAttachment],
      depthStencilAttachment: {
        view: depthTextureView,
        depthClearValue: 1,
        depthLoadOp: loadOp,
        depthStoreOp: storeOp,
        stencilClearValue: 0,
        stencilLoadOp: loadOp,
        stencilStoreOp: storeOp
      }
    })
    passEncoder.setViewport(0, 0, scene.width, scene.height, 0, 1)
    for (const id of renderOrder) {
      const mesh = scene.nodes[id] as MeshRef
      mesh.draw(passEncoder)
    }

    passEncoder.end()
    device.queue.submit([commandEncoder.finish()])
  })

  const ch = children(() => access(options).children)
  createEffect(() => {
    mapArray(
      () => ch.toArray(),
      child => {
        if (isWgpuComponent(child)) {
          child.setSceneCtx([scene, setScene])
          return child.render()
        }
        return child
      }
    )
  })
}
