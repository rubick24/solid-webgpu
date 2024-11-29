import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'
import { createEffect, createUniqueId, JSX, ParentProps, splitProps } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { NodeContextProvider, Object3DContextProvider, useObject3DContext, useSceneContext } from './context'
import { NodeContext, Object3DContext, StoreContext } from './types'

export type NodeExtra = { node: NodeContext }
export type CommonNodeRef<T = {}> = T & { node: StoreContext<NodeContext> }
export type CommonNodeProps<T = {}> = {
  label?: string
  ref?: (v: CommonNodeRef<T>) => void
  children?: JSX.Element
}

export type Object3DExtra = NodeExtra & { object3d: Object3DContext }
export type Object3DRef<T = {}> = CommonNodeRef<T & { object3d: StoreContext<Object3DContext> }>
export type Object3DProps<T = {}> = CommonNodeProps<Object3DRef<T>> &
  ParentProps & {
    position?: Vec3Like
    quaternion?: QuatLike
    scale?: Vec3Like
  }

export const createNodeContext = <T,>(type: string[], props: CommonNodeProps<T>) => {
  const [cProps] = splitProps(props, ['label'])
  const nodeContext: NodeContext = {
    id: createUniqueId(),
    label: '',
    type
  }

  const [scene, setScene] = useSceneContext()
  setScene('nodes', nodeContext.id, { node: nodeContext })
  const [store, setStore] = createStore(scene.nodes[nodeContext.id].node)
  createEffect(() => setStore('label', cProps.label ?? ''))

  return {
    ref: { node: [store, setStore] satisfies StoreContext<NodeContext> },
    Provider: (p: ParentProps) => {
      return <NodeContextProvider value={[store, setStore]}>{p.children}</NodeContextProvider>
    }
  }
}

export const createObject3DContext = <T,>(type: string[], props: Object3DProps<T>) => {
  const { ref, Provider } = createNodeContext(['Object3D'].concat(type), props)

  const [o3dProps] = splitProps(props, ['position', 'quaternion', 'scale'])
  const object3DContext: Object3DContext = {
    matrix: Mat4.create(),
    position: Vec3.create(),
    quaternion: Quat.create(),
    scale: Vec3.fromValues(1, 1, 1),
    up: Vec3.fromValues(0, 1, 0)
  }

  const id = ref.node[0].id
  const [scene, setScene] = useSceneContext()
  setScene(
    'nodes',
    id,
    produce(v => {
      v.object3d = object3DContext
    })
  )

  const [store, setStore] = createStore((scene.nodes[id] as Object3DExtra).object3d)

  createEffect(() => {
    setStore('position', Vec3.clone(o3dProps.position ?? [0, 0, 0]))
  })

  createEffect(() => {
    setStore('quaternion', Quat.clone(o3dProps.quaternion ?? [0, 0, 0, 1]))
  })

  createEffect(() => {
    setStore('scale', Vec3.clone(o3dProps.scale ?? [1, 1, 1]))
  })

  // update matrix
  const parent = useObject3DContext()
  createEffect(() => {
    const { quaternion, position, scale } = store
    const m = Mat4.create()
    Mat4.fromRotationTranslationScale(m, quaternion, position, scale)
    if (parent && parent[0]) {
      const pm = parent[0].matrix
      Mat4.mul(m, pm, m)
    }
    setStore('matrix', m)
  })

  return {
    ref: { ...ref, object3d: [store, setStore] satisfies StoreContext<Object3DContext> },
    Provider: (p: ParentProps) => {
      return (
        <Provider>
          <Object3DContextProvider value={[store, setStore]}>{p.children}</Object3DContextProvider>
        </Provider>
      )
    }
  }
}

export const Object3D = (props: Object3DProps) => {
  const { ref, Provider } = createObject3DContext(['Object3D'], props)

  props.ref?.(ref)
  return <Provider>{props.children}</Provider>
}
