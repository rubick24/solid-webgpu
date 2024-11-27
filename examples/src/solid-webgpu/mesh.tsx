import { createToken, resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { JSX } from 'solid-js'
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
  const token = useObject3DToken(['Mesh'], props) as MeshToken
  props.ref?.(token)

  // useJSXPropToken('geometry', props, token, isGeometry)
  // useJSXPropToken('material', props, token, isMaterial)

  // const [sceneContext, setSceneContext] = useSceneContext()

  const g = resolveTokens(tokenizer, () => props.geometry)
  const geometry = () => g()[0].data as GeometryToken

  const m = resolveTokens(tokenizer, () => props.material)
  const material = () => m()[0].data as MaterialToken

  // createEffect(() => setSceneContext('mesh', token.id, 'geometry', geometry()))
  // createEffect(() => setSceneContext('mesh', token.id, 'material', material()))

  return token
})
