import computeShaderCode from './compute-height-map.wgsl?raw'

export const computeHeightMap = async (v: { device: GPUDevice; texture: GPUTexture }) => {
  const { device, texture } = v
  const vertexCount = texture.width * texture.height

  const bufferSize = vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT

  const vertexBuffer = device.createBuffer({
    size: bufferSize, // make it big enough to store vertices in
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE
  })

  const stagingBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  })

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
        binding: 1, // vertex
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage'
        }
      },
      {
        binding: 2, // texture
        visibility: GPUShaderStage.COMPUTE,
        texture: {}
      }
    ]
  })
  const computePipeline = device.createComputePipeline({
    label: 'Height map compute pipeline',
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
  const computeUniformBuffer = device.createBuffer({
    label: 'Height map Uniform Buffer',
    size: 16, // Minimum uniform buffer size
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  const computeUniformArray = new Uint32Array(computeUniformBuffer.size / Uint32Array.BYTES_PER_ELEMENT)
  const computeBindGroup = device.createBindGroup({
    label: 'Normal Inversion Bind Group',
    layout: computeBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: computeUniformBuffer }
      },
      {
        binding: 1,
        resource: { buffer: vertexBuffer }
      },
      {
        binding: 2,
        resource: texture.createView()
      }
    ]
  })

  computeUniformArray[0] = vertexCount
  computeUniformArray[1] = 3 // stride
  computeUniformArray[2] = texture.width
  computeUniformArray[3] = texture.height
  device.queue.writeBuffer(computeUniformBuffer, 0, computeUniformArray)
  // Encode a compute pass that executes the compute shader.
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()

  pass.setPipeline(computePipeline)
  pass.setBindGroup(0, computeBindGroup)

  const workgroupSize = 256
  pass.dispatchWorkgroups(Math.ceil(vertexCount / workgroupSize))

  pass.end()

  encoder.copyBufferToBuffer(vertexBuffer, 0, stagingBuffer, 0, bufferSize)

  device.queue.submit([encoder.finish()])

  await stagingBuffer.mapAsync(GPUMapMode.READ, 0, bufferSize)
  const copyArrayBuffer = stagingBuffer.getMappedRange(0, bufferSize)
  const data = copyArrayBuffer.slice(0)
  stagingBuffer.unmap()

  const x = new Float32Array(data)
  console.log(x)
  return vertexBuffer
}
