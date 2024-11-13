import { Mat4, Quat, QuatLike, Vec3, Vec3Like } from 'math'

export type TraverseCallback = (object: Object3D) => boolean | void

export type Object3DProps = {
  position?: Vec3Like
  quaternion?: QuatLike
  scale?: Vec3Like
  label?: string
  children?: Object3D[]
}

export class Object3D {
  label: string = ''
  /**
   * Combined transforms of the object in world space.
   */
  readonly matrix = Mat4.create()
  /**
   * Local quaternion for this object and its descendants. Default is `0, 0, 0, 1`.
   */
  readonly quaternion = Quat.create()
  /**
   * Local position for this object and its descendants. Default is `0, 0, 0`.
   */
  readonly position = Vec3.create()
  /**
   * Local scale for this object and its descendants. Default is `1, 1, 1`.
   */
  readonly scale = Vec3.fromValues(1, 1, 1)
  /**
   * Used to orient the object when using the `lookAt` method. Default is `0, 1, 0`.
   */
  readonly up = Vec3.fromValues(0, 1, 0)
  /**
   * An array of child objects in the scene graph.
   */
  readonly children: Object3D[] = []
  /**
   * The current parent in the scene graph. Default is `null`.
   */
  public parent: Object3D | null = null
  /**
  /**
   * Whether to automatically update transform matrices for this object and its descendants. Default is `true`.
   */
  public matrixAutoUpdate = true
  /**
   * Whether object should be rendered. Default is `true`.
   */
  public visible = true
  /**
   * Whether to cull from rendering when out of view of a camera, if able. Default is `true`.
   */
  public frustumCulled = true

  constructor(options?: Object3DProps) {
    if (options?.label) this.label = options.label
    if (options?.children) this.children.push(...options.children)
    if (options?.position) this.position.copy(options.position)

    if (options?.quaternion) this.quaternion.copy(options.quaternion)
    if (options?.scale) this.scale.copy(options.scale)
  }

  /**
   * Used internally to calculate matrix transforms.
   */
  updateMatrix(): void {
    if (this.matrixAutoUpdate) {
      Mat4.fromRotationTranslationScale(this.matrix, this.quaternion, this.position, this.scale)

      if (this.parent) {
        Mat4.mul(this.matrix, this.parent.matrix, this.matrix)
      }

      for (const child of this.children) child.updateMatrix()
    }
  }

  /**
   * Adds objects as children.
   */
  add(...children: Object3D[]): void {
    for (const child of children) {
      this.children.push(child)
      child.parent = this
    }
  }

  /**
   * Removes objects as children.
   */
  remove(...children: Object3D[]): void {
    for (const child of children) {
      const childIndex = this.children.indexOf(child)
      if (childIndex !== -1) this.children.splice(childIndex, 1)
      child.parent = null
    }
  }

  /**
   * Traverses through children and executes a callback. Return `true` to stop traversing.
   */
  traverse(callback: TraverseCallback): void {
    if (callback(this)) return
    for (const child of this.children) child.traverse(callback)
  }
}

export type Object3DConstructor = typeof Object3D
