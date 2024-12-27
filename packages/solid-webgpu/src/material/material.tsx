import { Mat3, Mat4, Vec3 } from 'math'
import { children, createEffect, createSignal, JSX, onCleanup, untrack } from 'solid-js'

import { createNodeContext, wgpuCompRender } from '../object3d'
import {
  $MATERIAL,
  $SAMPLER,
  $TEXTURE,
  $UNIFORM_BUFFER,
  CameraContext,
  isSamplerComponent,
  isTextureComponent,
  isUniformBufferComponent,
  MaterialComponent,
  MaterialContext,
  MaterialExtra,
  MeshContext,
  NodeProps,
  NodeRef,
  Optional,
  PunctualLightContext,
  SamplerComponent,
  SamplerContext,
  SamplerExtra,
  StoreContext,
  TextureComponent,
  TextureContext,
  TextureExtra,
  TypedArray,
  UniformBufferComponent,
  UniformBufferContext,
  UniformBufferExtra
} from '../types'
import { createBuffer, imageBitmapFromImageUrl, white1pxBase64 } from '../utils'

export type MaterialRef = NodeRef<MaterialContext>
export type MaterialProps = NodeProps<MaterialContext> & {
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
  const ch = children(() => props.children)
  const ext: MaterialExtra = {
    [$MATERIAL]: true,
    uniforms: [],
    shaderCode: '',
    cullMode: 'back',
    transparent: false,
    depthTest: true,
    depthWrite: true
  }
  const { store, setStore, comp } = createNodeContext<MaterialContext>(props, ch, ext)

  props.ref?.(store)

  const [meshCtx, setMeshCtx] = createSignal<StoreContext<MeshContext>>()
  createEffect(() => {
    setStore('mesh', meshCtx()?.[0].id)
    meshCtx()?.[1]('material', store.id)

    onCleanup(() => {
      setStore('mesh', undefined)
      meshCtx()?.[1]('material', undefined)
    })
  })

  createEffect(() => setStore('shaderCode', props.shaderCode))
  createEffect(() => setStore('cullMode', props.cullMode ?? 'back'))
  createEffect(() => setStore('transparent', props.transparent ?? false))
  createEffect(() => setStore('depthTest', props.depthTest ?? true))
  createEffect(() => setStore('depthWrite', props.depthWrite ?? true))

  createEffect(() => {
    const scene = store.scene()?.[0]
    if (!scene) return
    const { device } = scene
    const layoutEntries = store.uniforms.map((_u, i): GPUBindGroupLayoutEntry => {
      const u = scene.nodes[_u]

      if ($TEXTURE in u) {
        return {
          binding: i,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        }
      } else if ($SAMPLER in u) {
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
    const scene = store.scene()?.[0]
    if (!scene) return
    const bindGroupEntries = store.uniforms.map((_u, i): GPUBindGroupEntry | undefined => {
      const u = scene.nodes[_u]
      if ($TEXTURE in u) {
        const t = (u as unknown as TextureContext).texture
        if (!t) {
          return
        }
        return {
          binding: i,
          resource: t && 'createView' in t ? t.createView() : t
        }
      } else if ($SAMPLER in u) {
        const s = (u as unknown as SamplerContext).sampler
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
    const device = store.scene()?.[0].device
    if (!device) {
      return
    }
    const { bindGroupLayout, bindGroupEntries } = store
    if (bindGroupLayout && bindGroupEntries?.length) {
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: bindGroupEntries
      })
      setStore('bindGroup', bindGroup)
    }
  })

  return {
    ...comp,
    [$MATERIAL]: true as const,
    setMeshCtx,
    render: () => {
      comp.render()
      ch.toArray().forEach(child => {
        if (isTextureComponent(child) || isSamplerComponent(child) || isUniformBufferComponent(child)) {
          child.setMaterialCtx([store, setStore])
        }
      })
      return wgpuCompRender(ch)
    }
  } satisfies MaterialComponent as unknown as JSX.Element
}

export type TextureRef = NodeRef<TextureContext>
export type TextureProps = NodeProps<TextureContext> & {
  descriptor: Optional<GPUTextureDescriptor, 'usage' | 'format'>
  image?: ImageBitmap | ImageData | HTMLCanvasElement | OffscreenCanvas
}
export const Texture = (props: TextureProps) => {
  const ch = children(() => props.children)

  const ext: TextureExtra = {
    [$TEXTURE]: true,
    descriptor: untrack(() => props.descriptor)
  }
  const { store, setStore, comp } = createNodeContext<TextureContext>(props, ch, ext)

  createEffect(() => setStore('descriptor', props.descriptor))
  createEffect(() => setStore('image', props.image))

  props.ref?.(store)

  const [materialCtx, setMaterialCtx] = createSignal<StoreContext<MaterialContext>>()
  createEffect(() => {
    materialCtx()?.[1]('uniforms', v => v.concat(store.id))
    onCleanup(() => {
      materialCtx()?.[1]('uniforms', v => v.filter(x => x !== store.id))
    })
  })

  // sync texture
  createEffect(() => {
    const scene = store.scene()?.[0]
    if (!scene) {
      return
    }
    const { device, format } = scene

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

  return {
    ...comp,
    [$TEXTURE]: true,
    setMaterialCtx,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies TextureComponent as unknown as JSX.Element
}

export type SamplerRef = NodeRef<SamplerContext>
export type SamplerProps = NodeProps<SamplerContext> & {
  descriptor: GPUSamplerDescriptor
}
export const Sampler = (props: SamplerProps) => {
  const ch = children(() => props.children)
  const ext: SamplerExtra = {
    [$SAMPLER]: true,
    descriptor: untrack(() => props.descriptor)
  }
  const { store, setStore, comp } = createNodeContext<SamplerContext>(props, ch, ext)

  createEffect(() => setStore('descriptor', props.descriptor))

  props.ref?.(store)

  const [materialCtx, setMaterialCtx] = createSignal<StoreContext<MaterialContext>>()
  createEffect(() => {
    materialCtx()?.[1]('uniforms', v => v.concat(store.id))
    onCleanup(() => {
      materialCtx()?.[1]('uniforms', v => v.filter(x => x !== store.id))
    })
  })

  // sync sampler
  createEffect(() => {
    const scene = store.scene()?.[0]
    if (!scene) {
      return
    }
    const sampler = scene.device.createSampler(store.descriptor)
    setStore('sampler', sampler)
  })

  return {
    ...comp,
    [$SAMPLER]: true,
    setMaterialCtx,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies SamplerComponent as unknown as JSX.Element
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
  const ch = children(() => props.children)

  const initial = untrack(() => {
    if ('value' in props) {
      const val = createSignal(props.value, { equals: false })
      return {
        [$UNIFORM_BUFFER]: true,
        value: val[0],
        setValue: val[1]
      }
    } else {
      const val = createSignal<TypedArray | ArrayBuffer>(new Float32Array(builtInBufferLength[props.buildInType]), {
        equals: false
      })
      return {
        [$UNIFORM_BUFFER]: true,
        builtIn: props.buildInType,
        value: val[0],
        setValue: val[1]
      }
    }
  }) satisfies UniformBufferExtra

  const { store, setStore, comp } = createNodeContext<UniformBufferContext>(props, ch, initial)

  createEffect(() => {
    if ('buildInType' in props) {
      setStore('builtIn', props.buildInType)
    } else {
      store.setValue(props.value)
    }
  })

  /**
   * update built-in uniform buffer
   */
  createEffect(() => {
    const scene = store.scene()?.[0]
    if (!scene) {
      return
    }
    const o3d = scene.nodes[materialCtx()?.[0].mesh ?? ''] as MeshContext
    if (store.builtIn === 'base' && o3d) {
      store.setValue(v => {
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

        const modelMatrix = Mat4.copy(bo.subarray(0, 16), o3d.matrix())
        const viewMatrix = Mat4.copy(bo.subarray(16, 32), camera.viewMatrix())
        // projectionMatrix
        Mat4.copy(bo.subarray(32, 48), camera.projectionMatrix())
        const modelViewMatrix = Mat4.copy(bo.subarray(48, 64), viewMatrix)
        Mat4.mul(modelViewMatrix, modelViewMatrix, modelMatrix)
        // normalMatrix
        Mat3.normalFromMat4(bo.subarray(64, 73), modelViewMatrix)
        // cameraPosition
        Vec3.copy(bo.subarray(76, 79), camera.matrix().subarray(12, 15))

        return bo
      })
    } else if (store.builtIn === 'punctual_lights') {
      store.setValue(v => {
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
          Vec3.copy(lightValues.subarray(offset + 0, offset + 3), light.matrix().subarray(12, 15))
          // direction
          Vec3.copy(lightValues.subarray(offset + 4, offset + 7), light.matrix().subarray(8, 11))
          Vec3.copy(lightValues.subarray(offset + 8, offset + 11), light.color())

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

  props.ref?.(store)

  const [materialCtx, setMaterialCtx] = createSignal<StoreContext<MaterialContext>>()
  createEffect(() => {
    materialCtx()?.[1]('uniforms', v => v.concat(store.id))
    onCleanup(() => {
      materialCtx()?.[1]('uniforms', v => v.filter(x => x !== store.id))
    })
  })

  // sync uniformBuffer
  createEffect(() => {
    const scene = store.scene()?.[0]
    if (!scene) {
      return
    }
    const { device } = scene
    let buffer = untrack(() => store.buffer)
    const value = store.value()
    if (!buffer || buffer.size !== value.byteLength) {
      // create new buffer
      buffer?.destroy()
      buffer = createBuffer({
        device,
        data: value,
        usage: GPUBufferUsage.UNIFORM,
        label: `uniform buffer ${store.id} ${store.label}`
      })
      setStore('buffer', buffer)
    } else {
      // write to existing buffer
      device.queue.writeBuffer(buffer, 0, value)
    }
  })

  return {
    ...comp,
    [$UNIFORM_BUFFER]: true,
    setMaterialCtx,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies UniformBufferComponent as unknown as JSX.Element
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
