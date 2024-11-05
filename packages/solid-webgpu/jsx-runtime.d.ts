import type { Object3D } from 'core'

export function createElement(): Object3D

type IntrinsicElementNames = 'intrinsic1' | 'intrinsic2'

export namespace JSX {
  type IntrinsicElements = {
    [elemName in IntrinsicElementNames]: {}
  }

  // interface ElementChildrenAttribute {
  //   props
  //   children: {} // specify children name to use
  // }

  export type Element = Object3D
}
