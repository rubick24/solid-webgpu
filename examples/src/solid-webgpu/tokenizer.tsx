import { createToken, createTokenizer, resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { DEG2RAD, Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'
import { Accessor, createEffect, createMemo, createUniqueId, mergeProps, ParentProps, splitProps } from 'solid-js'
import { useRender } from './render'
import { createWithCache } from './utils'

// type MapToAccessor<T extends { [k: string]: unknown }> = {
//   [k in keyof T]-?: Accessor<T[k]>
// }
type CommonTokenAttr = {
  type: string[]
  id: string
  label: string
}
type ParentTokenAttr = {
  resolve: (v: Token) => Token[]
  children?: Token[]
  parent?: Token
}

export type Object3DProps = ParentProps & {
  ref?: (v: Token) => void
  label?: string
  position?: Vec3Like
  quaternion?: QuatLike
  scale?: Vec3Like
}
export type Object3DToken = CommonTokenAttr &
  ParentTokenAttr & {
    matrix: Mat4
    position: Vec3
    quaternion: Quat
    scale: Vec3
  }

export type CameraProps = Omit<Object3DProps, 'ref'> & {
  ref?: (v: CameraToken) => void
}
export type CameraToken = Object3DToken & {
  projectionMatrix: Mat4
  viewMatrix: Mat4
  projectionViewMatrix: Mat4
  _lookAtMatrix: Mat4
}

export type PunctualLightProps = Omit<Object3DProps, 'ref'> & {
  ref?: (v: PunctualLightToken) => void
  color?: Vec3Like
  intensity?: number
  range?: number
} & ({ type: 'directional' | 'point' } | { type: 'spot'; innerConeAngle: number; outerConeAngle: number })
export type PunctualLightToken = Object3DToken & {
  color: Vec3
  intensity: number
  range?: number
  lightType: 'directional' | 'point' | 'spot'
  innerConeAngle: number
  outerConeAngle: number
}

export type Token = Object3DToken | CameraToken
export const tokenizer = createTokenizer<Token>({
  name: 'WebGPU Tokenizer'
})

export const useParentToken = (props: ParentProps): ((p: Token) => Token[]) => {
  const children = resolveTokens(tokenizer, () => props.children)
  const resolve = (p: Token) =>
    children().map(v => {
      return { ...v.data, children: v.data.resolve(p) }
    })

  return resolve
}

const cache = new Map<string, unknown>()
const withCache = createWithCache(cache)

const useObject3DToken = (props: Omit<Object3DProps, 'ref'>) => {
  const resolve = useParentToken(props)
  const id = createUniqueId()

  const token: Object3DToken = {
    type: ['Object3D'],
    id,
    label: props.label ?? '',
    resolve,

    matrix: Mat4.create(),
    position: Vec3.create(),
    quaternion: Quat.create(),
    scale: Vec3.create()
  }
  createEffect(() => {
    if (props.position) {
      token.position.copy(props.position)
    }
  })
  createEffect(() => {
    if (props.quaternion) {
      token.quaternion.copy(props.quaternion)
    }
  })
  createEffect(() => {
    if (props.scale) {
      token.scale.copy(props.scale)
    }
  })

  return token
}

export const Object3D = createToken(tokenizer, (props: Object3DProps) => {
  const token = useObject3DToken(props)
  props.ref?.(token)
  return token
})

export const Camera = createToken(tokenizer, (props: CameraProps) => {
  const t = useObject3DToken(props)
  t.type.push('Camera')
  const token: CameraToken = {
    ...t,
    projectionMatrix: new Mat4(),
    viewMatrix: new Mat4(),
    projectionViewMatrix: new Mat4(),
    _lookAtMatrix: new Mat4()
  }
  props.ref?.(token)
  return token
})

export const PunctualLight = createToken(tokenizer, (props: PunctualLightProps) => {
  const t = useObject3DToken(props)
  t.type.push('PunctualLight')

  const token: PunctualLightToken = {
    ...t,
    color: Vec3.create(),
    intensity: 1,
    range: undefined,
    lightType: 'point',
    innerConeAngle: 0,
    outerConeAngle: Math.PI / 4
  }
  props.ref?.(token)

  createEffect(() => {
    if (props.color) {
      token.color.copy(props.color)
    }
  })
  createEffect(() => (token.intensity = props.intensity ?? 1))
  createEffect(() => (token.range = props.range))
  createEffect(() => (token.lightType = props.type))
  createEffect(() => {
    if ('innerConeAngle' in props) token.innerConeAngle = props.innerConeAngle
  })
  createEffect(() => {
    if ('outerConeAngle' in props) token.outerConeAngle = props.outerConeAngle
  })

  return token
})

export type PerspectiveCameraProps = CameraProps & {
  fov?: number
  aspect?: number
  near?: number
  far?: number
}
export const PerspectiveCamera = (props: PerspectiveCameraProps) => {
  const [_local, others] = splitProps(props, ['ref', 'fov', 'aspect', 'near', 'far'])

  const local = mergeProps(
    {
      fov: 75 * DEG2RAD,
      aspect: 1,
      near: 0.1,
      far: 1000
    },
    _local
  ) as Required<PerspectiveCameraProps>

  let camera!: CameraToken

  createEffect(() => {
    Mat4.perspectiveZO(camera.projectionMatrix, local.fov, local.aspect, local.near, local.far)
  })

  return (
    <Camera
      {...others}
      ref={v => {
        camera = v
        local.ref?.(v)
      }}
    />
  )
}
export type OrthographicCameraProps = CameraProps & {
  near?: number
  far?: number
  left?: number
  right?: number
  bottom?: number
  top?: number
}
export const OrthographicCamera = (props: OrthographicCameraProps) => {
  const [_local, others] = splitProps(props, ['ref', 'near', 'far', 'left', 'right', 'bottom', 'top'])

  const local = mergeProps(
    {
      near: 0.1,
      far: 1000,
      left: -1,
      right: 1,
      bottom: -1,
      top: 1
    },
    _local
  ) as Required<OrthographicCameraProps>

  let camera!: CameraToken

  createEffect(() => {
    Mat4.orthoZO(camera.projectionMatrix, local.left, local.right, local.bottom, local.top, local.near, local.far)
  })

  return (
    <Camera
      {...others}
      ref={v => {
        camera = v
        local.ref?.(v)
      }}
    />
  )
}

const _adapter = typeof navigator !== 'undefined' ? await navigator.gpu?.requestAdapter() : null
const _device = await _adapter?.requestDevice()

type RenderContext = {
  canvas: HTMLCanvasElement
  scene: Accessor<Token[]>
  camera: Accessor<CameraToken>
}

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
type CanvasProps = ParentProps & {
  width?: number
  height?: number
  format?: GPUTextureFormat
  autoClear?: boolean
  samples?: number
  camera?: CameraToken
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

  const tokens = resolveTokens(tokenizer, () => props.children)
  const data = createMemo(() => tokens().map(v => ({ ...v.data, children: v.data.resolve(v.data) })))

  const canvas = (<canvas width={props.width} height={props.height} />) as HTMLCanvasElement

  useRender({ canvas, scene: data, camera: () => props.camera })

  return (
    <>
      {canvas}
      <div style={{ 'white-space': 'pre' }}>{JSON.stringify(data(), undefined, 2)}</div>
    </>
  )
}
