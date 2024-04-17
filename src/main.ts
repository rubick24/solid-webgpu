import shaderCode from './main.wgsl?raw'

const adapter = (await navigator.gpu.requestAdapter())!
const device = await adapter.requestDevice()

const canvas = document.createElement('canvas')
const devicePixelRatio = window.devicePixelRatio || 1

const width = 960
const height = 540
canvas.width = width * devicePixelRatio
canvas.height = height * devicePixelRatio
Object.assign(canvas.style, {
  width: `${width}px`,
  height: `${height}px`
})
document.body.appendChild(canvas)
const context = canvas.getContext('webgpu')!
const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

console.log(presentationFormat)

context.configure({
  device,
  format: presentationFormat,
  alphaMode: 'premultiplied'
})

const shaderModule = device.createShaderModule({ code: shaderCode })

// vertex buffer
const vertices = new Float32Array([-1, 1, 1, 1, -1, -1, -1, -1, 1, -1, 1, 1])
const vertexBuffer = device.createBuffer({
  size: vertices.byteLength, // make it big enough to store vertices in
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
})
device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length)
const vertexBuffersDescriptors: GPUVertexBufferLayout[] = [
  {
    attributes: [
      {
        shaderLocation: 0,
        offset: 0,
        format: 'float32x2'
      } // POSITION
    ],
    arrayStride: 8,
    stepMode: 'vertex'
  }
]

// uniform
const baseUniformBuffer = device.createBuffer({
  size: 16, // 2 * 4 bytes
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
})

const baseUniformValues = new Float32Array([width, height, 0, 0])
device.queue.writeBuffer(baseUniformBuffer, 0, baseUniformValues)

const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0, // resolution uniforms
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: {}
    }
  ]
})
const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    {
      binding: 0,
      resource: { buffer: baseUniformBuffer }
    }
  ]
})

const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [
    bindGroupLayout // @group(0)
  ]
})
const pipeline = device.createRenderPipeline({
  layout: pipelineLayout,
  vertex: {
    module: shaderModule,
    entryPoint: 'vs_main',
    buffers: vertexBuffersDescriptors
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'fs_main',
    targets: [
      {
        format: presentationFormat
      }
    ]
  },
  primitive: {
    topology: 'triangle-list'
  }
})

const frame = (t: number) => {
  const dt = t - baseUniformValues[2]
  baseUniformValues[2] = t
  baseUniformValues[3] = dt
  device.queue.writeBuffer(baseUniformBuffer, 0, baseUniformValues)

  const commandEncoder = device.createCommandEncoder()
  const textureView = context.getCurrentTexture().createView()

  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }
    ]
  })
  passEncoder.setPipeline(pipeline)
  passEncoder.setVertexBuffer(0, vertexBuffer)
  passEncoder.setBindGroup(0, bindGroup)
  passEncoder.draw(6)
  passEncoder.end()

  device.queue.submit([commandEncoder.finish()])
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)

export {}
