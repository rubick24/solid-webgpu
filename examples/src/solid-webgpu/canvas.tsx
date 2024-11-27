import { resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { Mat4, Quat, Vec3 } from 'math'
import { batch, createEffect, createMemo, createUniqueId, mergeProps, ParentProps, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import { SceneContext, SceneContextT } from './context'
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

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await _adapter?.requestDevice()!

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

  const [sceneContext, setSceneContext] = createStore<SceneContextT>({
    ...props,
    camera: props.camera ?? defaultCameraToken,
    device: _device,

    parent: {},
    mesh: {}
    // _msaaTexture: GPUTexture
    // _msaaTextureView: GPUTextureView
    // _depthTexture: GPUTexture
    // _depthTextureView: GPUTextureView
    // _commandEncoder: GPUCommandEncoder
    // _passEncoder: GPURenderPassEncoder
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
        const tokens = resolveTokens(tokenizer, () => props.children)
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

        props.ref?.(canvas)

        console.log(333)
        // useRender({ props, canvas, sceneContext, scene: data })

        return canvas
      })}
    </SceneContext.Provider>
  )
}
