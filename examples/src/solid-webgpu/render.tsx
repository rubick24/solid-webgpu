import createRAF from '@solid-primitives/raf'
import { Mat4, Vec3 } from 'math'
import { Accessor, onCleanup } from 'solid-js'
import { isCamera } from './camera'
import { SceneContextT } from './canvas'
import { isMesh } from './mesh'
import { isObject3D } from './object3d'
import { isPunctualLight } from './punctual_light'
import { CameraToken, MeshToken, Object3DToken, PunctualLightToken, Token } from './tokenizer'

export type RenderContext = {
  canvas: HTMLCanvasElement
  sceneContext: SceneContextT
  scene: Accessor<Token[]>
  camera: Accessor<CameraToken>
}

const traverse = (node: Token, fn: (v: Token) => boolean | void) => {
  if (fn(node)) return

  if (node.children) {
    for (const child of node.children) {
      traverse(child, fn)
    }
  }
}

const sort = (
  nodes: Token[],
  camera: CameraToken
): {
  renderList: MeshToken[]
  lightList: PunctualLightToken[]
} => {
  const renderList: MeshToken[] = []
  const lightList: PunctualLightToken[] = []

  camera.projectionViewMatrix.copy(camera.projectionMatrix).multiply(camera.viewMatrix)

  nodes.forEach(node =>
    traverse(node, v => {
      if (isPunctualLight(v)) {
        lightList.push(v)
      } else if (isMesh(v)) {
        renderList.push(v)
      }
    })
  )

  renderList.sort((a, b) => {
    let res = 0
    // TODO: handle depthTest disabled

    Vec3.set(tempVec3, b.matrix[12], b.matrix[13], b.matrix[14])
    Vec3.transformMat4(tempVec3, tempVec3, camera.projectionViewMatrix)
    const tempZ = tempVec3.z
    Vec3.set(tempVec3, a.matrix[12], a.matrix[13], a.matrix[14])
    Vec3.transformMat4(tempVec3, tempVec3, camera.projectionViewMatrix)
    res = res || tempZ - tempVec3.z
    return res
  })

  return { renderList, lightList }
}

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await _adapter?.requestDevice()

// const cache = new Map<string, unknown>()
// const withCache = createWithCache(cache)

export const useRender = (ctx: RenderContext) => {
  const { canvas, sceneContext, scene: s, camera: c } = ctx
  const context = canvas.getContext('webgpu')!

  const updateMatrix = (v: Token) => {
    if (!isObject3D(v)) {
      return
    }

    const { matrix, quaternion, position, scale } = v
    Mat4.fromRotationTranslationScale(matrix, quaternion, position, scale)
    if (v.parent) {
      const p = sceneContext.nodes[v.parent] as Object3DToken
      Mat4.mul(matrix, p.matrix, matrix)
    }
    if (isCamera(v)) {
      v.viewMatrix.copy(v.matrix).invert()
    }

    if (!v.children) {
      return
    }
    for (const child of v.children) {
      updateMatrix(child)
    }
  }

  const [running, start, stop] = createRAF(t => {
    const scene = s()
    const camera = c()
    scene.map(v => updateMatrix(v))
    const { renderList, lightList } = sort(scene, camera)

    console.log(renderList, lightList)
  })
  start()

  setTimeout(() => {
    stop()
  }, 100)

  onCleanup(() => stop())
}

const tempVec3 = Vec3.create()
const builtinAttributeNames = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']
