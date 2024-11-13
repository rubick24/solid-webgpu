import { Vec3, Vec3Like } from 'math'
import { Object3D, Object3DProps } from './object3d'

export type PunctualLightProps = Object3DProps &
  Partial<
    { label: string; color: Vec3Like; intensity: number; range?: number } & (
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
export class PunctualLight extends Object3D {
  color = Vec3.fromValues(1, 1, 1)
  intensity = 1
  type: 'directional' | 'point' | 'spot' = 'directional'
  range?: number

  innerConeAngle = 0 // 0 ~ outerConeAngle
  outerConeAngle = Math.PI / 4.0 // innerConeAngle ~ PI/2

  constructor(options?: PunctualLightProps) {
    super()
    if (options?.color) this.color.copy(options.color)
    if (options?.label) this.label = options.label
    if (options?.intensity !== undefined) this.intensity = options.intensity
    if (options?.range !== undefined) this.range = options.range
    if (options?.type) this.type = options.type
    if (options && 'innerConeAngle' in options && options.innerConeAngle !== undefined)
      this.innerConeAngle = options.innerConeAngle
    if (options && 'outerConeAngle' in options && options.outerConeAngle !== undefined)
      this.outerConeAngle = options.outerConeAngle
  }
}

export type PunctualLightConstructor = typeof PunctualLight
