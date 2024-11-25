import { createToken } from '@solid-primitives/jsx-tokenizer'
import { createEffect, JSX } from 'solid-js'
import {
  CommonTokenProps,
  GeometryToken,
  IndexBufferToken,
  Token,
  tokenizer,
  useCommonToken,
  useJSXPropArrayToken,
  useJSXPropToken,
  VertexBufferToken
} from './tokenizer'
import { TypedArray } from './utils'

export type GeometryProps = CommonTokenProps<GeometryToken> & {
  vertexBuffers?: JSX.Element
  indexBuffer?: JSX.Element
}

export const isGeometry = (v: Token): v is GeometryToken => v.type.includes('Geometry')
export const isVertexBuffer = (v: Token): v is VertexBufferToken => v.type.includes('VertexBuffer')
export const isIndexBuffer = (v: Token): v is IndexBufferToken => v.type.includes('IndexBuffer')

export const Geometry = createToken(tokenizer, (props: GeometryProps) => {
  const token = useCommonToken<GeometryToken>(['Geometry'], props)

  props.ref?.(token)

  useJSXPropArrayToken('vertexBuffers', props, token, isVertexBuffer)
  useJSXPropToken('indexBuffer', props, token, isIndexBuffer)

  return token
})

export type VertexBufferProps = CommonTokenProps<VertexBufferToken> & {
  attribute?: {
    name: string
    type: string
  }
  layout: GPUVertexBufferLayout
  buffer: TypedArray
}
export const VertexBuffer = createToken(tokenizer, (props: VertexBufferProps) => {
  const token = useCommonToken<VertexBufferToken>(['VertexBuffer'], props)
  props.ref?.(token)

  createEffect(() => (token.attribute = props.attribute))
  createEffect(() => (token.layout = props.layout))
  createEffect(() => (token.buffer = props.buffer))

  return token
})

export type IndexBufferProps = CommonTokenProps<IndexBufferToken> & {
  buffer: TypedArray
  // arrayStride: number
}
export const IndexBuffer = createToken(tokenizer, (props: IndexBufferProps) => {
  const token = useCommonToken<IndexBufferToken>(['IndexBuffer'], props)
  props.ref?.(token)

  // createEffect(() => (token.arrayStride = props.arrayStride))
  createEffect(() => (token.buffer = props.buffer))

  return token
})
