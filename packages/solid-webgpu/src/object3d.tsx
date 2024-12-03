import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'
import { createEffect, createSignal, createUniqueId, ParentProps, splitProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { NodeContextProvider, Object3DContextProvider, useObject3DContext, useSceneContext } from './context'
import { NodeContext, NodeProps, NodeRef, Object3DContext, StoreContext } from './types'

export type Object3DRef<T = {}> = NodeRef<T>
export type Object3DProps<T = {}> = NodeProps<T> &
  ParentProps & {
    position?: Vec3Like
    quaternion?: QuatLike
    scale?: Vec3Like
  }

export const createNodeContext = <T,>(
  type: string[],
  props: Omit<NodeProps, 'ref'>,
  init: Omit<T, keyof NodeContext>
) => {
  const [cProps] = splitProps(props, ['label'])
  const nodeContext = {
    id: createUniqueId(),
    label: '',
    type,
    ...init
  }

  const [scene, setScene] = useSceneContext()
  setScene('nodes', nodeContext.id, nodeContext)
  const [store, setStore] = createStore(scene.nodes[nodeContext.id])
  createEffect(() => setStore('label', cProps.label ?? ''))

  return {
    ref: [store, setStore] satisfies StoreContext<NodeContext>,
    Provider: (p: ParentProps) => {
      return <NodeContextProvider value={[store, setStore]}>{p.children}</NodeContextProvider>
    }
  }
}

export const createObject3DContext = <T,>(
  type: string[],
  props: Omit<Object3DProps, 'ref'>,
  init: Omit<T, keyof Object3DContext>
) => {
  const { ref, Provider } = createNodeContext(['Object3D'].concat(type), props, {
    ...init,
    matrix: createSignal(Mat4.create(), { equals: false }),
    position: createSignal(Vec3.create(), { equals: false }),
    quaternion: createSignal(Quat.create(), { equals: false }),
    scale: createSignal(Vec3.fromValues(1, 1, 1), { equals: false }),
    up: createSignal(Vec3.fromValues(0, 1, 0), { equals: false })
  })

  const [o3dProps] = splitProps(props, ['position', 'quaternion', 'scale'])

  const id = ref[0].id
  const [scene] = useSceneContext()
  const [store, setStore] = createStore(scene.nodes[id] as Object3DContext)

  createEffect(() => {
    store.position[1](v => {
      v.copy(o3dProps.position ?? [0, 0, 0])
      return v
    })
  })

  createEffect(() => {
    store.quaternion[1](v => {
      v.copy(o3dProps.quaternion ?? [0, 0, 0, 1])
      return v
    })
  })

  createEffect(() => {
    store.scale[1](v => {
      v.copy(o3dProps.scale ?? [1, 1, 1])
      return v
    })
  })

  // update matrix
  const parent = useObject3DContext()
  createEffect(() => {
    const { quaternion, position, scale } = store
    store.matrix[1](m => {
      Mat4.fromRotationTranslationScale(m, quaternion[0](), position[0](), scale[0]())
      if (parent && parent[0]) {
        const pm = parent[0].matrix[0]()
        Mat4.mul(m, pm, m)
      }
      return m
    })
  })

  return {
    ref: [store, setStore] satisfies StoreContext<Object3DContext>,
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
  const { ref, Provider } = createObject3DContext(['Object3D'], props, {})

  props.ref?.(ref)
  return <Provider>{props.children}</Provider>
}
