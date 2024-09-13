export type FloatArray = Float32Array | Float64Array

export type Mat2Like = [number, number, number, number] | FloatArray
export type Mat2dLike = [number, number, number, number, number, number] | FloatArray
export type Mat3Like = [number, number, number, number, number, number, number, number, number] | FloatArray
export type Mat4Like =
  | [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number
    ]
  | FloatArray

export type Vec2Like = [number, number] | FloatArray
export type Vec3Like = [number, number, number] | FloatArray
export type Vec4Like = [number, number, number, number] | FloatArray

export type QuatLike = Vec4Like
export type Quat2Like = [number, number, number, number, number, number, number, number] | FloatArray
