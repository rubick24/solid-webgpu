import { Mat3, Mat4, Vec3 } from 'math'
import { createEffect, JSX, onCleanup, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  MaterialContextProvider,
  useMaterialContext,
  useMeshContext,
  useObject3DContext,
  useSceneContext
} from './context'
import { CommonNodeProps, CommonNodeRef, createNodeContext } from './object3d'
import {
  MaterialContext,
  Optional,
  SamplerContext,
  StoreContext,
  TextureContext,
  TypedArray,
  UniformBufferContext
} from './types'
import { createBuffer, imageBitmapFromImageUrl, white1pxBase64 } from './utils'

type MaterialRefExtra = {
  material: StoreContext<MaterialContext>
}
export type MaterialRef = CommonNodeRef<MaterialRefExtra>
export type MaterialProps = CommonNodeProps<MaterialRefExtra> & {
  uniforms?: JSX.Element
  shaderCode: string
  cullMode?: GPUCullMode
  transparent?: boolean
  depthTest?: boolean
  depthWrite?: boolean
  blending?: GPUBlendState
}

const builtInBufferLength = {
  base: 80,
  punctual_lights: 16 * 4
} as const

export const Material = (props: MaterialProps) => {
  const { ref: _ref, Provider } = createNodeContext(['Material'], props)
  const [store, setStore] = createStore<MaterialContext>({
    uniforms: [],
    shaderCode: '',
    cullMode: 'back',
    transparent: false,
    depthTest: true,
    depthWrite: true
  })

  const ref = { ..._ref, material: [store, setStore] satisfies StoreContext<MaterialContext> }
  props.ref?.(ref)

  const [_, setMesh] = useMeshContext()

  setMesh('material', ref)

  createEffect(() => setStore('shaderCode', props.shaderCode))
  createEffect(() => setStore('cullMode', props.cullMode ?? 'back'))
  createEffect(() => setStore('transparent', props.transparent ?? false))
  createEffect(() => setStore('depthTest', props.depthTest ?? true))
  createEffect(() => setStore('depthWrite', props.depthWrite ?? true))

  const [sceneContext] = useSceneContext()

  createEffect(() => {
    const { device } = sceneContext
    const layoutEntries = store.uniforms.map((u, i): GPUBindGroupLayoutEntry => {
      if ('texture' in u) {
        return {
          binding: i,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        }
      } else if ('sampler' in u) {
        return {
          binding: i,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        }
      } else {
        return {
          binding: i,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {}
        }
      }
    })
    const layout = device.createBindGroupLayout({
      entries: layoutEntries
    })
    setStore('bindGroupLayout', layout)
  })
  createEffect(() => {
    const bindGroupEntries = store.uniforms.map((u, i): GPUBindGroupEntry | undefined => {
      if ('texture' in u) {
        const t = u.texture[0].texture
        if (!t) {
          return
        }
        return {
          binding: i,
          resource: t && 'createView' in t ? t.createView() : t
        }
      } else if ('sampler' in u) {
        const s = u.sampler[0].sampler
        if (!s) {
          return
        }
        return { binding: i, resource: s }
      } else {
        const b = u.uniformBuffer[0].buffer
        if (!b) {
          return
        }
        return { binding: i, resource: { buffer: b } }
      }
    })
    if (bindGroupEntries.some(v => !v)) {
      return
    }
    setStore('bindGroupEntries', bindGroupEntries as GPUBindGroupEntry[])
  })

  createEffect(() => {
    const { device } = sceneContext
    const { bindGroupLayout, bindGroupEntries } = store

    if (bindGroupLayout && bindGroupEntries?.length) {
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: bindGroupEntries
      })
      setStore('bindGroup', bindGroup)
    }
  })

  return (
    <Provider>
      <MaterialContextProvider value={[store, setStore]}>{props.uniforms}</MaterialContextProvider>
    </Provider>
  )
}

type TextureRefExtra = {
  texture: StoreContext<TextureContext>
}
export type TextureRef = CommonNodeRef<TextureRefExtra>
export type TextureProps = CommonNodeProps<TextureRefExtra> & {
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
}
export const Texture = (props: TextureProps) => {
  const { ref: _ref } = createNodeContext(['Texture'], props)
  const [store, setStore] = createStore<TextureContext>({
    descriptor: untrack(() => props.descriptor)
  })
  createEffect(() => setStore('descriptor', props.descriptor))
  createEffect(() => setStore('image', props.image))

  const ref = { ..._ref, texture: [store, setStore] satisfies StoreContext<TextureContext> }
  props.ref?.(ref)

  const [m, setM] = useMaterialContext()
  setM('uniforms', v => v.concat(ref))

  const [sceneContext] = useSceneContext()

  // sync texture
  createEffect(() => {
    const { device, format } = sceneContext

    console.log('tex', store.descriptor, store.image)
    const target = device.createTexture({
      ...store.descriptor,
      format: store.descriptor.format ?? format,
      usage:
        (store.descriptor.usage ?? 0) |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST
    })
    if (store.image) {
      device.queue.copyExternalImageToTexture({ source: store.image }, { texture: target }, store.descriptor.size)
    }
    setStore('texture', target)

    onCleanup(() => target.destroy())
  })

  return null
}

