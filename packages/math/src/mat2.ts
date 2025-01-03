import { GLM_EPSILON } from './common'

import type { Mat2Like, Vec2Like } from './types'

/**
 * A 2x2 Matrix
 */
export class Mat2 extends Float32Array {
  static readonly IDENTITY_2X2 = new Float32Array([1, 0, 0, 1])

  /**
   * Create a {@link Mat2}.
   *
   * @category Constructor
   */
  constructor(...values: [Readonly<Mat2Like> | ArrayBufferLike, number?] | number[]) {
    switch (values.length) {
      case 4:
        super(values)
        break
      case 2:
        super(values[0] as ArrayBuffer, values[1], 4)
        break
      case 1:
        const v = values[0]
        if (typeof v === 'number') {
          super([v, v, v, v])
        } else {
          super(v as ArrayBuffer, 0, 4)
        }
        break
      default:
        super(Mat2.IDENTITY_2X2)
        break
    }
  }

  // ============
  // Accessors
  // ============

  /**
   * A string representation of `this`
   * Equivalent to `Mat2.str(this);`
   *
   * @category Accessors
   */
  get str(): string {
    return Mat2.str(this)
  }

  // ===================
  // Instance methods
  // ===================

  subarray(begin: number, end: number) {
    return new Float32Array(this.buffer, this.byteOffset + begin * 4, end - begin)
  }

  /**
   * Copy the values from another {@link Mat2} into `this`.
   *
   * @param a the source vector
   * @returns `this`
   * @category Methods
   */
  copy(a: Readonly<Mat2Like>): this {
    this.set(a)
    return this
  }

  /**
   * Set `this` to the identity matrix
   * Equivalent to Mat2.identity(this)
   *
   * @returns `this`
   * @category Methods
   */
  identity(): this {
    this.set(Mat2.IDENTITY_2X2)
    return this
  }

  /**
   * Multiplies this {@link Mat2} against another one
   * Equivalent to `Mat2.multiply(this, this, b);`
   *
   * @param b - The second operand
   * @returns `this`
   * @category Methods
   */
  multiply(b: Readonly<Mat2Like>): this {
    return Mat2.multiply(this, this, b) as this
  }

  /**
   * Transpose this {@link Mat2}
   * Equivalent to `Mat2.transpose(this, this);`
   *
   * @returns `this`
   * @category Methods
   */
  transpose(): this {
    return Mat2.transpose(this, this) as this
  }

  /**
   * Inverts this {@link Mat2}
   * Equivalent to `Mat4.invert(this, this);`
   *
   * @returns `this`
   * @category Methods
   */
  invert(): this {
    return Mat2.invert(this, this) as this
  }

  /**
   * Scales this {@link Mat2} by the dimensions in the given vec3 not using vectorization
   * Equivalent to `Mat2.scale(this, this, v);`
   *
   * @param v - The {@link Vec2} to scale the matrix by
   * @returns `this`
   * @category Methods
   */
  scale(v: Readonly<Vec2Like>): this {
    return Mat2.scale(this, this, v) as this
  }

  /**
   * Rotates this {@link Mat2} by the given angle around the given axis
   * Equivalent to `Mat2.rotate(this, this, rad);`
   *
   * @param rad - the angle to rotate the matrix by
   * @returns `this`
   * @category Methods
   */
  rotate(rad: number): this {
    return Mat2.rotate(this, this, rad) as this
  }

  // ===================
  // Static accessors
  // ===================

  /**
   * @category Static
   *
   * @returns The number of bytes in a {@link Mat2}.
   */
  static get BYTE_LENGTH(): number {
    return 4 * Float32Array.BYTES_PER_ELEMENT
  }

  // ===================
  // Static methods
  // ===================

  /**
   * Creates a new, identity {@link Mat2}
   * @category Static
   *
   * @returns A new {@link Mat2}
   */
  static create(): Mat2 {
    return new Mat2()
  }

  /**
   * Creates a new {@link Mat2} initialized with values from an existing matrix
   * @category Static
   *
   * @param a - Matrix to clone
   * @returns A new {@link Mat2}
   */
  static clone(a: Readonly<Mat2Like>): Mat2 {
    return new Mat2(a)
  }

  /**
   * Copy the values from one {@link Mat2} to another
   * @category Static
   *
   * @param out - The receiving Matrix
   * @param a - Matrix to copy
   * @returns `out`
   */
  static copy<T extends Mat2Like>(out: T, a: Readonly<Mat2Like>): T {
    out[0] = a[0]
    out[1] = a[1]
    out[2] = a[2]
    out[3] = a[3]
    return out
  }

  /**
   * Create a new {@link Mat2} with the given values
   * @category Static
   *
   * @param values - Matrix components
   * @returns A new {@link Mat2}
   */
  static fromValues(...values: number[]): Mat2 {
    return new Mat2(...values)
  }

  /**
   * Set the components of a {@link Mat2} to the given values
   * @category Static
   *
   * @param out - The receiving matrix
   * @param values - Matrix components
   * @returns `out`
   */
  static set<T extends Mat2Like>(out: T, ...values: number[]): T {
    out[0] = values[0]
    out[1] = values[1]
    out[2] = values[2]
    out[3] = values[3]
    return out
  }

