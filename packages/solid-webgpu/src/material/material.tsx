import { Mat3, Mat4, Vec3 } from 'math'
import { createEffect, createSignal, JSX, onCleanup, untrack } from 'solid-js'
import { createStore, produce } from 'solid-js/store'

import {
  MaterialContextProvider,
  useMaterialContext,
  useMeshContext,
  useObject3DContext,
  useSceneContext
} from '../context'
import { createNodeContext } from '../object3d'
import {
  CameraContext,
  MaterialContext,
  MaterialExtra,
  NodeProps,
  NodeRef,
  Optional,
  PunctualLightContext,
  SamplerContext,
  SamplerExtra,
  TextureContext,
  TextureExtra,
  TypedArray,
  UniformBufferContext,
  UniformBufferExtra
} from '../types'
import { createBuffer, imageBitmapFromImageUrl, white1pxBase64 } from '../utils'

export type MaterialRef = NodeRef<MaterialContext>
export type MaterialProps = NodeProps<MaterialContext> & {
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
  const { ref, Provider } = createNodeContext(['Material'], props, {
    uniforms: [],
    shaderCode: '',
    cullMode: 'back',
    transparent: false,
    depthTest: true,
    depthWrite: true
  } satisfies MaterialExtra)
  const [scene] = useSceneContext()
  const id = ref[0].id

  const [store, setStore] = createStore(scene.nodes[id] as MaterialContext)

  props.ref?.([store, setStore])

  const [_, setMesh] = useMeshContext()

  setMesh('material', id)

  createEffect(() => setStore('shaderCode', props.shaderCode))
  createEffect(() => setStore('cullMode', props.cullMode ?? 'back'))
  createEffect(() => setStore('transparent', props.transparent ?? false))
  createEffect(() => setStore('depthTest', props.depthTest ?? true))
  createEffect(() => setStore('depthWrite', props.depthWrite ?? true))

  const [sceneContext] = useSceneContext()

  createEffect(() => {
    const { device } = sceneContext
    const layoutEntries = store.uniforms.map((_u, i): GPUBindGroupLayoutEntry => {
      const u = scene.nodes[_u]
      if (u.type.includes('Texture')) {
        return {
          binding: i,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        }
      } else if (u.type.includes('Sampler')) {
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
    const bindGroupEntries = store.uniforms.map((_u, i): GPUBindGroupEntry | undefined => {
      const u = scene.nodes[_u]
      if (u.type.includes('Texture')) {
        const t = (u as TextureContext).texture
        if (!t) {
          return
        }
        return {
          binding: i,
          resource: t && 'createView' in t ? t.createView() : t
        }
      } else if (u.type.includes('Sampler')) {
        const s = (u as SamplerContext).sampler
        if (!s) {
          return
        }
        return { binding: i, resource: s }
      } else {
        const b = (u as UniformBufferContext).buffer
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

export type TextureRef = NodeRef<TextureContext>
export type TextureProps = NodeProps<TextureContext> & {
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
}
export const Texture = (props: TextureProps) => {
  const { ref } = createNodeContext(['Texture'], props, {
    descriptor: untrack(() => props.descriptor)
  } satisfies TextureExtra)
  const [scene] = useSceneContext()
  const id = ref[0].id

  const [store, setStore] = createStore(scene.nodes[id] as TextureContext)

  createEffect(() => setStore('descriptor', props.descriptor))
  createEffect(() => setStore('image', props.image))

  props.ref?.([store, setStore])

  const [m, setM] = useMaterialContext()
  setM('uniforms', v => v.concat(id))

  const [sceneContext] = useSceneContext()

  // sync texture
  createEffect(() => {
    const { device, format } = sceneContext

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

export type SamplerRef = NodeRef<SamplerContext>
export type SamplerProps = NodeProps<SamplerContext> & {
  descriptor: GPUSamplerDescriptor
}
export const Sampler = (props: SamplerProps) => {
  const { ref } = createNodeContext(['Sampler'], props, {
    descriptor: untrack(() => props.descriptor)
  } satisfies SamplerExtra)
  const [scene] = useSceneContext()
  const id = ref[0].id

  const [store, setStore] = createStore(scene.nodes[id] as SamplerContext)

  createEffect(() => setStore('descriptor', props.descriptor))

  props.ref?.([store, setStore])

  const [m, setM] = useMaterialContext()
  setM('uniforms', v => v.concat(id))

  const [sceneContext] = useSceneContext()

  // sync sampler
  createEffect(() => {
    const sampler = sceneContext.device.createSampler(store.descriptor)
    setStore('sampler', sampler)
  })

  return null
}

export type UniformBufferRef = NodeRef<UniformBufferContext>
export type UniformBufferProps = NodeProps<UniformBufferContext> &
  (
    | {
        value: TypedArray | ArrayBuffer
      }
    | { buildInType: 'base' | 'punctual_lights' }
  )
export const UniformBuffer = (props: UniformBufferProps) => {
  const initial = untrack(() => {
    if ('value' in props) {
      return {
        value: createSignal(props.value, { equals: false })
      }
    } else {
      return {
        builtIn: props.buildInType,
        value: createSignal<TypedArray | ArrayBuffer>(new Float32Array(builtInBufferLength[props.buildInType]), {
          equals: false
        })
      }
    }
  }) satisfies UniformBufferExtra

  const { ref } = createNodeContext(['UniformBuffer'], props, initial)
  const [scene, setScene] = useSceneContext()
  const id = ref[0].id

  setScene(
    'nodes',
    id,
    produce(v => {
      v.uniformBuffer = initial
    })
  )

  const [store, setStore] = createStore(scene.nodes[id] as UniformBufferContext)

  createEffect(() => {
    if ('buildInType' in props) {
      setStore('builtIn', props.buildInType)
    } else {
      store.value[1](props.value)
    }
  })

  const [o3d] = useObject3DContext()

  /**
   * update built-in uniform buffer
   */
  createEffect(() => {
    if (store.builtIn === 'base') {
      store.value[1](v => {
        const bo =
          'length' in v && v.length === builtInBufferLength.base
            ? (v as Float32Array)
            : new Float32Array(builtInBufferLength.base)
        const cameraID = scene.currentCamera
        if (!cameraID) {
          console.warn('no camera found when updating built-in uniform buffer')
          return bo
        }

        const camera = scene.nodes[cameraID] as CameraContext

        const modelMatrix = Mat4.copy(bo.subarray(0, 16), o3d.matrix[0]())
        const viewMatrix = Mat4.copy(bo.subarray(16, 32), camera.viewMatrix[0]())
        // projectionMatrix
        Mat4.copy(bo.subarray(32, 48), camera.projectionMatrix[0]())
        const modelViewMatrix = Mat4.copy(bo.subarray(48, 64), viewMatrix)
        Mat4.mul(modelViewMatrix, modelViewMatrix, modelMatrix)
        // normalMatrix
        Mat3.normalFromMat4(bo.subarray(64, 73), modelViewMatrix)
        // cameraPosition
        Vec3.copy(bo.subarray(76, 79), camera.matrix[0]().subarray(12, 15))

        return bo
      })
      // setStore('value', bo)
    } else if (store.builtIn === 'punctual_lights') {
      store.value[1](v => {
        const lightValues =
          'length' in v && v.length === builtInBufferLength.punctual_lights
            ? (v as Float32Array)
            : new Float32Array(builtInBufferLength.punctual_lights)

        const { lightList } = scene
        for (let i = 0; i < lightList.length; i++) {
          const lightID = lightList[i]
          const light = scene.nodes[lightID] as PunctualLightContext

          const offset = i * 16
          if (lightValues.length < offset + 16) {
            console.warn('extra lights are ignored')
            break
          }
          // position
          Vec3.copy(lightValues.subarray(offset + 0, offset + 3), light.matrix[0]().subarray(12, 15))
          // direction
          Vec3.copy(lightValues.subarray(offset + 4, offset + 7), light.matrix[0]().subarray(8, 11))
          Vec3.copy(lightValues.subarray(offset + 8, offset + 11), light.color[0]())

          lightValues[offset + 11] = light.intensity
          lightValues[offset + 12] = light.range ?? Infinity
          lightValues[offset + 13] = light.innerConeAngle
          lightValues[offset + 14] = light.outerConeAngle

          const m: Record<typeof light.lightType, number> = {
            directional: 1,
            point: 2,
            spot: 3
          }

          new DataView(lightValues.buffer).setUint32((offset + 15) * 4, m[light.lightType], true)
        }

        return lightValues
      })
    }
  })

  props.ref?.([store, setStore])

  const [m, setM] = useMaterialContext()
  setM('uniforms', v => v.concat(id))

  const [sceneContext] = useSceneContext()

  // sync uniformBuffer
  createEffect(() => {
    const { device } = sceneContext
    const data = store.value
    const buffer = createBuffer({
      device,
      data: data[0](),
      usage: GPUBufferUsage.UNIFORM,
      label: `uniform buffer ${ref[0].id} ${ref[0].label}`
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