type SamplerRefExtra = {
  sampler: StoreContext<SamplerContext>
}
export type SamplerRef = CommonNodeRef<SamplerRefExtra>
export type SamplerProps = CommonNodeProps<SamplerRefExtra> & {
  descriptor: GPUSamplerDescriptor
}
export const Sampler = (props: SamplerProps) => {
  const { ref: _ref } = createNodeContext(['Sampler'], props)
  const [store, setStore] = createStore<SamplerContext>({
    descriptor: untrack(() => props.descriptor)
  })

  createEffect(() => setStore('descriptor', props.descriptor))

  const ref = { ..._ref, sampler: [store, setStore] satisfies StoreContext<SamplerContext> }
  props.ref?.(ref)

  const [m, setM] = useMaterialContext()
  setM('uniforms', v => v.concat(ref))

  const [sceneContext] = useSceneContext()

  // sync sampler
  createEffect(() => {
    const sampler = sceneContext.device.createSampler(store.descriptor)
    setStore('sampler', sampler)
  })

  return null
}

type UniformBufferRefExtra = {
  uniformBuffer: StoreContext<UniformBufferContext>
}
export type UniformBufferRef = CommonNodeRef<UniformBufferRefExtra>
export type UniformBufferProps = CommonNodeProps<UniformBufferRefExtra> &
  (
    | {
        value: TypedArray | ArrayBuffer
      }
    | { buildInType: 'base' | 'punctual_lights' }
  )
export const UniformBuffer = (props: UniformBufferProps) => {
  const { ref: _ref } = createNodeContext(['UniformBuffer'], props)

  const initial: UniformBufferContext = untrack(() => {
    if ('value' in props) {
      return {
        value: props.value
      }
    } else {
      return {
        builtIn: props.buildInType,
        value: new Float32Array(builtInBufferLength[props.buildInType])
      }
    }
  })

  const [store, setStore] = createStore<UniformBufferContext>(initial)

  createEffect(() => {
    if ('buildInType' in props) {
      setStore('builtIn', props.buildInType)
    } else {
      setStore('value', props.value)
    }
  })

  const [o3d] = useObject3DContext()
  const [scene] = useSceneContext()

  /**
   * update built-in uniform buffer
   */
  createEffect(() => {
    if (store.builtIn === 'base') {
      const bo = new Float32Array(builtInBufferLength.base)
      // const bo = store.value as Float32Array

      const camera = scene.currentCamera
      if (!camera) {
        console.warn('no camera found when updating built-in uniform buffer')
        return
      }

      const modelMatrix = Mat4.copy(bo.subarray(0, 16), o3d.matrix)
      const viewMatrix = Mat4.copy(bo.subarray(16, 32), camera.camera[0].viewMatrix)
      // projectionMatrix
      Mat4.copy(bo.subarray(32, 48), camera.camera[0].projectionMatrix)
      const modelViewMatrix = Mat4.copy(bo.subarray(48, 64), viewMatrix)
      Mat4.mul(modelViewMatrix, modelViewMatrix, modelMatrix)
      // normalMatrix
      Mat3.normalFromMat4(bo.subarray(64, 73), modelViewMatrix)
      // cameraPosition
      Vec3.copy(bo.subarray(76, 79), camera.object3d[0].matrix.subarray(12, 15))

      setStore('value', bo)
    } else if (store.builtIn === 'punctual_lights') {
      const lightValues = new Float32Array(builtInBufferLength.punctual_lights)
      // const lightValues = store.value as Float32Array

      const { lightList } = scene
      for (let i = 0; i < lightList.length; i++) {
        const light = lightList[i]
        const lightO3d = light.object3d[0]
        const lightCtx = light.punctualLight[0]
        const offset = i * 16
        if (lightValues.length < offset + 16) {
          console.warn('extra lights are ignored')
          break
        }
        // position
        Vec3.copy(lightValues.subarray(offset + 0, offset + 3), lightO3d.matrix.subarray(12, 15))
        // direction
        Vec3.copy(lightValues.subarray(offset + 4, offset + 7), lightO3d.matrix.subarray(8, 11))
        Vec3.copy(lightValues.subarray(offset + 8, offset + 11), lightCtx.color)

        lightValues[offset + 11] = lightCtx.intensity
        lightValues[offset + 12] = lightCtx.range ?? Infinity
        lightValues[offset + 13] = lightCtx.innerConeAngle
        lightValues[offset + 14] = lightCtx.outerConeAngle

        const m: Record<typeof lightCtx.lightType, number> = {
          directional: 1,
          point: 2,
          spot: 3
        }

        new DataView(lightValues.buffer).setUint32((offset + 15) * 4, m[lightCtx.lightType], true)

        setStore('value', lightValues)
      }
    }
  })

  const ref = { ..._ref, uniformBuffer: [store, setStore] satisfies StoreContext<UniformBufferContext> }
  props.ref?.(ref)

  const [m, setM] = useMaterialContext()
  setM('uniforms', v => v.concat(ref))

  const [sceneContext] = useSceneContext()

  // sync uniformBuffer
  createEffect(() => {
    const { device } = sceneContext
    const data = store.value
    const buffer = createBuffer({
      device,
      data: data,
      usage: GPUBufferUsage.UNIFORM,
      label: `uniform buffer ${ref.node[0].id} ${ref.node[0].label}`
    })

    setStore('buffer', buffer)

    onCleanup(() => buffer.destroy())
  })

  return null
}

const defaultBitmap = await imageBitmapFromImageUrl(white1pxBase64)
export const DefaultTexture = () => {
  return (
    <Texture
      descriptor={{
        size: {
          width: defaultBitmap.width,
          height: defaultBitmap.height
        }
      }}
      image={defaultBitmap}
    />
  )
}
