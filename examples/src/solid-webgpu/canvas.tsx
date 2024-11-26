import { resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { Mat4, Quat, Vec3 } from 'math'
import { createMemo, createUniqueId, mergeProps, ParentProps, untrack } from 'solid-js'
import { useRender } from './render'
import { SceneContext, SceneContextT } from './scene_context'
import { CameraToken, tokenizer } from './tokenizer'

const defaultCameraToken: CameraToken = {
  type: ['Object3D'],
  id: createUniqueId(),
  label: '',
  resolveChildren: () => [],
  matrix: Mat4.create(),
  position: Vec3.create(),
  quaternion: Quat.create(),
  scale: Vec3.fromValues(1, 1, 1),
  up: Vec3.fromValues(0, 1, 0),
  projectionMatrix: new Mat4(),
  viewMatrix: new Mat4(),
  projectionViewMatrix: new Mat4(),
  _lookAtMatrix: new Mat4(),

  lookAt: (target: Vec3) => {
    Mat4.targetTo(defaultCameraToken._lookAtMatrix, defaultCameraToken.position, target, defaultCameraToken.up)
    Mat4.getRotation(defaultCameraToken.quaternion, defaultCameraToken._lookAtMatrix)
  }
}

export type CanvasProps = ParentProps & {
  width?: number
  height?: number
  format?: GPUTextureFormat
  autoClear?: boolean
  samples?: number
  camera?: CameraToken
  ref?: (v: HTMLCanvasElement) => void
}
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
          const data = createMemo(() =>
            tokens().map(v => ({
              ...v.data,
              children: 'resolveChildren' in v.data ? v.data.resolveChildren?.(v.data) : undefined
            }))
          )

          const canvas = (<canvas width={props.width} height={props.height} />) as HTMLCanvasElement

          props.ref?.(canvas)

          useRender({ props, canvas, sceneContext, scene: data })

          return canvas
        })}
      </SceneContext.Provider>
    </>
  )
}
