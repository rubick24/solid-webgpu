import { Vec3 } from './math'
import { Object3D } from './object3d'

export class PunctualLight extends Object3D {
  color = Vec3.fromValues(1, 1, 1)
  intensity = 1
  type: 'directional' | 'point' | 'spot' = 'directional'
  range?: number

  innerConeAngle = 0 // 0 ~ outerConeAngle
  outerConeAngle = Math.PI / 4.0 // innerConeAngle ~ PI/2

  constructor(
    options?: Partial<
      { label: string; color: Vec3; intensity: number; range?: number } & (
        | {
            type: 'directional' | 'point'
          }
        | {
            type: 'spot'
            innerConeAngle: number
            outerConeAngle: number
          }
      )
    >
  ) {
    super()
    Object.assign(this, options)
  }
}
