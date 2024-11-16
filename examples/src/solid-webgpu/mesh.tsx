import { createToken, resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { JSX, createEffect } from 'solid-js'
import { useSceneContext } from './canvas'
import { Object3DProps, useObject3DToken } from './object3d'
import { GeometryToken, MaterialToken, MeshToken, Token, tokenizer } from './tokenizer'

export type MeshProps = Omit<Object3DProps, 'ref'> & {
  ref?: (v: MeshToken) => void
  geometry?: JSX.Element
  material?: JSX.Element
}

export const isGeometry = (v: Token): v is GeometryToken => v.type.includes('Geometry')
export const isMaterial = (v: Token): v is MaterialToken => v.type.includes('Material')

export const isMesh = (v: Token): v is MeshToken => v.type.includes('Mesh')

export const Mesh = createToken(tokenizer, (props: MeshProps) => {
  const token = useObject3DToken(props) as MeshToken
  token.type.push('Mesh')
  Object.assign(token, {
    geometry: undefined,
    material: undefined
  })
  const scene = useSceneContext()
  scene.nodes[token.id] = token
  props.ref?.(token)

  const g = resolveTokens(tokenizer, () => props.geometry)
  const m = resolveTokens(tokenizer, () => props.material)

  createEffect(() => {
    const t = g()[0]?.data
    if (!t) {
      return
    }
    if (isGeometry(t)) {
      token.geometry = t
    } else {
      throw new Error('jsx provided is not geometry')
    }
  })

  createEffect(() => {
    const t = m()[0]?.data
    if (!t) {
      return
    }
    if (isMaterial(t)) {
      token.material = t
    } else {
      throw new Error('jsx provided is not material')
    }
  })

  return token
})
