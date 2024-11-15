import { Mat4 } from 'math'
import { Accessor, createEffect, onCleanup } from 'solid-js'
import { CameraToken, Token } from './tokenizer'

export type RenderContext = {
  canvas: HTMLCanvasElement
  scene: Accessor<Token[]>
  camera: Accessor<CameraToken>
}
const updateMatrix = (v: Token) => {
  const { matrix, quaternion, position, scale } = v
  Mat4.fromRotationTranslationScale(matrix, quaternion, position, scale)
  if (v.parent) {
    Mat4.mul(matrix, v.parent.matrix, matrix)
  }

  if (!v.children) {
    return
  }
  for (const child of v.children) {
    updateMatrix(child)
  }
}
const sort = (v: Token, c: CameraToken) => {}

export const useRender = (ctx: RenderContext) => {
  const { canvas, scene, camera } = ctx
  const context = canvas.getContext('webgpu')!

  createEffect(() => {
    const s = scene()
    const c = camera()
    s.map(v => updateMatrix(v))

    onCleanup(() => {
      //
    })
  })
}
