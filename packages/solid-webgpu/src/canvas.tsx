import { Vec3 } from 'math'
import { JSX, mergeProps, ParentProps, splitProps } from 'solid-js'
import { createRender } from './create-render'
import { CameraRef } from './types'

const tempVec3 = Vec3.create()

export type CanvasProps = ParentProps &
  JSX.HTMLAttributes<HTMLCanvasElement> & {
    width?: number
    height?: number
    format?: GPUTextureFormat
    autoClear?: boolean
    clearValue?: GPUColor
    sampleCount?: number
    camera?: CameraRef
    ref?: (v: HTMLCanvasElement) => void

    update?: (t: number) => void
    updateSignal?: () => number
  }

export const Canvas = (props: CanvasProps) => {
  const defaultProps = {
    width: 960,
    height: 540,
    format: navigator.gpu.getPreferredCanvasFormat(),
    autoClear: true,
    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    sampleCount: 4
  }

  const [_props, rest] = splitProps(props, [
    'children',
    'ref',
    'width',
    'height',
    'format',
    'autoClear',
    'clearValue',
    'sampleCount',
    'camera',
    'update',
    'updateSignal'
  ])
  const propsWithDefault = mergeProps(defaultProps, _props)

  const canvas = (
    <canvas {...rest} width={propsWithDefault.width} height={propsWithDefault.height} />
  ) as HTMLCanvasElement
  propsWithDefault.ref?.(canvas)

  const context = canvas.getContext('webgpu')!

  createRender(
    () => ({
      camera: propsWithDefault.camera,
      autoClear: propsWithDefault.autoClear,
      clearValue: propsWithDefault.clearValue,
      // shared
      width: propsWithDefault.width,
      height: propsWithDefault.height,
      format: propsWithDefault.format,
      sampleCount: propsWithDefault.sampleCount,
      // render to canvas
      canvas,
      context,

      update: propsWithDefault.update,
      updateSignal: propsWithDefault.updateSignal
    }),
    () => propsWithDefault.children
  )

  return canvas
}
