import { Object3D } from 'core'
import { createRenderer } from 'solid-js/universal'

// type VNode = Object3D |

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
  use
} = createRenderer<Object3D>({
  createElement(string) {
    return new Object3D({ label: string })
  },
  createTextNode(value) {
    return new Object3D({ label: value })
  },
  replaceText(textNode, value) {
    textNode.label = value
  },
  setProperty(node, name, value) {
    if (name === 'position') {
      node.position.set(value as number[])
    }
    // console.log('setProperty', node, name, value)
    // if (name === 'style') Object.assign(node.style, value)
    // else if (name.startsWith('on')) node[name.toLowerCase()] = value
    // else if (PROPERTIES.has(name)) node[name] = value
    // else node.setAttribute(name, value)
  },
  insertNode(parent, node, anchor) {
    parent.add(node)
  },
  isTextNode(node) {
    return false
  },
  removeNode(parent, node) {
    parent.remove(node)
  },
  getParentNode(node) {
    return node.parent ?? undefined
  },
  getFirstChild(node) {
    return node.children[0]
  },
  getNextSibling(node) {
    const index = node.parent?.children?.findIndex(v => v === node)
    return node.parent?.children?.[(index ?? 0) + 1]
  }
})

// Forward Solid control flow
export { ErrorBoundary, For, Index, Match, Show, Suspense, SuspenseList, Switch } from 'solid-js'
