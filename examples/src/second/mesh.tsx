import { JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import { MeshContextProvider } from './context'
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
  const { ref, Provider } = createObject3DContext(['Mesh'], props)

  const [store, setStore] = createStore<MeshContext>({})
  props.ref?.({ ...ref, mesh: [store, setStore] })

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
