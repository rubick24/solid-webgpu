import { Geometry } from './geometry'
import { Material } from './material'
import { Mat4 } from './math'
import { Object3D } from './object3d'

export type Mode = 'triangles' | 'points' | 'lines'

export class Mesh extends Object3D {
  /**
   * World space transforms relative to the active camera.
   */
  readonly modelViewMatrix = Mat4.create()
  /**
   * Normalized directional transforms. Useful for physics or lighting.
   */
  readonly normalMatrix = Mat4.create()
  /**
   * Which {@link Mode} to render with. Default is `triangles`.
   */
  public mode: Mode = 'triangles'
  /**
   * The number of instances to render of this mesh. Default is `1`.
   */
  public instances = 1

  constructor(
    /**
     * A {@link Geometry} object describing the mesh's volume.
     */
    public geometry: Geometry = new Geometry(),
    /**
     * A {@link Material} object describing the mesh's visual behavior.
     */
    public material: Material = new Material()
  ) {
    super()
  }
}
