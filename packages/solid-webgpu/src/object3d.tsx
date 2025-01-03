import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'
import {
  children,
  ChildrenReturn,
  createEffect,
  createSignal,
  createUniqueId,
  For,
  JSX,
  onCleanup,
  splitProps
} from 'solid-js'
import { createStore, produce, SetStoreFunction } from 'solid-js/store'
import {
  $OBJECT3D,
  $WGPU_COMPONENT,
  isObject3DComponent,
  isWgpuComponent,
  NodeProps,
  NodeRef,
  Object3DComponent,
  Object3DExtra,
  Object3DRef,
  SceneContext,
  StoreContext,
  WgpuComponent
} from './types'

export type Object3DProps<T = {}> = NodeProps<T> & {
  position?: Vec3Like
  quaternion?: QuatLike
  scale?: Vec3Like
}

export const createNodeRef = <T extends NodeRef>(
  props: Omit<NodeProps, 'ref'>,
  ch: ChildrenReturn,
  init?: Omit<T, keyof NodeRef>
) => {
  const [cProps] = splitProps(props, ['label'])

  const [sceneCtx, setSceneCtx] = createSignal<StoreContext<SceneContext>>()

  const NodeRef: NodeRef = {
    [$WGPU_COMPONENT]: true as const,
    id: createUniqueId(),
    label: '',
    scene: sceneCtx,
    ...init
  }

  const [store, setStore] = createStore<NodeRef>(NodeRef)
  createEffect(() => setStore('label', cProps.label ?? ''))

  // register node to scene
  createEffect(() => {
    const setScene = sceneCtx()?.[1]
    setScene?.('nodes', store.id, store)
    onCleanup(() => {
      setScene?.(
        'nodes',
        produce(v => {
          delete v[store.id]
        })
      )
    })
  })

  return {
    store: store as T,
    setStore: setStore as SetStoreFunction<T>,
    comp: {
      [$WGPU_COMPONENT]: true as const,
      id: store.id,
      setSceneCtx,
      render: () => {
        ch.toArray().forEach(child => {
          if (isWgpuComponent(child)) {
            child.setSceneCtx(sceneCtx())
          }
        })
        return null
      }
    } satisfies WgpuComponent
  }
}
export const wgpuCompRender = (ch: ChildrenReturn) => (
  <For each={ch.toArray()}>
    {child => {
      if (isWgpuComponent(child)) {
        return child.render()
      }
      return child
    }}
  </For>
)

export const createObject3DRef = <T extends Object3DRef>(
  props: Omit<Object3DProps, 'ref'>,
  ch: ChildrenReturn,
  init?: Omit<T, keyof Object3DRef>
) => {
  const m = createSignal(Mat4.create(), { equals: false })
  const p = createSignal(Vec3.create(), { equals: false })
  const q = createSignal(Quat.create(), { equals: false })
  const s = createSignal(Vec3.fromValues(1, 1, 1), { equals: false })
  const u = createSignal(Vec3.fromValues(0, 1, 0), { equals: false })
  const o3dExt: Object3DExtra = {
    [$OBJECT3D]: true,
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

  const { store, setStore, comp } = createNodeRef<Object3DRef>(props, ch, { ...init, ...o3dExt })

  const [o3dProps] = splitProps(props, ['position', 'quaternion', 'scale'])

  const id = store.id

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

  const [parentCtx, setParentCtx] = createSignal<StoreContext<Object3DRef>>()

  // update matrix
  createEffect(() => {
    const { quaternion, position, scale } = store
    store.setMatrix(m => {
      Mat4.fromRotationTranslationScale(m, quaternion(), position(), scale())

      const pm = parentCtx()?.[0].matrix
      if (pm) {
        Mat4.mul(m, pm(), m)
      }

      return m
    })
  })

  return {
    store: store as T,
    setStore: setStore as SetStoreFunction<T>,
    comp: {
      ...comp,
      [$OBJECT3D]: true as const,
      setParentCtx,
      render: () => {
        comp.render()
        ch.toArray().forEach(child => {
          if (isObject3DComponent(child)) {
            child.setParentCtx([store, setStore])
          }
        })
        return null
      }
    } satisfies Object3DComponent
  }
}

export const Object3D = (props: Object3DProps) => {
  const ch = children(() => props.children)
  const { store, comp } = createObject3DRef(props, ch)

  props.ref?.(store)

  return {
    ...comp,
    render: () => {
      comp.render()
      return wgpuCompRender(ch)
    }
  } satisfies Object3DComponent as unknown as JSX.Element
}
