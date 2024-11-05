import { OrbitControl, PerspectiveCamera, PunctualLight, WebGPURenderer } from 'core'
import { loadGLTF } from 'gltf'
import { Quat, Vec3 } from 'math'

const renderer = new WebGPURenderer()
renderer.setSize(960, 540)
document.body.appendChild(renderer.canvas)

const camera = new PerspectiveCamera({ aspect: 16 / 9 })
camera.position.z = 5

const { json, scenes } = await loadGLTF('/axis.glb')

console.log(json)
const scene = scenes[json.scene ?? 0]

const light = new PunctualLight({
  type: 'spot',
  position: Vec3.fromValues(0.25, 3, 0.25),
  quaternion: Quat.fromEuler(Quat.create(), 90, 0, 0),
  color: Vec3.fromValues(1, 1, 1),
  intensity: 100,
  innerConeAngle: 0,
  outerConeAngle: Math.PI / 12
})
scene.add(light)

const light2 = new PunctualLight({
  type: 'directional',
  quaternion: Quat.fromEuler(Quat.create(), 0, 90, 0),
  color: Vec3.fromValues(0, 0, 1),
  intensity: 10
})
scene.add(light2)

const control = new OrbitControl(camera)
control.connect(renderer.canvas)

const render = () => {
  renderer.render(scene, camera)
  requestAnimationFrame(render)
}
requestAnimationFrame(render)
