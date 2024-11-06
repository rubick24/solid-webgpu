import { Object3D } from 'core'
import { createRenderer } from 'solid-js/universal'
export * from './type'

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
    if (textNode instanceof Object3D) {
      textNode.label = value
    }
  },
  setProperty(node, name, value) {
    console.log('setProperty', node, name, value)
    if (name === 'position' && node instanceof Object3D) {
      node.position.set(value as number[])
    }
    // if (name === 'style') Object.assign(node.style, value)
    // else if (name.startsWith('on')) node[name.toLowerCase()] = value
    // else if (PROPERTIES.has(name)) node[name] = value
    // else node.setAttribute(name, value)
  },
  insertNode(parent, node, anchor) {
    if (parent instanceof Object3D && node instanceof Object3D) {
      parent.add(node)
    }
  },
  isTextNode(node) {
    return false
  },
  removeNode(parent, node) {
    if (parent instanceof Object3D && node instanceof Object3D) {
      parent.remove(node)
    }
  },
  getParentNode(node) {
    if (node instanceof Object3D) {
      return node.parent ?? undefined
    }
  },
  getFirstChild(node) {
    if (node instanceof Object3D) {
      return node.children[0]
    }
  },
  getNextSibling(node) {
    if (node instanceof Object3D) {
      const index = node.parent?.children?.findIndex(v => v === node)
      return node.parent?.children?.[(index ?? 0) + 1]
    }
  }
})

// Forward Solid control flow
export { ErrorBoundary, For, Index, Match, Show, Suspense, SuspenseList, Switch } from 'solid-js'
