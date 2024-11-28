import { resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { batch, createEffect, createMemo, mergeProps, ParentProps, splitProps, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import { SceneContext, SceneContextT } from './context'
import { tokenizer } from './tokenizer'
import { CameraContext } from './types'

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await _adapter?.requestDevice()!

export type CanvasProps = ParentProps & {
  width?: number
  height?: number
  format?: GPUTextureFormat
  autoClear?: boolean
  samples?: number
  camera?: CameraContext
  ref?: (v: HTMLCanvasElement) => void
}
export const Canvas = (_props: CanvasProps) => {
  const defaultProps = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    samples: 4
  }

  const [cProps, _p] = splitProps(_props, ['ref', 'children'])
  const props = mergeProps(defaultProps, _p)

  const [sceneContext, setSceneContext] = createStore<SceneContextT>({
    ...props,

    device: _device,

    parent: {},
    mesh: {},
    object3d: {}
  })

  createEffect(() => setSceneContext('width', props.width))
  createEffect(() => setSceneContext('height', props.height))
  createEffect(() => setSceneContext('format', props.format))
  createEffect(() => setSceneContext('autoClear', props.autoClear))
  createEffect(() => setSceneContext('samples', props.samples))
  createEffect(() => setSceneContext('camera', props.camera))

  createEffect(() => {
    console.log('111', sceneContext.object3d)
  })

  /**
   * resize swapchain
   */
  createEffect(() => {
    const { canvas, context, device } = sceneContext
    if (!canvas || !context) {
      return
    }
    context.configure({
      device,
      format: props.format,
      alphaMode: 'premultiplied'
    })
    const size = [canvas.width, canvas.height]
    const usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    const sampleCount = props.samples

    let _msaaTexture = untrack(() => sceneContext._msaaTexture)
    if (_msaaTexture) _msaaTexture.destroy()
    _msaaTexture = device.createTexture({
      format: props.format,
      size,
      usage,
      sampleCount
    })
    let _depthTexture = untrack(() => sceneContext._depthTexture)
    if (_depthTexture) _depthTexture.destroy()
    _depthTexture = device.createTexture({
      format: 'depth24plus-stencil8',
      size,
      usage,
      sampleCount
    })

    batch(() => {
      setSceneContext('_msaaTexture', _msaaTexture)
      setSceneContext('_msaaTextureView', _msaaTexture.createView())
      setSceneContext('_depthTexture', _depthTexture)
      setSceneContext('_depthTextureView', _depthTexture.createView())
    })
  })

  return (
    <SceneContext.Provider value={[sceneContext, setSceneContext]}>
      {untrack(() => {
        const tokens = resolveTokens(tokenizer, () => cProps.children)
        const data = createMemo(() =>
          tokens().map(v => ({
            ...v.data,
            children: 'resolveChildren' in v.data ? v.data.resolveChildren?.(v.data) : undefined
          }))
        )

        const canvas = (<canvas width={props.width} height={props.height} />) as HTMLCanvasElement

        batch(() => {
          setSceneContext('canvas', canvas)
          setSceneContext('context', canvas.getContext('webgpu')!)
        })

        cProps.ref?.(canvas)

        // useRender({ props, canvas, sceneContext, scene: data })

        return canvas
      })}
    </SceneContext.Provider>
  )
}
