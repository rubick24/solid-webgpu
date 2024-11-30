import { createEffect, JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import { MeshContextProvider, useSceneContext } from './context'

import { createObject3DContext, Object3DProps, Object3DRef } from './object3d'
import { GeometryContext, MaterialContext, MeshContext, VertexBufferContext } from './types'
// import { PunctualLightToken, Token, tokenizer } from './tokenizer'

export type MeshRef = Object3DRef<MeshContext>
export type MeshProps = Object3DProps<MeshContext> & {
  geometry?: JSX.Element
  material?: JSX.Element
}

export const Mesh = (props: MeshProps) => {
  const { ref, Provider } = createObject3DContext(['Mesh'], props, {})

  const [scene, setScene] = useSceneContext()

  const id = ref[0].id

  const [store, setStore] = createStore(scene.nodes[id] as MeshContext)
  props.ref?.([store, setStore])

  createEffect(() => {
    if (!store.material || !store.geometry) {
      console.warn('no material or geometry found')

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
      label: `mesh-${ref[0].id}-pipeline`,
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

  setScene('renderList', v => v.concat(id))

  return (
    <Provider>
      <MeshContextProvider value={[store, setStore]}>
        {props.geometry}
        {props.material}
        {props.children}
      </MeshContextProvider>
    </Provider>
  )
}
const builtinAttributeNames = ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']
