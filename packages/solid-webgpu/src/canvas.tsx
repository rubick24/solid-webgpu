import { Vec3 } from 'math'
import { mergeProps, ParentProps, splitProps } from 'solid-js'
import { createRender } from './create-render'
import { CameraRef } from './types'

const tempVec3 = Vec3.create()

export type CanvasProps = ParentProps & {
  width?: number
  height?: number
  format?: GPUTextureFormat
  autoClear?: boolean
  clearValue?: GPUColor
  sampleCount?: number
  camera?: CameraRef
  ref?: (v: HTMLCanvasElement) => void
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

  const [cProps, _props] = splitProps(props, ['children', 'ref'])
  const propsWithDefault = mergeProps(defaultProps, _props)

  const canvas = (<canvas width={propsWithDefault.width} height={propsWithDefault.height} />) as HTMLCanvasElement
  cProps.ref?.(canvas)

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
      context
    }),
    () => cProps.children
  )

  return canvas
}
