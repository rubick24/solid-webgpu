// import { WebGPURenderer, PerspectiveCamera, Geometry, Material, Mesh } from 'four'
import { WebGPURenderer } from './renderer'
import { ArcRotateCamera } from './camera'
import { Geometry } from './geometry'
import { Material } from './material'
import { Mesh } from './mesh'
import shaderCode from './default_pbr.wgsl?raw'
import { textureFromUrl } from './utils'
import { DesktopInput } from './input'

const renderer = new WebGPURenderer()
renderer.setSize(960, 540)
document.body.appendChild(renderer.canvas)

const camera = new ArcRotateCamera({ aspect: 16 / 9 })
const di = new DesktopInput(renderer.canvas)
camera.position.z = 5

const geometry = new Geometry({
  vertexBuffers: [
    {
      layout: {
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3'
          } // POSITION
        ],
        arrayStride: 12
      },
      buffer: new Float32Array([1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0])
    },
    {
      layout: {
        attributes: [
          {
            shaderLocation: 1,
            offset: 0,
            format: 'float32x3'
          } // Normal
        ],
        arrayStride: 12
      },
      buffer: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
    },
    {
      layout: {
        attributes: [
          {
            shaderLocation: 2,
            offset: 0,
            format: 'float32x2'
          } // UV
        ],
        arrayStride: 8
      },
      buffer: new Float32Array([1, 1, 0, 1, 0, 0, 1, 0])
    }
  ],
  indexBuffer: {
    buffer: new Uint32Array([0, 1, 2, 0, 2, 3])
  }
})

const _pbrBuffer = new ArrayBuffer(32)
const pbrParamsValueF32 = new Float32Array(_pbrBuffer)
// pbrParamsValueF32.set([1, 1, 1], 0) // albedo
pbrParamsValueF32[3] = 0.9 // metallic
pbrParamsValueF32[4] = 0.5 // roughness
pbrParamsValueF32[5] = 0.2 // ao
const pbrParamsValueU32 = new Uint32Array(_pbrBuffer)
pbrParamsValueU32[6] = 0b011 // use texture flag

const lightValues = new Float32Array([2, 2, 2, 0, 10, 10, 10, 0])

const texture = await textureFromUrl('/a.png')
const material = new Material({
  shaderCode,
  uniforms: [
    {
      type: 'buffer',
      value: pbrParamsValueF32
    },
    {
      type: 'buffer',
      value: lightValues
    },
    texture,
    texture,
    {
      type: 'sampler',
      descriptor: {
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'repeat',
        addressModeV: 'repeat'
      }
    }
  ]
})
const mesh = new Mesh(geometry, material)

const render = () => {
  camera.processDesktopInput(di)
  renderer.render(mesh, camera)
  requestAnimationFrame(render)
}
requestAnimationFrame(render)
// setInterval(() => renderer.render(mesh, camera), 100)
