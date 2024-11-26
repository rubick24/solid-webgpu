import {
  Geometry,
  Mesh,
  Object3D,
  OrbitControl,
  PBRMaterial,
  PerspectiveCamera,
  PunctualLight,
  textureFromUrl,
  WebGPURenderer
} from 'core'
import { Quat, Vec3 } from 'math'

const renderer = new WebGPURenderer()
renderer.setSize(960, 540)
document.body.appendChild(renderer.canvas)

const camera = new PerspectiveCamera({ aspect: 16 / 9 })
camera.position.z = 5

const control = new OrbitControl(camera)
control.connect(renderer.canvas)

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
          } // NORMAL
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
            format: 'float32x4'
          } // TANGENT
        ],
        arrayStride: 16
      },
      buffer: new Float32Array(4 * 4).fill(0)
    },
    {
      layout: {
        attributes: [
          {
            shaderLocation: 3,
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

const texture = await textureFromUrl('/a.png')

const material = new PBRMaterial({
  albedoTexture: texture,
  occlusionRoughnessMetallicTexture: texture
})

const scene = new Object3D()

const mesh = new Mesh({ geometry, material })
const light = new PunctualLight({
  type: 'spot',
  position: Vec3.fromValues(0, 1.5, 0.5),
  quaternion: Quat.fromEuler(Quat.create(), 90, 0, 0),
  color: Vec3.fromValues(1, 1, 1),
  intensity: 100
})

scene.add(mesh, light)

const render = () => {
  renderer.render(scene, camera)
  requestAnimationFrame(render)
}
requestAnimationFrame(render)
