import { Object3D } from 'core'
import { Mat4, Mat4Like, Quat, Vec3 } from 'math'
import { getMesh } from './get_mesh'
import { getPunctualLight } from './get_punctual_light'
import { LoaderContext } from './types'

export const getNode = async (index: number, context: LoaderContext) => {
  const json = context.json.nodes?.[index]
  if (!json) {
    throw new Error('node not found')
  }
  const node = new Object3D()
  const lightIndex = json.extensions?.KHR_lights_punctual?.light as number | undefined
  if (lightIndex !== undefined) {
    const light = context._cached(`punctual_light_${index}`, () => getPunctualLight(lightIndex, context))
    node.add(light)
  }
  if (json.matrix) {
    Mat4.getScaling(node.scale, json.matrix as Mat4Like)
    // To extract a correct rotation, the scaling component must be eliminated.
    const mn = Mat4.create()
    for (let col = 0; col <= 2; col++) {
      mn[col] = json.matrix[col] / node.scale[0]
      mn[col + 4] = json.matrix[col + 4] / node.scale[1]
      mn[col + 8] = json.matrix[col + 8] / node.scale[2]
    }
    Mat4.getRotation(node.quaternion, mn)
    Mat4.getTranslation(node.position, json.matrix as Mat4Like)
  } else {
    if (json.rotation) {
      Quat.set(node.quaternion, ...(json.rotation as [number, number, number, number]))
    }
    if (json.translation) {
      Vec3.set(node.position, ...(json.translation as [number, number, number]))
    }
    if (json.scale) {
      Vec3.set(node.scale, ...(json.scale as [number, number, number]))
    }
  }

  node.label = json.name ?? `gltf node ${index}`

  if (json.mesh !== undefined) {
    const meshes = await context._cached(`mesh_${index}`, () => getMesh(json.mesh!, context))
    node.add(...meshes)
  }

  for (const child of json.children ?? []) {
    const childNode = await context._cached(`node_${child}`, () => getNode(child, context))
    node.add(childNode)
  }

  return node
}