  /**
   * Set a {@link Mat2} to the identity matrix
   * @category Static
   *
   * @param out - The receiving matrix
   * @returns `out`
   */
  static identity<T extends Mat2Like>(out: T): T {
    out[0] = 1
    out[1] = 0
    out[2] = 0
    out[3] = 1
    return out
  }

  /**
   * Transpose the values of a {@link Mat2}
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the source matrix
   * @returns `out`
   */
  static transpose<T extends Mat2Like>(out: T, a: Readonly<Mat2Like>): T {
    // If we are transposing ourselves we can skip a few steps but have to cache
    // some values
    if (out === a) {
      const a1 = a[1]
      out[1] = a[2]
      out[2] = a1
    } else {
      out[0] = a[0]
      out[1] = a[2]
      out[2] = a[1]
      out[3] = a[3]
    }

    return out
  }

  /**
   * Inverts a {@link Mat2}
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the source matrix
   * @returns `out` or `null` if the matrix is not invertible
   */
  static invert<T extends Mat2Like>(out: T, a: Mat2Like): T | null {
    const a0 = a[0]
    const a1 = a[1]
    const a2 = a[2]
    const a3 = a[3]

    // Calculate the determinant
    let det = a0 * a3 - a2 * a1

    if (!det) {
      return null
    }
    det = 1.0 / det

    out[0] = a3 * det
    out[1] = -a1 * det
    out[2] = -a2 * det
    out[3] = a0 * det

    return out
  }

  /**
   * Calculates the adjugate of a {@link Mat2}
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the source matrix
   * @returns `out`
   */
  static adjoint<T extends Mat2Like>(out: T, a: Mat2Like): T {
    // Caching this value is necessary if out == a
    const a0 = a[0]
    out[0] = a[3]
    out[1] = -a[1]
    out[2] = -a[2]
    out[3] = a0
    return out
  }

  /**
   * Calculates the determinant of a {@link Mat2}
   * @category Static
   *
   * @param a - the source matrix
   * @returns determinant of a
   */
  static determinant(a: Readonly<Mat2Like>): number {
    return a[0] * a[3] - a[2] * a[1]
  }

  /**
   * Adds two {@link Mat2}'s
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static add<T extends Mat2Like>(out: T, a: Readonly<Mat2Like>, b: Readonly<Mat2Like>): T {
    out[0] = a[0] + b[0]
    out[1] = a[1] + b[1]
    out[2] = a[2] + b[2]
    out[3] = a[3] + b[3]
    return out
  }

  /**
   * Subtracts matrix b from matrix a
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static subtract<T extends Mat2Like>(out: T, a: Readonly<Mat2Like>, b: Readonly<Mat2Like>): T {
    out[0] = a[0] - b[0]
    out[1] = a[1] - b[1]
    out[2] = a[2] - b[2]
    out[3] = a[3] - b[3]
    return out
  }

  /**
   * Multiplies two {@link Mat2}s
   * @category Static
   *
   * @param out - The receiving Matrix
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static multiply<T extends Mat2Like>(out: T, a: Readonly<Mat2Like>, b: Readonly<Mat2Like>): T {
    const a0 = a[0]
    const a1 = a[1]
    const a2 = a[2]
    const a3 = a[3]
    const b0 = b[0]
    const b1 = b[1]
    const b2 = b[2]
    const b3 = b[3]
    out[0] = a0 * b0 + a2 * b1
    out[1] = a1 * b0 + a3 * b1
    out[2] = a0 * b2 + a2 * b3
    out[3] = a1 * b2 + a3 * b3
    return out
  }

  /**
   * Rotates a {@link Mat2} by the given angle
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to rotate
   * @param rad - the angle to rotate the matrix by
   * @returns `out`
   */
  static rotate<T extends Mat2Like>(out: T, a: Readonly<Mat2Like>, rad: number): T {
    const a0 = a[0]
    const a1 = a[1]
    const a2 = a[2]
    const a3 = a[3]
    const s = Math.sin(rad)
    const c = Math.cos(rad)
    out[0] = a0 * c + a2 * s
    out[1] = a1 * c + a3 * s
    out[2] = a0 * -s + a2 * c
    out[3] = a1 * -s + a3 * c
    return out
  }

  /**
   * Scales the {@link Mat2} by the dimensions in the given {@link Vec2}
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to scale
   * @param v - the {@link Vec2} to scale the matrix by
   * @returns `out`
   **/
  static scale<T extends Mat2Like>(out: T, a: Readonly<Mat2Like>, v: Readonly<Vec2Like>): T {
    const a0 = a[0]
    const a1 = a[1]
    const a2 = a[2]
    const a3 = a[3]
    const v0 = v[0]
    const v1 = v[1]
    out[0] = a0 * v0
    out[1] = a1 * v0
    out[2] = a2 * v1
    out[3] = a3 * v1
    return out
  }

