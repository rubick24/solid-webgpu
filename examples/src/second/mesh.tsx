import { createEffect, JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import { MeshContextProvider, useSceneContext } from './context'
import { createObject3DContext, Object3DProps, Object3DRef } from './object3d'
import { MeshContext, StoreContext } from './types'
// import { PunctualLightToken, Token, tokenizer } from './tokenizer'

type MeshRefExtra = {
  mesh: StoreContext<MeshContext>
}
export type MeshRef = Object3DRef<MeshRefExtra>
export type MeshProps = Object3DProps<MeshRefExtra> & {
  geometry?: JSX.Element
  material?: JSX.Element
}

export const Mesh = (props: MeshProps) => {
  const { ref: _ref, Provider } = createObject3DContext(['Mesh'], props)

  const [store, setStore] = createStore<MeshContext>({})
  const ref = { ..._ref, mesh: [store, setStore] satisfies StoreContext<MeshContext> }
  props.ref?.(ref)

  const [scene, setScene] = useSceneContext()

  createEffect(() => {
    const material = store.material?.material[0]
    const geometry = store.geometry?.geometry[0]
    const { device, format, samples } = scene
    if (!material || !geometry) {
      console.warn('no material or geometry found')
      return
    }
    let code = material.shaderCode

    /**
     * set builtin vertexInput if defined in vertexBuffer
     */
    const vertexInputStr = geometry!.vertexBuffers
      .map(v => v.vertexBuffer[0])
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
      label: `mesh-${ref.node[0].id}-pipeline`,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: geometry.vertexBuffers.map(v => v.vertexBuffer[0].layout)
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format
          }
        ]
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

  setScene('renderMap', ref.node[0].id, ref)

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
