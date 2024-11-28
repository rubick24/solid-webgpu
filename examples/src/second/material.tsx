import { createEffect, JSX, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import { MaterialContextProvider, useMaterialContext, useMeshContext, useSceneContext } from './context'
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

  setMesh('geometry', ref)

  createEffect(() => setStore('shaderCode', props.shaderCode))
  createEffect(() => setStore('cullMode', props.cullMode ?? 'back'))
  createEffect(() => setStore('transparent', props.transparent ?? false))
  createEffect(() => setStore('depthTest', props.depthTest ?? true))
  createEffect(() => setStore('depthWrite', props.depthWrite ?? true))

  const [sceneContext] = useSceneContext()

  // createEffect(() => {
  //   const bindGroupLayout = store.uniforms.map((u, i): GPUBindGroupLayoutEntry => {

  //   })
  // })
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

  const ref = { ..._ref, texture: [store, setStore] satisfies StoreContext<TextureContext> }
  props.ref?.(ref)

  const [m, setM] = useMaterialContext()
  setM('uniforms', v => v.concat(ref))

  const [sceneContext] = useSceneContext()

  // sync texture
  createEffect(() => {
    const { device, format } = sceneContext
    const t = store
    const target = device.createTexture({
      ...t.descriptor,
      format: t.descriptor.format ?? format,
      usage:
        (t.descriptor.usage ?? 0) |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST
    })
    if ('image' in t && t.image) {
      device.queue.copyExternalImageToTexture({ source: t.image }, { texture: target }, t.descriptor.size)
    }
    setStore('texture', target)
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
        value: new Float32Array(props.buildInType === 'base' ? 80 : 16 * 4)
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

  const ref = { ..._ref, uniformBuffer: [store, setStore] satisfies StoreContext<UniformBufferContext> }
  props.ref?.(ref)

  const [m, setM] = useMaterialContext()
  setM('uniforms', v => v.concat(ref))

  const [sceneContext] = useSceneContext()

  // sync uniformBuffer
  createEffect(() => {
    const { device } = sceneContext
    const buffer = createBuffer({
      device,
      data: store.value as TypedArray,
      usage: GPUBufferUsage.UNIFORM,
      label: `uniform buffer ${ref.node[0].id} ${ref.node[0].label}`
    })
    setStore('buffer', buffer)
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
