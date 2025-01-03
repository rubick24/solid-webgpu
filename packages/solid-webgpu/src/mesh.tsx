import { children, createEffect, createMemo, JSX, onCleanup } from 'solid-js'
import { createStore } from 'solid-js/store'
import { GeometryOptions } from './geometry'
import { createRenderPipeline } from './hks'
import { defaultMaterial, MaterialOptions } from './material'
import { createObject3DRef, Object3DProps, wgpuCompRender } from './object3d'
import { MeshRef, Object3DComponent } from './types'
import { access } from './utils'

export type MeshProps = Object3DProps<MeshRef> & {
  material?: MaterialOptions
  geometry: GeometryOptions
}

export const Mesh = (props: MeshProps) => {
  const ch = children(() => props.children)
  const { store: _s, comp } = createObject3DRef(props, ch)
  const id = _s.id
  const [store, setStore] = createStore(_s as MeshRef)
  props.ref?.(store)

  createEffect(() => {
    const setScene = store.scene()?.[1]
    setScene?.('renderList', v => v.concat(id))

    onCleanup(() => {
      setScene?.('renderList', v => v.filter(x => id !== x))
    })
  })

  const material = () => props.material ?? defaultMaterial

  createEffect(() => {
    if (material().update) {
      material().update?.(store)
    }
  })

  const pipelineOps = createMemo(() => ({
    shaderCode: material().shaderCode,
    bindGroupLayout: material().bindGroupLayout,
    vertexBuffers: props.geometry.vertexBuffers,
    format: material().format,
    vertexEntryPoint: material().vertexEntryPoint,
    fragmentEntryPoint: material().fragmentEntryPoint,
    primitive: props.geometry.primitive,
    depthStencil: props.geometry.depthStencil
  }))
  const pipeline = createRenderPipeline(pipelineOps())

  const _instanceCount = () => props.geometry.instanceCount ?? 1
  const _drawRange = () => props.geometry.drawRange ?? { start: 0, count: Infinity }

  const draw = (passEncoder: GPURenderPassEncoder) => {
    const _pipeline = pipeline()
    if (!_pipeline) {
      return
    }
    passEncoder.setPipeline(_pipeline)

    const indexBuffer = props.geometry.indexBuffer
    const vertexBuffers = props.geometry.vertexBuffers

    const bindGroup = material().bindGroup
    const instanceCount = _instanceCount()
    const drawRange = _drawRange()

    if (indexBuffer) {
      passEncoder.setIndexBuffer(indexBuffer.buffer, `uint${indexBuffer.BYTES_PER_ELEMENT * 8}` as GPUIndexFormat)
    }
    vertexBuffers.forEach((v, i) => {
      const buffer = access(v.buffer)
      if (!buffer) {
        return
      }
      passEncoder.setVertexBuffer(i, buffer)
    })

    const _bindGroup = access(bindGroup)
    if (_bindGroup) {
      passEncoder.setBindGroup(0, _bindGroup)
    }

    const positionAttr = vertexBuffers[0]

    // Alternate drawing for indexed and non-indexed children
    if (indexBuffer) {
      const count = Math.min(drawRange.count, indexBuffer.buffer.size / indexBuffer.BYTES_PER_ELEMENT)
      passEncoder.drawIndexed(count, instanceCount, drawRange.start ?? 0)
    } else if (positionAttr) {
      const count = Math.min(
        drawRange.count,
        access(positionAttr.buffer).size / access(positionAttr.layout).arrayStride
      )
      passEncoder.draw(count, instanceCount, drawRange.start ?? 0)
    } else {
      passEncoder.draw(3, instanceCount)
    }
  }

  setStore('draw', () => draw)

  return {
    ...comp,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies Object3DComponent as unknown as JSX.Element
}
