import { createToken } from '@solid-primitives/jsx-tokenizer'
import { createEffect, JSX } from 'solid-js'
import {
  CommonTokenProps,
  MaterialToken,
  SamplerToken,
  TextureToken,
  Token,
  tokenizer,
  UniformBufferToken,
  UniformToken,
  useCommonToken,
  useJSXPropArrayToken
} from './tokenizer'
import { Optional, TypedArray } from './utils'

export type MaterialProps = CommonTokenProps<MaterialToken> & {
  uniforms?: JSX.Element[]
  shaderCode: string
  cullMode?: GPUCullMode
  transparent?: boolean
  depthTest?: boolean
  depthWrite?: boolean
  blending?: GPUBlendState
}

export const isMaterial = (v: Token): v is MaterialToken => v.type.includes('Material')

export const isUniform = (v: Token): v is UniformToken => v.type.includes('Uniform')

export const isUniformBuffer = (v: Token): v is UniformBufferToken => v.type.includes('UniformBuffer')

export const Material = createToken(tokenizer, (props: MaterialProps) => {
  const token = useCommonToken<MaterialToken>(['Material'], props)

  props.ref?.(token)

  useJSXPropArrayToken('uniforms', props, token, isUniform)

  createEffect(() => (token.shaderCode = props.shaderCode))
  createEffect(() => (token.cullMode = props.cullMode ?? 'back'))
  createEffect(() => (token.transparent = props.transparent ?? false))
  createEffect(() => (token.depthTest = props.depthTest ?? true))
  createEffect(() => (token.depthWrite = props.depthWrite ?? true))
  createEffect(() => (token.blending = props.blending))

  return token
})

export type UniformBufferProps = CommonTokenProps<UniformBufferToken> & {
  value: TypedArray | ArrayBuffer
}
export const UniformBuffer = createToken(tokenizer, (props: UniformBufferProps) => {
  const token = useCommonToken<UniformBufferToken>(['Uniform', 'UniformBuffer'], props)
  props.ref?.(token)

  createEffect(() => (token.value = props.value))

  return token
})

export type TextureProps = CommonTokenProps<TextureToken> & {
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
}
export const Texture = createToken(tokenizer, (props: TextureProps) => {
  const token = useCommonToken<TextureToken>(['Uniform', 'Texture'], props)
  props.ref?.(token)

  createEffect(() => (token.descriptor = props.descriptor))
  createEffect(() => (token.image = props.image))

  return token
})

export type SamplerProps = CommonTokenProps<SamplerToken> & {
  descriptor: GPUSamplerDescriptor
}
export const Sampler = createToken(tokenizer, (props: SamplerProps) => {
  const token = useCommonToken<SamplerToken>(['Uniform', 'Sampler'], props)
  props.ref?.(token)

  createEffect(() => (token.descriptor = props.descriptor))

  return token
})
