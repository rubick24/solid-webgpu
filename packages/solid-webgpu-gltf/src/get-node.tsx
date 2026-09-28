import { type Component, For, onCleanup } from 'solid-js'
import {
  Mat4,
  type Mat4Like,
  Object3D,
  type Object3DRef,
  OrthographicCamera,
  PerspectiveCamera,
  Quat,
  type QuatLike,
  type Vec3Like,
} from 'solid-webgpu'
import { getAccessor } from './get-accessor'
import { getMesh } from './get-mesh'
import { getPunctualLight } from './get-punctual-light'
import type { LoaderContext } from './types'

export const getNode = async (index: number, context: LoaderContext) => {
  const json = context.json.nodes?.[index]
  if (!json) {
    throw new Error('node not found')
  }
  const lightExtension = (json.extensions as { KHR_lights_punctual?: { light?: unknown } } | undefined)
    ?.KHR_lights_punctual
  const lightIndex = lightExtension?.light
  if (lightExtension && (!Number.isInteger(lightIndex) || (lightIndex as number) < 0)) {
    throw new Error(`Node ${index} has an invalid KHR_lights_punctual light index`)
  }
  const lights = lightIndex === undefined ? [] : [getPunctualLight(lightIndex as number, context)]
  if (json.skin !== undefined && json.mesh === undefined) throw new Error(`Node ${index} has a skin but no mesh`)
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

  let meshes: Awaited<ReturnType<typeof getMesh>> = []
  if (json.mesh !== undefined) {
    const meshJson = context.json.meshes?.[json.mesh]
    if (!meshJson) throw new Error(`Node ${index} references a missing mesh`)
    const weights = context.nodeWeights.get(index)
    let skin: { joints: number[]; inverseBindMatrices: Float32Array } | undefined
    if (json.skin !== undefined) {
      const skinJson = context.json.skins?.[json.skin]
      if (!skinJson) throw new Error(`Node ${index} references a missing skin`)
      let inverseBindMatrices = new Float32Array(skinJson.joints.length * 16)
      for (let joint = 0; joint < skinJson.joints.length; joint++)
        inverseBindMatrices[joint * 16] =
          inverseBindMatrices[joint * 16 + 5] =
          inverseBindMatrices[joint * 16 + 10] =
          inverseBindMatrices[joint * 16 + 15] =
            1
      if (skinJson.inverseBindMatrices !== undefined) {
        const accessor = context.withCache(`accessor_${skinJson.inverseBindMatrices}`, () =>
          getAccessor(skinJson.inverseBindMatrices!, context),
        )
        if (accessor.type !== 'MAT4' || accessor.componentType !== 5126 || accessor.count !== skinJson.joints.length) {
          throw new Error(`Skin ${json.skin} inverseBindMatrices must be a FLOAT MAT4 per joint`)
        }
        inverseBindMatrices = Float32Array.from(accessor.bufferData as Float32Array)
      }
      for (const joint of skinJson.joints) {
        if (!context.json.nodes?.[joint]) throw new Error(`Skin ${json.skin} references missing joint node ${joint}`)
      }
      skin = { joints: skinJson.joints, inverseBindMatrices }
    }
    meshes = await getMesh(json.mesh, context, weights ? () => weights.value : undefined, skin)
  }

  const childNodes: Component[] = []
  for (const child of json.children ?? []) {
    const childNode = await context.withCache(`node_${child}`, () => getNode(child, context))
    childNodes.push(childNode)
  }
  const cameraJson = json.camera === undefined ? undefined : context.json.cameras?.[json.camera]
  if (json.camera !== undefined && !cameraJson) throw new Error(`Node ${index} references a missing camera`)
  const Camera =
    cameraJson?.type === 'perspective'
      ? () => (
          <PerspectiveCamera
            label={cameraJson.name ?? `glTF camera ${json.camera}`}
            fov={cameraJson.perspective!.yfov}
            aspect={cameraJson.perspective!.aspectRatio}
            near={cameraJson.perspective!.znear}
            far={cameraJson.perspective!.zfar ?? Infinity}
          />
        )
      : cameraJson?.type === 'orthographic'
        ? () => (
            <OrthographicCamera
              label={cameraJson.name ?? `glTF camera ${json.camera}`}
              left={-cameraJson.orthographic!.xmag}
              right={cameraJson.orthographic!.xmag}
              bottom={-cameraJson.orthographic!.ymag}
              top={cameraJson.orthographic!.ymag}
              near={cameraJson.orthographic!.znear}
              far={cameraJson.orthographic!.zfar}
            />
          )
        : () => null

  const Node: Component = () => {
    let ref: Object3DRef | undefined
    onCleanup(() => {
      if (ref) {
        context.nodeRefs.get(index)?.delete(ref)
      }
    })
    return (
      <Object3D
        ref={value => {
          ref = value as Object3DRef
          let refs = context.nodeRefs.get(index)
          if (!refs) {
            refs = new Set()
            context.nodeRefs.set(index, refs)
          }
          refs.add(ref)
        }}
        label={json.name ?? `glTF node ${index}`}
        scale={scale}
        quaternion={quaternion}
        position={position}
      >
        <Camera />
        <For each={lights}>{Light => <Light />}</For>
        <For each={meshes}>{Mesh => <Mesh />}</For>
        <For each={childNodes}>{Child => <Child />}</For>
      </Object3D>
    )
  }
  return Node
}
