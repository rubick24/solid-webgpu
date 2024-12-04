import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'
import { createEffect, createSignal, createUniqueId, ParentProps, splitProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { NodeContextProvider, Object3DContextProvider, useObject3DContext, useSceneContext } from './context'
import { NodeContext, NodeProps, NodeRef, Object3DContext, Object3DExtra } from './types'

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
    store,
    setStore,
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
  const m = createSignal(Mat4.create(), { equals: false })
  const p = createSignal(Vec3.create(), { equals: false })
  const q = createSignal(Quat.create(), { equals: false })
  const s = createSignal(Vec3.fromValues(1, 1, 1), { equals: false })
  const u = createSignal(Vec3.fromValues(0, 1, 0), { equals: false })
  const o3dExt: Object3DExtra = {
    matrix: m[0],
    setMatrix: m[1],
    position: p[0],
    setPosition: p[1],
    quaternion: q[0],
    setQuaternion: q[1],
    scale: s[0],
    setScale: s[1],
    up: u[0],
    setUp: u[1]
  }
  const {
    store: _s,
    setStore: _setS,
    Provider
  } = createNodeContext(['Object3D'].concat(type), props, {
    ...init,
    ...o3dExt
  })

  const [o3dProps] = splitProps(props, ['position', 'quaternion', 'scale'])

  const id = _s.id
  const [scene] = useSceneContext()
  const [store, setStore] = createStore(scene.nodes[id] as Object3DContext)

  createEffect(() => {
    store.setPosition(v => {
      v.copy(o3dProps.position ?? [0, 0, 0])
      return v
    })
  })

  createEffect(() => {
    store.setQuaternion(v => {
      v.copy(o3dProps.quaternion ?? [0, 0, 0, 1])
      return v
    })
  })

  createEffect(() => {
    store.setScale(v => {
      v.copy(o3dProps.scale ?? [1, 1, 1])
      return v
    })
  })

  // update matrix
  const parentCtx = useObject3DContext()
  createEffect(() => {
    const { quaternion, position, scale } = store
    store.setMatrix(m => {
      Mat4.fromRotationTranslationScale(m, quaternion(), position(), scale())
      if (parentCtx && parentCtx[0]) {
        const pm = parentCtx[0].matrix()
        Mat4.mul(m, pm, m)
      }
      return m
    })
  })

  return {
    store,
    setStore,
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
  const { store, Provider } = createObject3DContext(['Object3D'], props, {})

  props.ref?.(store)
  return <Provider>{props.children}</Provider>
}