  /**
   * Creates a {@link Mat2} from a given angle around a given axis
   * This is equivalent to (but much faster than):
   * ```js
   *   mat2.identity(dest);
   *   mat2.rotate(dest, dest, rad);
   * ```
   * @category Static
   *
   * @param out - {@link Mat2} receiving operation result
   * @param rad - the angle to rotate the matrix by
   * @returns `out`
   */
  static fromRotation<T extends Mat2Like>(out: T, rad: number): T {
    const s = Math.sin(rad)
    const c = Math.cos(rad)
    out[0] = c
    out[1] = s
    out[2] = -s
    out[3] = c
    return out
  }

  /**
   * Creates a {@link Mat2} from a vector scaling
   * This is equivalent to (but much faster than):
   * ```js
   *   mat2.identity(dest);
   *   mat2.scale(dest, dest, vec);
   * ```
   * @category Static
   *
   * @param out - {@link Mat2} receiving operation result
   * @param v - Scaling vector
   * @returns `out`
   */
  static fromScaling<T extends Mat2Like>(out: T, v: Readonly<Vec2Like>): T {
    out[0] = v[0]
    out[1] = 0
    out[2] = 0
    out[3] = v[1]
    return out
  }

  /**
   * Returns Frobenius norm of a {@link Mat2}
   * @category Static
   *
   * @param a - the matrix to calculate Frobenius norm of
   * @returns Frobenius norm
   */
  static frob(a: Readonly<Mat2Like>): number {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3])
  }

  /**
   * Multiply each element of a {@link Mat2} by a scalar.
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to scale
   * @param b - amount to scale the matrix's elements by
   * @returns `out`
   */
  static multiplyScalar<T extends Mat2Like>(out: T, a: Readonly<Mat2Like>, b: number): T {
    out[0] = a[0] * b
    out[1] = a[1] * b
    out[2] = a[2] * b
    out[3] = a[3] * b
    return out
  }

  /**
   * Adds two {@link Mat2}'s after multiplying each element of the second operand by a scalar value.
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @param scale - the amount to scale b's elements by before adding
   * @returns `out`
   */
  static multiplyScalarAndAdd<T extends Mat2Like>(
    out: T,
    a: Readonly<Mat2Like>,
    b: Readonly<Mat2Like>,
    scale: number
  ): T {
    out[0] = a[0] + b[0] * scale
    out[1] = a[1] + b[1] * scale
    out[2] = a[2] + b[2] * scale
    out[3] = a[3] + b[3] * scale
    return out
  }

  /**
   * Returns L, D and U matrices (Lower triangular, Diagonal and Upper triangular) by factorizing the input matrix
   * @category Static
   *
   * @param L - the lower triangular matrix
   * @param D - the diagonal matrix
   * @param U - the upper triangular matrix
   * @param a - the input matrix to factorize
   */

  static LDU(
    L: Mat2Like,
    D: Readonly<Mat2Like>,
    U: Mat2Like,
    a: Readonly<Mat2Like>
  ): [Mat2Like, Readonly<Mat2Like>, Mat2Like] {
    L[2] = a[2] / a[0]
    U[0] = a[0]
    U[1] = a[1]
    U[3] = a[3] - L[2] * U[1]
    return [L, D, U]
  }

  /**
   * Returns whether two {@link Mat2}s have exactly the same elements in the same position (when compared with ===)
   * @category Static
   *
   * @param a - The first matrix.
   * @param b - The second matrix.
   * @returns True if the matrices are equal, false otherwise.
   */
  static exactEquals(a: Readonly<Mat2Like>, b: Readonly<Mat2Like>): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
  }

  /**
   * Returns whether two {@link Mat2}s have approximately the same elements in the same position.
   * @category Static
   *
   * @param a - The first matrix.
   * @param b - The second matrix.
   * @returns True if the matrices are equal, false otherwise.
   */
  static equals(a: Readonly<Mat2Like>, b: Readonly<Mat2Like>): boolean {
    const a0 = a[0]
    const a1 = a[1]
    const a2 = a[2]
    const a3 = a[3]

    const b0 = b[0]
    const b1 = b[1]
    const b2 = b[2]
    const b3 = b[3]

    return (
      Math.abs(a0 - b0) <= GLM_EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) &&
      Math.abs(a1 - b1) <= GLM_EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1)) &&
      Math.abs(a2 - b2) <= GLM_EPSILON * Math.max(1, Math.abs(a2), Math.abs(b2)) &&
      Math.abs(a3 - b3) <= GLM_EPSILON * Math.max(1, Math.abs(a3), Math.abs(b3))
    )
  }

  /**
   * Returns a string representation of a {@link Mat2}
   * @category Static
   *
   * @param a - matrix to represent as a string
   * @returns string representation of the matrix
   */
  static str(a: Readonly<Mat2Like>): string {
    return `Mat2(${a.join(', ')})`
  }

  static mul = this.multiply
  static sub = this.subtract
}

export interface Mat2 {
  mul: typeof Mat2.prototype.multiply
}
Mat2.prototype.mul = Mat2.prototype.multiply
