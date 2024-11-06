import { OrbitControl, PerspectiveCamera, WebGPURenderer } from 'core'
import { loadGLTF } from 'gltf'

const renderer = new WebGPURenderer()
renderer.setSize(960, 540)
document.body.appendChild(renderer.canvas)

const camera = new PerspectiveCamera({ aspect: 16 / 9 })
camera.position.z = 5

const { json, scenes } = await loadGLTF('/suzanne.glb')

const scene = scenes[json.scene ?? 0]
const control = new OrbitControl(camera)
control.connect(renderer.canvas)

const render = () => {
  renderer.render(scene, camera)
  requestAnimationFrame(render)
}
requestAnimationFrame(render)
