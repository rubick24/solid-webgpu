import { createTokenizer, resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { Mat4, Quat, Vec3 } from 'math'
import { ParentProps } from 'solid-js'

// type MapToAccessor<T extends { [k: string]: unknown }> = {
//   [k in keyof T]-?: Accessor<T[k]>
// }
type CommonTokenAttr = {
  type: string[]
  id: string
  label: string
  resolve: (v: Token) => Token[]
  children?: Token[]
  parent?: string
}

export type Object3DToken = CommonTokenAttr & {
  matrix: Mat4
  position: Vec3
  quaternion: Quat
  scale: Vec3
}

export type CameraToken = Object3DToken & {
  projectionMatrix: Mat4
  viewMatrix: Mat4
  projectionViewMatrix: Mat4
  _lookAtMatrix: Mat4
}

export type PunctualLightToken = Object3DToken & {
  color: Vec3
  intensity: number
  range?: number
  lightType: 'directional' | 'point' | 'spot'
  innerConeAngle: number
  outerConeAngle: number
}

export type MeshToken = Object3DToken & {
  geometry?: GeometryToken
  material?: MaterialToken
}

// TODO: token detail
export type GeometryToken = CommonTokenAttr & {}
export type MaterialToken = CommonTokenAttr & {}

export type Token = Object3DToken | CameraToken | PunctualLightToken | MeshToken | GeometryToken | MaterialToken

export const tokenizer = createTokenizer<Token>({ name: 'WebGPU Tokenizer' })

export const useParentToken = (props: ParentProps): ((p: Token) => Token[]) => {
  const children = resolveTokens(tokenizer, () => props.children)
  const resolve = (p: Token) =>
    children().map(v => {
      return { ...v.data, children: v.data.resolve(p), parent: v.data.id }
    })

  return resolve
}
