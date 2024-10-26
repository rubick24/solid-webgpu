import { Geometry } from './geometry'
import { Material } from './material'
import { Object3D, Object3DConstructor } from './object3d'

export class Mesh extends Object3D {
  /**
   * A {@link Geometry} object describing the mesh's volume.
   */
  public geometry: Geometry
  /**
   * A {@link Material} object describing the mesh's visual behavior.
   */
  public material: Material

  constructor(
    options?: {
      geometry?: Geometry
      material?: Material
      label?: string
    } & ConstructorParameters<Object3DConstructor>[0]
  ) {
    super(options)
    this.geometry = options?.geometry ?? new Geometry()
    this.material = options?.material ?? new Material()
    this.label = options?.label ?? ''
  }
}
