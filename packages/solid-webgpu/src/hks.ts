import { Mat3, Mat4, Vec3 } from '@rubick24/math'
import { type Accessor, createEffect, createMemo, onCleanup, untrack } from 'solid-js'

import type { CameraRef, MaybeAccessor, MeshRef, Optional, PunctualLightRef, TypedArray } from './types'
import { access } from './utils'

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
// biome-ignore lint/suspicious/noNonNullAssertedOptionalChain: Allow imports without WebGPU; rendering requires an available device.
export const device = await _adapter?.requestDevice()!

export const createBuffer = (options: MaybeAccessor<GPUBufferDescriptor>) =>
  createMemo(() => {
    const buffer = device.createBuffer(access(options))
    onCleanup(() => buffer.destroy())
    return buffer
  })

export const createBufferFromValue = (
  options: MaybeAccessor<Omit<GPUBufferDescriptor, 'size'>>,
  value: MaybeAccessor<TypedArray | ArrayBuffer>,
): Accessor<GPUBuffer> & { update?: () => void } => {
  const buffer = createBuffer(() => ({
    // Data can be produced from an accessor whose contents change every
    // frame. Buffer capacity is fixed; only its contents need updating.
    size: untrack(() => access(value).byteLength),
    ...access(options),
  }))

  if (typeof value === 'function') {
    const update = () => {
      const val = untrack(() => access(value))
      device.queue.writeBuffer(buffer(), 0, val)
    }
    return Object.assign(buffer, { update })
  }

  createEffect(
    () => [value, buffer()] as const,
    ([val, target]) => device.queue.writeBuffer(target, 0, val),
  )
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
  image: MaybeAccessor<ImageBitmap>,
) => {
  const texture = createTexture(() => {
    const ops = access(options)
    const img = access(image)
    return {
      ...ops,
      usage:
        (ops.usage ?? 0) |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
      size: { width: img.width, height: img.height },
    }
  })

  createEffect(
    () => {
      const img = access(image)
      return {
        img,
        size: { width: img.width, height: img.height },
        texture: texture(),
      }
    },
    ({ img, size, texture }) => device.queue.copyExternalImageToTexture({ source: img }, { texture }, size),
  )
  return texture
}

export const createSampler = (options?: MaybeAccessor<GPUSamplerDescriptor>) =>
  createMemo<GPUSampler>(() => device.createSampler(access(options)))

const builtInBufferLength = {
  base: 80,
  punctual_lights: 16 * 16,
} as const

export const createUniformBufferBase = () => {
  const val = new Float32Array(builtInBufferLength.base)
  const normalMatrix = new Float32Array(9)
  const buffer = device.createBuffer({
    size: val.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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
    // WGSL uniform mat3 columns have a 16-byte stride, unlike the packed
    // 9-float representation returned by Mat3.normalFromMat4.
    Mat3.normalFromMat4(normalMatrix, modelMatrix)
    val[64] = normalMatrix[0]
    val[65] = normalMatrix[1]
    val[66] = normalMatrix[2]
    val[67] = 0
    val[68] = normalMatrix[3]
    val[69] = normalMatrix[4]
    val[70] = normalMatrix[5]
    val[71] = 0
    val[72] = normalMatrix[6]
    val[73] = normalMatrix[7]
    val[74] = normalMatrix[8]
    val[75] = 0
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
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(buffer, 0, lightValues)

  const update = (ref: MeshRef) => {
    const scene = ref?.scene()?.[0]
    if (!scene) {
      return
    }
    const { lightList } = scene
    lightValues.fill(0)
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
        spot: 3,
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
            buffer: u instanceof GPUBuffer ? {} : undefined,
          },
        }
      }),
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
        resource,
      }
    }),
  )

export const createBindGroup = (
  options: MaybeAccessor<{
    layout: GPUBindGroupLayout
    entries: GPUBindGroupEntry[]
  }>,
) => createMemo<GPUBindGroup>(() => device.createBindGroup(access(options)))

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
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'
    doubleSided?: boolean

    multisample?: GPUMultisampleState
  }>,
) => {
  const pipeline = createMemo<GPURenderPipeline>(() => {
    const ops = access(options)

    let code = ops.shaderCode
    const uvSets = ops.vertexBuffers
      .map(v => v.name?.match(/^TEXCOORD_(\d+)$/))
      .filter((value): value is RegExpMatchArray => !!value)
      .map(value => Number(value[1]))
      .filter(index => index > 0)
    const uvOutputs = uvSets.map(index => `    @location(${5 + index}) uv_${index}: vec2<f32>,`).join('\n')
    const uvAssignments = uvSets.map(index => `    output.uv_${index} = input.TEXCOORD_${index};`).join('\n')
    code = code.replace('/*TEXCOORD_OUTPUTS*/', uvOutputs).replace('/*TEXCOORD_ASSIGNMENTS*/', uvAssignments)
    const vertexInputStr = ops.vertexBuffers
      .filter(v => v.name && v.type)
      .map(v => `  @location(${[...access(v.layout).attributes][0]?.shaderLocation ?? 0}) ${v.name}: ${v.type}`)
      .join(',\n')
    if (vertexInputStr) {
      const old = code.match(/struct VertexInput\s*\{[\s\S]*?\};/)?.[0]
      const rep = `struct VertexInput {\n${vertexInputStr}\n}`
      code = old?.length ? code.replace(old, rep) : `${rep}\n${code}`
    }
    const shaderModule = device.createShaderModule({ code })

    return device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [access(ops.bindGroupLayout)],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: ops.vertexEntryPoint ?? 'vs_main',
        buffers: ops.vertexBuffers.map(v => access(v.layout)),
      },
      fragment: {
        module: shaderModule,
        entryPoint: ops.fragmentEntryPoint ?? 'fs_main',
        targets: [
          {
            format: ops.format ?? navigator.gpu.getPreferredCanvasFormat(),
            blend:
              ops.alphaMode === 'BLEND'
                ? {
                    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                  }
                : undefined,
          },
        ],
      },
      primitive: {
        frontFace: 'ccw',
        cullMode: ops.doubleSided ? 'none' : 'back',
        topology: 'triangle-list',
        ...ops.primitive,
      },
      depthStencil: {
        depthWriteEnabled: ops.alphaMode !== 'BLEND',
        depthCompare: 'less',
        format: 'depth24plus-stencil8',
        ...ops.depthStencil,
      },
      multisample: ops.multisample,
    })
  })

  return pipeline
}
