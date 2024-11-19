import { resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { Mat4, Quat, Vec3 } from 'math'
import { createContext, createMemo, createUniqueId, mergeProps, ParentProps, untrack, useContext } from 'solid-js'
import { useRender } from './render'
import { CameraToken, Token, tokenizer } from './tokenizer'

const defaultCameraToken: CameraToken = {
  type: ['Object3D'],
  id: createUniqueId(),
  label: '',
  resolve: () => [],
  matrix: Mat4.create(),
  position: Vec3.create(),
  quaternion: Quat.create(),
  scale: Vec3.create(),
  projectionMatrix: new Mat4(),
  viewMatrix: new Mat4(),
  projectionViewMatrix: new Mat4(),
  _lookAtMatrix: new Mat4()
}

export type SceneContextT = {
  nodes: Record<string, Token>
}

const SceneContext = createContext<SceneContextT>()

export type CanvasProps = ParentProps & {
  width?: number
  height?: number
  format?: GPUTextureFormat
  autoClear?: boolean
  samples?: number
  camera?: CameraToken
}

export const useSceneContext = () => useContext(SceneContext)!

export const Canvas = (_props: CanvasProps) => {
  const props = mergeProps(
    {
      width: 960,
      height: 540,
      format: navigator.gpu.getPreferredCanvasFormat(),
      autoClear: true,
      samples: 4,
      camera: defaultCameraToken
    },
    _props
  ) as Required<CanvasProps>

  const sceneContext: SceneContextT = { nodes: {} }

  return (
    <>
      <SceneContext.Provider value={sceneContext}>
        {untrack(() => {
          const tokens = resolveTokens(tokenizer, () => props.children)
          const data = createMemo(() => tokens().map(v => ({ ...v.data, children: v.data.resolve(v.data) })))

          const canvas = (<canvas width={props.width} height={props.height} />) as HTMLCanvasElement

          useRender({ props, canvas, sceneContext, scene: data })

          return canvas
        })}
      </SceneContext.Provider>
    </>
  )
}
