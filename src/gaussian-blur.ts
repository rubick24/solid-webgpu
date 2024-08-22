import computeShaderCode from './gaussian-blur.wgsl?raw'

const m = new WeakMap<GPUTexture, GPUTexture>()

export const gaussianBlur = (options: {
  device: GPUDevice
  texture: GPUTexture
  sigma: number
  output?: GPUTexture
}) => {
  const { device, texture, sigma } = options
  const pixelCount = texture.width * texture.height

  const tempTexture =
    m.get(texture) ??
    device.createTexture({
      size: { width: texture.width, height: texture.height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    })
  m.set(texture, tempTexture)

  const outputTexture =
    options.output ??
    device.createTexture({
      size: { width: texture.width, height: texture.height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    })

  // Generate 1D Gaussian kernel
  const kernelSize = Math.ceil(sigma * 6)
  const kernel = new Float32Array(kernelSize * 2 + 1)
  for (let i = 0; i <= kernelSize; i++) {
    const value = Math.exp((-0.5 * (i * i)) / (sigma * sigma))
    kernel[kernelSize + i] = value
    kernel[kernelSize - i] = value
  }
  const kernelSum = kernel.reduce((sum, value) => sum + value, 0)
  // console.log([...kernel], kernelSum)
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] = kernel[i] / kernelSum
  }
  // console.log([...kernel].map(v => v.toFixed(5)))

  // vertexBuffer
  const computeBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0, // uniform
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'uniform'
        }
      },
      {
        binding: 1, // uniform
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'read-only-storage'
        }
      },
      {
        binding: 2, // input texture
        visibility: GPUShaderStage.COMPUTE,
        texture: {}
      },
      {
        binding: 3, // output texture
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          format: 'rgba8unorm'
        }
      }
    ]
  })
  const computePipeline = device.createComputePipeline({
    label: 'gaussian blur',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [
        computeBindGroupLayout // @group(0)
      ]
    }),
    compute: {
      module: device.createShaderModule({ code: computeShaderCode }),
      entryPoint: 'main'
    }
  })
  const computePipelineVertical = device.createComputePipeline({
    label: 'gaussian blur vertical',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [
        computeBindGroupLayout // @group(0)
      ]
    }),
    compute: {
      module: device.createShaderModule({ code: computeShaderCode }),
      entryPoint: 'main_vertical'
    }
  })

  const computeUniformBuffer = device.createBuffer({
    label: 'blur uniform buffer',
    size: 16, // Minimum uniform buffer size
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  const computeUniformArray = new Uint32Array(computeUniformBuffer.size / Uint32Array.BYTES_PER_ELEMENT)

  const kernelBuffer = device.createBuffer({
    label: 'blur kernel buffer',
    size: kernel.length * kernel.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(kernelBuffer, 0, kernel)

  const computeBindGroup = device.createBindGroup({
    label: 'blur bind group',
    layout: computeBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: computeUniformBuffer }
      },
      {
        binding: 1,
        resource: { buffer: kernelBuffer }
      },
      {
        binding: 2,
        resource: texture.createView()
      },
      {
        binding: 3,
        resource: tempTexture.createView()
      }
    ]
  })
  const computeBindGroupVertical = device.createBindGroup({
    label: 'blur bind group vertical',
    layout: computeBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: computeUniformBuffer }
      },
      {
        binding: 1,
        resource: { buffer: kernelBuffer }
      },
      {
        binding: 2,
        resource: tempTexture.createView()
      },
      {
        binding: 3,
        resource: outputTexture.createView()
      }
    ]
  })

  computeUniformArray[0] = pixelCount
  computeUniformArray[1] = kernelSize
  computeUniformArray[2] = texture.width
  computeUniformArray[3] = texture.height
  device.queue.writeBuffer(computeUniformBuffer, 0, computeUniformArray)
  // Encode a compute pass that executes the compute shader.
  const commandEncoder = device.createCommandEncoder()
  const passEncoder = commandEncoder.beginComputePass()

  passEncoder.setPipeline(computePipeline)
  passEncoder.setBindGroup(0, computeBindGroup)

  const workgroupSize = 64
  passEncoder.dispatchWorkgroups(Math.ceil(pixelCount / workgroupSize))

  passEncoder.setPipeline(computePipelineVertical)
  passEncoder.setBindGroup(0, computeBindGroupVertical)
  passEncoder.dispatchWorkgroups(Math.ceil(pixelCount / workgroupSize))

  passEncoder.end()

  device.queue.submit([commandEncoder.finish()])
  // tempTexture.destroy()

  return outputTexture
}
