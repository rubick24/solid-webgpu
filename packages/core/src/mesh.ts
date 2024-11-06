import { Geometry } from './geometry'
import { Material } from './material'
import { Object3D, Object3DProps } from './object3d'

export type MeshProps = Object3DProps & {
  geometry?: Geometry
  material?: Material
}

export class Mesh extends Object3D {
  /**
   * A {@link Geometry} object describing the mesh's volume.
   */
  public geometry: Geometry
  /**
   * A {@link Material} object describing the mesh's visual behavior.
   */
  public material: Material

  constructor(options?: MeshProps) {
    super(options)
    this.geometry = options?.geometry ?? new Geometry()
    this.material = options?.material ?? new Material()
    this.label = options?.label ?? ''
  }
}

export type MeshConstructor = typeof Mesh
