import { createTokenizer, resolveTokens } from '@solid-primitives/jsx-tokenizer'
import { createEffect, createUniqueId, ParentProps, splitProps } from 'solid-js'
import { Token } from './types'

export const tokenizer = createTokenizer<Token>({ name: 'WebGPU Tokenizer' })

export const useToken = (type: string[], props: { label?: string; ref?: (v: Token) => void } & ParentProps) => {
  const [tokenProps] = splitProps(props, ['children', 'label', 'ref'])

  const children = resolveTokens(tokenizer, () => tokenProps.children)

  const token: Token = {
    type,
    id: createUniqueId(),
    label: '',
    resolveChildren: (p: Token) =>
      children().map(v => {
        return {
          ...v.data,
          children: 'children' in v.data ? v.data.resolveChildren?.(p).map(v => v.id) : undefined,
          parent: v.data.id
        }
      })
  }
  tokenProps.ref?.(token)

  createEffect(() => (token.label = tokenProps.label ?? ''))

  return token
}

// export const useJSXPropToken = <K extends string, T extends Token>(
//   name: K,
//   props: { [k in K]?: JSX.Element },
//   token: { [k in K]?: T },
//   guard: (v: Token) => v is T
// ) => {
//   const resolved = resolveTokens(tokenizer, () => props[name])

//   createEffect(() => {
//     const t = resolved()[0]?.data
//     if (!t) {
//       return
//     }
//     if (guard(t)) {
//       token[name] = t
//     } else {
//       throw new Error(`jsx provided is not suitable with '${name}'`)
//     }
//   })
// }

// export const useJSXPropArrayToken = <K extends string, T extends Token>(
//   name: K,
//   props: { [k in K]?: JSX.Element },
//   token: { [k in K]?: T[] },
//   guard: (v: Token) => v is T
// ) => {
//   const resolved = resolveTokens(tokenizer, () => props[name])

//   createEffect(() => {
//     const t = resolved().map(v => v.data)

//     const r = t.filter(v => {
//       if (guard(v)) {
//         return true
//       } else {
//         throw new Error(`jsx provided is not suitable with '${name}'`)
//       }
//     }) as T[]

//     token[name] = r
//   })
// }
