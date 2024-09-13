import { Mat4 } from './math'
import { ArcRotateCamera } from './camera'
import { DesktopInput } from './input'
import shaderCode from './pbr.wgsl?raw'
import { textureFromImageUrl } from './utils'
// import { record } from './record'

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

const albedoTexture = await textureFromImageUrl(device, '/a.png')
const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
  addressModeU: 'repeat',
  addressModeV: 'repeat'
})

const vertices = new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0])
const vertexBuffer = device.createBuffer({
  size: vertices.byteLength, // make it big enough to store vertices in
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
})
device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length)

const indexes = new Uint32Array([0, 1, 2, 0, 2, 3])
const indexBuffer = device.createBuffer({
  size: indexes.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
})
device.queue.writeBuffer(indexBuffer, 0, indexes, 0, indexes.length)

const verticesNormal = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
const normalBuffer = device.createBuffer({
  size: verticesNormal.byteLength,
  usage: GPUBufferUsage.VERTEX,
  mappedAtCreation: true
})
new Float32Array(normalBuffer.getMappedRange()).set(verticesNormal)
normalBuffer.unmap()

const uv = new Float32Array([1, 1, 0, 1, 0, 0, 1, 0])
const uvBuffer = device.createBuffer({
  size: verticesNormal.byteLength,
  usage: GPUBufferUsage.VERTEX,
  mappedAtCreation: true
})
new Float32Array(uvBuffer.getMappedRange()).set(uv)
uvBuffer.unmap()

const camera = new ArcRotateCamera({ aspect: canvas.width / canvas.height })
camera.updateMatrix()
console.log(camera.position)

const di = new DesktopInput(canvas)
// const projectionMatrix =  //camera.getProjectionMatrix(canvas.width / canvas.height, 0.001, 1000)

// uniform
const vertexUniformBuffer = device.createBuffer({
  size: 16 * 3 * Float32Array.BYTES_PER_ELEMENT,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
})
const modelMatrix = Mat4.create()
// mat4.translate(modelMatrix, modelMatrix, [0, 0, 1])
const vertexUniformValues = new Float32Array(48)
vertexUniformValues.set(modelMatrix, 0)
vertexUniformValues.set(camera.viewMatrix, 16)
vertexUniformValues.set(camera.projectionMatrix, 32)
device.queue.writeBuffer(vertexUniformBuffer, 0, vertexUniformValues)

const bindGroupLayout0 = device.createBindGroupLayout({
  entries: [
    {
      binding: 0, // baseUniform
      visibility: GPUShaderStage.VERTEX,
      buffer: {}
    }
  ]
})
const bindGroup0 = device.createBindGroup({
  layout: bindGroupLayout0,
  entries: [
    {
      binding: 0,
      resource: { buffer: vertexUniformBuffer }
    }
  ]
})

const cameraPositionBuffer = device.createBuffer({
  size: 3 * Float32Array.BYTES_PER_ELEMENT,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
})
// const cameraPositionValue
device.queue.writeBuffer(cameraPositionBuffer, 0, camera.position as Float32Array)

const pbrParamsBuffer = device.createBuffer({
  size: 8 * Float32Array.BYTES_PER_ELEMENT,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
})
const _pbrBuffer = new ArrayBuffer(32)
const pbrParamsValueF32 = new Float32Array(_pbrBuffer)
// pbrParamsValueF32.set([1, 1, 1], 0) // albedo
pbrParamsValueF32[3] = 0.9 // metallic
pbrParamsValueF32[4] = 0.5 // roughness
pbrParamsValueF32[5] = 0.2 // ao
const pbrParamsValueU32 = new Uint32Array(_pbrBuffer)
pbrParamsValueU32[6] = 0b011 // use texture flag
device.queue.writeBuffer(pbrParamsBuffer, 0, _pbrBuffer)

const lightBuffer = device.createBuffer({
  size: 8 * Float32Array.BYTES_PER_ELEMENT,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
})
const lightValues = new Float32Array([2, 2, 2, 0, 10, 10, 10, 0])
device.queue.writeBuffer(lightBuffer, 0, lightValues)

const bindGroupLayout1 = device.createBindGroupLayout({
  entries: [
    {
      binding: 0, // camera position
      visibility: GPUShaderStage.FRAGMENT,
      buffer: {}
    },
    {
      binding: 1, // pbr params
      visibility: GPUShaderStage.FRAGMENT,
      buffer: {}
    },
    {
      binding: 2, // light
      visibility: GPUShaderStage.FRAGMENT,
      buffer: {}
    },
    {
      binding: 3, // texture
      visibility: GPUShaderStage.FRAGMENT,
      texture: {}
    },
    {
      binding: 4, // texture
      visibility: GPUShaderStage.FRAGMENT,
      texture: {}
    },
    {
      binding: 5, // sampler
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {}
    }
  ]
})
const bindGroup1 = device.createBindGroup({
  layout: bindGroupLayout1,
  entries: [
    {
      binding: 0,
      resource: { buffer: cameraPositionBuffer }
    },
    {
      binding: 1,
      resource: { buffer: pbrParamsBuffer }
    },
    {
      binding: 2,
      resource: { buffer: lightBuffer }
    },
    {
      binding: 3,
      resource: albedoTexture.createView()
    },
    {
      binding: 4,
      resource: albedoTexture.createView()
    },
    {
      binding: 5,
      resource: sampler
    }
  ]
})

const shaderModule = device.createShaderModule({ code: shaderCode })
const pipeline = device.createRenderPipeline({
  layout: device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout0, bindGroupLayout1]
  }),
  vertex: {
    module: shaderModule,
    entryPoint: 'vs_main',
    buffers: [
      {
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3'
          } // POSITION
        ],
        arrayStride: 12
      },
      {
        attributes: [
          {
            shaderLocation: 1,
            offset: 0,
            format: 'float32x3'
          } // NORMAL
        ],
        arrayStride: 12
      },
      {
        attributes: [
          {
            shaderLocation: 2,
            offset: 0,
            format: 'float32x2'
          } // UV
        ],
        arrayStride: 8
      }
    ]
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
    topology: 'triangle-list',
    cullMode: 'back',
    frontFace: 'ccw'
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus'
  }
})

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT
})

const frame = () => {
  camera.processDesktopInput(di)
  camera.updateMatrix()

  vertexUniformValues.set(camera.viewMatrix, 16)
  device.queue.writeBuffer(vertexUniformBuffer, 0, vertexUniformValues)
  device.queue.writeBuffer(cameraPositionBuffer, 0, camera.position as Float32Array)

  const commandEncoder = device.createCommandEncoder()

  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store'
    }
  })
  passEncoder.setPipeline(pipeline)
  passEncoder.setVertexBuffer(0, vertexBuffer)
  passEncoder.setVertexBuffer(1, normalBuffer)
  passEncoder.setVertexBuffer(2, uvBuffer)
  passEncoder.setIndexBuffer(indexBuffer, 'uint32')
  passEncoder.setBindGroup(0, bindGroup0)
  passEncoder.setBindGroup(1, bindGroup1)

  passEncoder.drawIndexed(6, 1)

  passEncoder.end()

  device.queue.submit([commandEncoder.finish()])
  requestAnimationFrame(frame)
}

// const recorder = record(canvas)
// recorder.start()
// setTimeout(async () => {
//   const v = await recorder.stop()
//   const url = URL.createObjectURL(v)
//   const a = document.createElement('a')
//   a.innerHTML = 'download'
//   a.href = url
//   a.download = 'video.webm'
//   document.body.appendChild(a)
// }, 10000)
requestAnimationFrame(frame)

export {}
