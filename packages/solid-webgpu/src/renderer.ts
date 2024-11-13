import { Camera, Geometry, Material, Mesh, Object3D, PunctualLight } from 'core'

import { createRenderer } from 'solid-js/universal'

import { JSX } from './jsx-ext'

const isObject3D = (v: unknown): v is Object3D => {
  return v instanceof Object3D
}

const object3dKeys = ['position', 'quaternion', 'scale'] as const

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
} = createRenderer<JSX.Element>({
  createElement(string) {
    switch (string) {
      case 'object3d':
        return new Object3D()
      case 'mesh':
        return new Mesh()
      case 'camera':
        return new Camera()
      case 'punctual_light':
        return new PunctualLight()

      // non-object3d:
      case 'material':
        return new Material()
      case 'geometry':
        return new Geometry()

      default:
        throw new Error(`[solid-webgpu] ${string} is not a built-in element`)
    }
  },
  createTextNode(value) {
    throw new Error(`[solid-webgpu] text node is not allowed: ${value}`)
  },
  replaceText(textNode, value) {
    throw new Error(`[solid-webgpu] text node is not allowed: ${value}`)
  },
  setProperty(node, name, value) {
    if (node instanceof Mesh) {
      if (name === 'geometry' && value instanceof Geometry) {
        return (node.geometry = value)
      } else if (name === 'material' && value instanceof Material) {
        return (node.material = value)
      }
    } else if (node instanceof PunctualLight) {
      const lightPropKeys = ['intensity', 'type', 'range', 'innerConeAngle', 'outerConeAngle']
      if (name === 'color') {
        return node.color.copy(value as any)
      } else if (lightPropKeys.includes(name)) {
        return ((node as any)[name] = value)
      }
    } else if (node instanceof Geometry) {
      return ((node as any)[name] = value)
    } else if (node instanceof Material) {
      return ((node as any)[name] = value)
    }
    // common object3d props
    if (isObject3D(node)) {
      type Object3DPropsKey = (typeof object3dKeys)[number]
      if (object3dKeys.includes(name as Object3DPropsKey)) {
        return node[name as Object3DPropsKey].copy(value as any)
      }
    }
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
