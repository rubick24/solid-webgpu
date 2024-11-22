import { createTokenizer, resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { Mat4, Quat, Vec3 } from 'math'
import { createEffect, createUniqueId, JSX, onCleanup, ParentProps } from 'solid-js'
import { createMutable } from 'solid-js/store'
import { useSceneContext } from './scene_context'
import { Optional, TypedArray } from './utils'

// type MapToAccessor<T extends { [k: string]: unknown }> = {
//   [k in keyof T]-?: Accessor<T[k]>
// }
export type CommonTokenAttr = {
  type: string[]
  id: string
  label: string
  parent?: string
}
export type CommonTokenProps<T = Token> = {
  label?: string
  ref?: (v: T) => void
}

export type ParentTokenAttr = {
  resolveChildren?: (v: Token) => Token[]
  children?: Token[]
}

export type Object3DToken = CommonTokenAttr &
  ParentTokenAttr & {
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

export type GeometryToken = CommonTokenAttr & {
  vertexBuffers: VertexBufferToken[]
  indexBuffer?: IndexBufferToken

  topology?: GPUPrimitiveTopology
  instanceCount?: number
  drawRange?: { start: number; count: number }
}
export type VertexBufferToken = CommonTokenAttr & {
  attribute?: {
    name: string
    type: string
  }
  layout: GPUVertexBufferLayout
  buffer: TypedArray
}
export type IndexBufferToken = CommonTokenAttr & {
  buffer: TypedArray
  arrayStride: number
}

export type MaterialToken = CommonTokenAttr & {
  uniforms: UniformToken[]
  shaderCode: string
  cullMode: GPUCullMode
  transparent: boolean
  depthTest: boolean
  depthWrite: boolean
  blending?: GPUBlendState
}

export type SamplerToken = CommonTokenAttr & {
  descriptor: GPUSamplerDescriptor
}
export type TextureToken = CommonTokenAttr & {
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
}
export type UniformBufferToken = CommonTokenAttr & {
  value: TypedArray | ArrayBuffer
}
// TODO: external texture ?
export type UniformToken = SamplerToken | TextureToken | UniformBufferToken

export type Token =
  | Object3DToken
  | CameraToken
  | PunctualLightToken
  | MeshToken
  | GeometryToken
  | MaterialToken
  | UniformToken
  | VertexBufferToken
  | IndexBufferToken

export const tokenizer = createTokenizer<Token>({ name: 'WebGPU Tokenizer' })

export const useCommonToken = <T extends CommonTokenAttr = CommonTokenAttr>(
  type: string[],
  props: { label?: string },
  init?: object
) => {
  const token = createMutable<T>({
    type: type,
    id: createUniqueId(),
    label: '',
    ...init
  } as T)

  const scene = useSceneContext()
  scene.nodes[token.id] = token as unknown as Token
  onCleanup(() => {
    delete scene.nodes[token.id]
  })

  createEffect(() => (token.label = props.label ?? ''))

  return token
}

export const useParentToken = (props: ParentProps) => {
  const children = resolveTokens(tokenizer, () => props.children)
  const resolve = (p: Token) =>
    children().map(v => {
      return { ...v.data, children: 'children' in v.data ? v.data.resolveChildren?.(p) : undefined, parent: v.data.id }
    })

  return resolve
}

export const useJSXPropToken = <K extends string, T extends Token>(
  name: K,
  props: { [k in K]?: JSX.Element },
  token: { [k in K]?: T },
  guard: (v: Token) => v is T
) => {
  const resolved = resolveTokens(tokenizer, () => props[name])

  createEffect(() => {
    const t = resolved()[0]?.data
    if (!t) {
      return
    }
    if (guard(t)) {
      token[name] = t
    } else {
      throw new Error(`jsx provided is not suitable with '${name}'`)
    }
  })
}

export const useJSXPropArrayToken = <K extends string, T extends Token>(
  name: K,
  props: { [k in K]?: JSX.Element },
  token: { [k in K]?: T[] },
  guard: (v: Token) => v is T
) => {
  const resolved = resolveTokens(tokenizer, () => props[name])

  createEffect(() => {
    const t = resolved().map(v => v.data)

    const r = t.filter(v => {
      if (guard(v)) {
        return true
      } else {
        throw new Error(`jsx provided is not suitable with '${name}'`)
      }
    }) as T[]

    token[name] = r
  })
}
