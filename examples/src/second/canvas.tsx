import { mergeProps, ParentProps, splitProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { SceneContext, SceneContextProvider } from './context'

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await _adapter?.requestDevice()!

export type CanvasProps = ParentProps & {
  width?: number
  height?: number
  format?: GPUTextureFormat
  autoClear?: boolean
  samples?: number
  // camera?: CameraContext
  ref?: (v: HTMLCanvasElement) => void
}

export const Canvas = (props: CanvasProps) => {
  const defaultProps = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    samples: 4
  }

  const [cProps, _props] = splitProps(props, ['children', 'ref'])
  const propsWithDefault = mergeProps(defaultProps, _props)

  const [sceneContext, setSceneContext] = createStore<SceneContext>({
    ...propsWithDefault,
    device: _device
  })
  const canvas = (<canvas width={propsWithDefault.width} height={propsWithDefault.height} />) as HTMLCanvasElement
  cProps.ref?.(canvas)

  return (
    <SceneContextProvider value={[sceneContext, setSceneContext]}>
      {canvas}
      {cProps.children}
    </SceneContextProvider>
  )
}
