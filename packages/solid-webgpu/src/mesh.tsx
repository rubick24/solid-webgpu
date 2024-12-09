import { children, createEffect, JSX, onCleanup } from 'solid-js'
import { createStore } from 'solid-js/store'

import { createObject3DContext, Object3DProps, Object3DRef, wgpuCompRender } from './object3d'
import {
  GeometryContext,
  isGeometryComponent,
  isMaterialComponent,
  MaterialContext,
  MeshContext,
  Object3DComponent,
  VertexBufferContext
} from './types'

export type MeshRef = Object3DRef<MeshContext>
export type MeshProps = Object3DProps<MeshContext>

export const Mesh = (props: MeshProps) => {
  const ch = children(() => props.children)
  const { store: _s, comp } = createObject3DContext(props, ch)
  const id = _s.id
  const [store, setStore] = createStore(_s as MeshContext)
  props.ref?.(store)

  createEffect(() => {
    if (!store.material || !store.geometry) {
      console.warn('no material or geometry found')
      return
    }
    const scene = store.scene()?.[0]
    if (!scene) {
      return
    }
    const material = scene.nodes[store.material] as MaterialContext
    const geometry = scene.nodes[store.geometry] as GeometryContext
    const { device, format, samples } = scene

    let code = material.shaderCode

    /**
     * set builtin vertexInput if defined in vertexBuffer
     */
    const vertexInputStr = geometry.vertexBuffers
      .map(v => {
        return scene.nodes[v] as VertexBufferContext
      })
      .filter(v => v.attribute?.name && builtinAttributeNames.includes(v.attribute?.name))
      .map((v, i) => `  @location(${i}) ${v.attribute!.name}: ${v.attribute!.type}`)
      .join(',\n')
    if (vertexInputStr) {
      const old = code.match(/^struct VertexInput {\n(.|\n)*?}/)?.[0]
      const rep = `struct VertexInput {\n${vertexInputStr}\n}`
      code = old?.length ? code.replace(old, rep) : rep + '\n' + code
    }
    const shaderModule = device.createShaderModule({ code })

    const bindGroupLayout = material.bindGroupLayout
    if (!bindGroupLayout) {
      return
    }
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      label: `mesh-${_s.id}-pipeline`,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: geometry.vertexBuffers.map(v => (scene.nodes[v] as VertexBufferContext).layout)
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: {
        frontFace: 'ccw',
        cullMode: material.cullMode,
        topology: geometry.topology
      },
      depthStencil: {
        depthWriteEnabled: material.depthWrite,
        depthCompare: (material.depthTest ? 'less' : 'always') as GPUCompareFunction,
        format: 'depth24plus-stencil8'
      },
      multisample: { count: samples }
    })

    setStore('pipeline', pipeline)
  })

  createEffect(() => {
    const setScene = store.scene()?.[1]
    setScene?.('renderList', v => v.concat(id))

    onCleanup(() => {
      setScene?.('renderList', v => v.filter(x => id !== x))
    })
  })

  return {
    ...comp,
    render: () => {
      comp.render()
      ch.toArray().forEach(child => {
        if (isGeometryComponent(child) || isMaterialComponent(child)) {
          child.setMeshCtx([store, setStore])
        }
      })
      return wgpuCompRender(ch)
    }
  } satisfies Object3DComponent as unknown as JSX.Element
}
const builtinAttributeNames = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']
