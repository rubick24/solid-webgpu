import { Geometry } from './geometry'
import { Material } from './material'
import { Object3D } from './object3d'

export class Mesh extends Object3D {

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
