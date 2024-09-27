import { WebGPURenderer, PerspectiveCamera, OrbitControl, Geometry, Mesh, PBRMaterial, textureFromUrl } from '../../src'

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

const mesh = new Mesh({ geometry, material })

const render = () => {
  renderer.render(mesh, camera)
  requestAnimationFrame(render)
}
requestAnimationFrame(render)
