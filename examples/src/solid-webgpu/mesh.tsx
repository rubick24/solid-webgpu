import { createToken } from '@solid-primitives/jsx-tokenizer'
import { JSX } from 'solid-js'
import { Object3DProps, useObject3DToken } from './object3d'
import { GeometryToken, MaterialToken, MeshToken, Token, tokenizer, useJSXPropToken } from './tokenizer'

export type MeshProps = Omit<Object3DProps, 'ref'> & {
  ref?: (v: MeshToken) => void
  geometry?: JSX.Element
  material?: JSX.Element
}

export const isGeometry = (v: Token): v is GeometryToken => v.type.includes('Geometry')
export const isMaterial = (v: Token): v is MaterialToken => v.type.includes('Material')

export const isMesh = (v: Token): v is MeshToken => v.type.includes('Mesh')

export const Mesh = createToken(tokenizer, (props: MeshProps) => {
  const token = useObject3DToken(['Mesh'], props) as MeshToken
  props.ref?.(token)

  useJSXPropToken('geometry', props, token, isGeometry)
  useJSXPropToken('material', props, token, isMaterial)

  return token
})
