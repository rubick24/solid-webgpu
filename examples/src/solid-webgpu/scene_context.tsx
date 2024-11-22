import { createContext, useContext } from 'solid-js'
import type { Token } from './tokenizer'

export type SceneContextT = {
  nodes: Record<string, Token>
}
export const SceneContext = createContext<SceneContextT>()

export const useSceneContext = () => useContext(SceneContext)!
