import { Component, For } from 'solid-js'
import { Mat4, Mat4Like, Object3D, Quat, QuatLike, Vec3Like } from 'solid-webgpu'
import { getMesh } from './get-mesh'
import { getPunctualLight } from './get-punctual-light'
import { LoaderContext } from './types'

export const getNode = async (index: number, context: LoaderContext) => {
  const json = context.json.nodes?.[index]
  if (!json) {
    throw new Error('node not found')
  }
  const scale = json.matrix ? Mat4.getScaling([1, 1, 1], json.matrix as Mat4Like) : (json.scale as Vec3Like)
  const quaternion = json.matrix
    ? (() => {
        const mn = Mat4.create()
        for (let col = 0; col <= 2; col++) {
          mn[col] = json.matrix[col] / (scale?.[0] ?? 1)
          mn[col + 4] = json.matrix[col + 4] / (scale?.[1] ?? 1)
          mn[col + 8] = json.matrix[col + 8] / (scale?.[2] ?? 1)
        }
        return Mat4.getRotation(Quat.create(), mn)
      })()
    : (json.rotation as QuatLike)
  const position = json.matrix
    ? Mat4.getTranslation([0, 0, 0], json.matrix as Mat4Like)
    : (json.translation as Vec3Like)

  const meshes =
    json.mesh !== undefined ? await context.withCache(`mesh_${index}`, () => getMesh(json.mesh!, context)) : []

  const childNodes: Component[] = []
  for (const child of json.children ?? []) {
    const childNode = await context.withCache(`node_${child}`, () => getNode(child, context))
    childNodes.push(childNode)
  }
  const lightIndex = json.extensions?.KHR_lights_punctual?.light as number | undefined

  const Light =
    lightIndex !== undefined
      ? context.withCache(`punctual_light_${index}`, () => getPunctualLight(lightIndex, context))
      : () => null

  return () => (
    <Object3D label={json.name ?? `gltf node ${index}`} scale={scale} quaternion={quaternion} position={position}>
      <Light />
      <For each={meshes}>{Mesh => <Mesh />}</For>
      <For each={childNodes}>{Child => <Child />}</For>
    </Object3D>
  )
}
