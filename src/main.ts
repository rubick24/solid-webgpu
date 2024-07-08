import { mat4, vec3 } from 'gl-matrix'
import ArcRotateCamera from './camera'
import { DesktopInput } from './input'
import shaderCode from './main.wgsl?raw'
import { computeHeightMap } from './compute-height-map'
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

const heightMapTexture = await textureFromImageUrl(device, '/iceland_heightmap.png')
// const heightMapTexture = await textureFromImageUrl(device, '/a.png')
const vertexBuffer = await computeHeightMap({ device, texture: heightMapTexture })
const numStrips = heightMapTexture.height - 1
const numVerticesPerStrip = heightMapTexture.width * 2
const indexes = new Uint32Array(numStrips * numVerticesPerStrip)

for (let i = 0; i < heightMapTexture.height - 1; i++) {
  for (let j = 0; j < heightMapTexture.width; j++) {
    const index = (i * heightMapTexture.width + j) * 2
    for (let k = 0; k < 2; k++) {
      indexes[index + k] = j + heightMapTexture.width * (i + k)
    }
  }
}

// const vertices = new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0])
// const indexes = new Uint32Array([0, 1, 2, 0, 2, 3])
// const vertexBuffer = device.createBuffer({
//   size: vertices.byteLength, // make it big enough to store vertices in
//   usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
// })
// device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length)

const indexBuffer = device.createBuffer({
  size: indexes.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
})
device.queue.writeBuffer(indexBuffer, 0, indexes, 0, indexes.length)

const camera = new ArcRotateCamera(vec3.fromValues(0, 0, 0), Math.PI / 2, Math.PI / 2, 3)
const di = new DesktopInput(canvas)

// uniform
const baseUniformBuffer = device.createBuffer({
  size: (4 + 48) * Float32Array.BYTES_PER_ELEMENT,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
})

const modelMatrix = mat4.create()
const scale = 4 / heightMapTexture.width

mat4.scale(modelMatrix, modelMatrix, [scale, 0.06, scale])
mat4.translate(modelMatrix, modelMatrix, [-0.5 * heightMapTexture.width, 0, -0.5 * heightMapTexture.height])
// width, height, t, dt, mvp
const baseUniformValues = new Float32Array(4 + 48)
baseUniformValues[0] = width
baseUniformValues[1] = height

baseUniformValues.set(modelMatrix, 4)
baseUniformValues.set(camera.viewMatrix, 20)

const projectionMatrix = camera.getProjectionMatrix(canvas.width / canvas.height, 0.01, 1000)
baseUniformValues.set(projectionMatrix, 36)

device.queue.writeBuffer(baseUniformBuffer, 0, baseUniformValues)

const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0, // baseUniform
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

const shaderModule = device.createShaderModule({ code: shaderCode })
const pipeline = device.createRenderPipeline({
  layout: device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout]
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
        arrayStride: 12,
        stepMode: 'vertex'
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
    topology: 'triangle-strip',
    stripIndexFormat: 'uint32'
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

const frame = (t: number) => {
  camera.processDesktopInput(di)
  // camera.alpha += 0.001

  const dt = t - baseUniformValues[2]
  baseUniformValues[2] = t
  baseUniformValues[3] = dt
  baseUniformValues.set(camera.viewMatrix, 20)
  device.queue.writeBuffer(baseUniformBuffer, 0, baseUniformValues)

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
  passEncoder.setIndexBuffer(indexBuffer, 'uint32')
  passEncoder.setBindGroup(0, bindGroup)

  for (let strip = 0; strip < numStrips; strip++) {
    passEncoder.drawIndexed(numVerticesPerStrip, 1, numVerticesPerStrip * strip)
  }
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
