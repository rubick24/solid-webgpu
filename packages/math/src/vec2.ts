import { GLM_EPSILON } from './common'
import { Vec2Like, Mat2Like, Mat2dLike, Mat3Like, Mat4Like } from './types'

export class Vec2 extends Float32Array {
  constructor(...values: [Readonly<Vec2Like> | ArrayBufferLike, number?] | number[]) {
    switch (values.length) {
      case 2: {
        const v = values[0]
        if (typeof v === 'number') {
          super([v, values[1]!])
        } else {
          super(v as ArrayBufferLike, values[1], 2)
        }
        break
      }
      case 1: {
        const v = values[0]
        if (typeof v === 'number') {
          super([v, v])
        } else {
          super(v as ArrayBufferLike, 0, 2)
        }
        break
      }
      default:
        super(2)
        break
    }
  }

  get x() {
    return this[0]
  }
  set x(value: number) {
    this[0] = value
  }
  get y() {
    return this[1]
  }
  set y(value: number) {
    this[1] = value
  }
  get r() {
    return this[0]
  }
  set r(value: number) {
    this[0] = value
  }
  get g() {
    return this[1]
  }
  set g(value: number) {
    this[1] = value
  }

  get magnitude() {
    return Math.hypot(this[0], this[1])
  }
  get mag() {
    return this.magnitude
  }
  get squaredMagnitude() {
    const x = this[0]
    const y = this[1]
    return x * x + y * y
  }
  get sqrMag() {
    return this.squaredMagnitude
  }
  get str(): string {
    return Vec2.str(this)
  }

  copy(a: Readonly<Vec2Like>) {
    this.set(a)
    return this
  }
  add(b: Readonly<Vec2Like>) {
    this[0] += b[0]
    this[1] += b[1]
    return this
  }
  subtract(b: Readonly<Vec2Like>) {
    this[0] -= b[0]
    this[1] -= b[1]
    return this
  }
  multiply(b: Readonly<Vec2Like>) {
    this[0] *= b[0]
    this[1] *= b[1]
    return this
  }
  divide(b: Readonly<Vec2Like>) {
    this[0] /= b[0]
    this[1] /= b[1]
    return this
  }
  scale(b: number) {
    this[0] *= b
    this[1] *= b
    return this
  }
  scaleAndAdd(b: Readonly<Vec2Like>, scale: number) {
    this[0] += b[0] * scale
    this[1] += b[1] * scale
    return this
  }
  distance(b: Readonly<Vec2Like>) {
    return Vec2.distance(this, b)
  }
  squaredDistance(b: Readonly<Vec2Like>): number {
    return Vec2.squaredDistance(this, b)
  }
  negate() {
    this[0] *= -1
    this[1] *= -1
    return this
  }
  invert() {
    this[0] = 1.0 / this[0]
    this[1] = 1.0 / this[1]
    return this
  }
  abs() {
    this[0] = Math.abs(this[0])
    this[1] = Math.abs(this[1])
    return this
  }
  dot(b: Readonly<Vec2Like>) {
    return this[0] * b[0] + this[1] * b[1]
  }
  normalize() {
    return Vec2.normalize(this, this) as this
  }

  static get BYTE_LENGTH() {
    return 2 * Float32Array.BYTES_PER_ELEMENT
  }
  static create() {
    return new Vec2()
  }
  static clone(a: Readonly<Vec2Like>) {
    return new Vec2(a)
  }
  static fromValues(x: number, y: number) {
    return new Vec2(x, y)
  }
  static copy<T extends Vec2 | Vec2Like>(out: T, a: Readonly<Vec2Like>) {
    out[0] = a[0]
    out[1] = a[1]
    return out
  }
  static set(out: Vec2Like, x: number, y: number) {
    out[0] = x
    out[1] = y
    return out
  }
  static add(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    out[0] = a[0] + b[0]
    out[1] = a[1] + b[1]
    return out
  }
  static subtract(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    out[0] = a[0] - b[0]
    out[1] = a[1] - b[1]
    return out
  }
  static multiply(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    out[0] = a[0] * b[0]
    out[1] = a[1] * b[1]
    return out
  }
  static divide(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    out[0] = a[0] / b[0]
    out[1] = a[1] / b[1]
    return out
  }
  static ceil(out: Vec2Like, a: Readonly<Vec2Like>) {
    out[0] = Math.ceil(a[0])
    out[1] = Math.ceil(a[1])
    return out
  }
  static floor(out: Vec2Like, a: Readonly<Vec2Like>) {
    out[0] = Math.floor(a[0])
    out[1] = Math.floor(a[1])
    return out
  }
  static min(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    out[0] = Math.min(a[0], b[0])
    out[1] = Math.min(a[1], b[1])
    return out
  }
  static max(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    out[0] = Math.max(a[0], b[0])
    out[1] = Math.max(a[1], b[1])
    return out
  }
  static round(out: Vec2Like, a: Readonly<Vec2Like>) {
    out[0] = Math.round(a[0])
    out[1] = Math.round(a[1])
    return out
  }
  static scale(out: Vec2Like, a: Readonly<Vec2Like>, b: number) {
    out[0] = a[0] * b
    out[1] = a[1] * b
    return out
  }
  static scaleAndAdd(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>, scale: number) {
    out[0] = a[0] + b[0] * scale
    out[1] = a[1] + b[1] * scale
    return out
  }
  static distance(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    return Math.hypot(b[0] - a[0], b[1] - a[1])
  }

  static squaredDistance(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    const x = b[0] - a[0]
    const y = b[1] - a[1]
    return x * x + y * y
  }

  static magnitude(a: Readonly<Vec2Like>) {
    const x = a[0]
    const y = a[1]
    return Math.hypot(x, y)
  }

  static squaredLength(a: Readonly<Vec2Like>) {
    const x = a[0]
    const y = a[1]
    return x * x + y * y
  }
  static negate(out: Vec2Like, a: Readonly<Vec2Like>) {
    out[0] = -a[0]
    out[1] = -a[1]
    return out
  }
  static inverse(out: Vec2Like, a: Readonly<Vec2Like>) {
    out[0] = 1.0 / a[0]
    out[1] = 1.0 / a[1]
    return out
  }
  static abs(out: Vec2Like, a: Readonly<Vec2Like>) {
    out[0] = Math.abs(a[0])
    out[1] = Math.abs(a[1])
    return out
  }

  static normalize(out: Vec2Like, a: Readonly<Vec2Like>) {
    const x = a[0]
    const y = a[1]
    let len = x * x + y * y
    if (len > 0) {
      // TODO: evaluate use of glm_invsqrt here?
      len = 1 / Math.sqrt(len)
    }
    out[0] = a[0] * len
    out[1] = a[1] * len
    return out
  }
  static dot(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    return a[0] * b[0] + a[1] * b[1]
  }
  static cross(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    const z = a[0] * b[1] - a[1] * b[0]
    out[0] = out[1] = 0
    out[2] = z
    return out
  }
  static lerp(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>, t: number) {
    const ax = a[0]
    const ay = a[1]
    out[0] = ax + t * (b[0] - ax)
    out[1] = ay + t * (b[1] - ay)
    return out
  }
  static transformMat2(out: Vec2Like, a: Readonly<Vec2Like>, m: Readonly<Mat2Like>) {
    const x = a[0]
    const y = a[1]
    out[0] = m[0] * x + m[2] * y
    out[1] = m[1] * x + m[3] * y
    return out
  }
  static transformMat2d(out: Vec2Like, a: Readonly<Vec2Like>, m: Readonly<Mat2dLike>) {
    const x = a[0]
    const y = a[1]
    out[0] = m[0] * x + m[2] * y + m[4]
    out[1] = m[1] * x + m[3] * y + m[5]
    return out
  }
  static transformMat3(out: Vec2Like, a: Readonly<Vec2Like>, m: Readonly<Mat3Like>) {
    const x = a[0]
    const y = a[1]
    out[0] = m[0] * x + m[3] * y + m[6]
    out[1] = m[1] * x + m[4] * y + m[7]
    return out
  }
  static transformMat4(out: Vec2Like, a: Readonly<Vec2Like>, m: Readonly<Mat4Like>) {
    const x = a[0]
    const y = a[1]
    out[0] = m[0] * x + m[4] * y + m[12]
    out[1] = m[1] * x + m[5] * y + m[13]
    return out
  }
  static rotate(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>, rad: number) {
    // Translate point to the origin
    const p0 = a[0] - b[0]
    const p1 = a[1] - b[1]
    const sinC = Math.sin(rad)
    const cosC = Math.cos(rad)

    // perform rotation and translate to correct position
    out[0] = p0 * cosC - p1 * sinC + b[0]
    out[1] = p0 * sinC + p1 * cosC + b[1]

    return out
  }
  static angle(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    const x1 = a[0]
    const y1 = a[1]
    const x2 = b[0]
    const y2 = b[1]
    // mag is the product of the magnitudes of a and b
    const mag = Math.hypot(x1, y1) * Math.hypot(x2, y2)
    // mag &&.. short circuits if mag == 0
    const cosine = mag && (x1 * x2 + y1 * y2) / mag
    // Math.min(Math.max(cosine, -1), 1) clamps the cosine between -1 and 1
    return Math.acos(Math.min(Math.max(cosine, -1), 1))
  }
  static zero(out: Vec2Like) {
    out[0] = 0.0
    out[1] = 0.0
    return out
  }
  static exactEquals(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    return a[0] === b[0] && a[1] === b[1]
  }
  static equals(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>) {
    const a0 = a[0]
    const a1 = a[1]
    const b0 = b[0]
    const b1 = b[1]
    return (
      Math.abs(a0 - b0) <= GLM_EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
      Math.abs(a1 - b1) <= GLM_EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1))
    )
  }

  static str(a: Readonly<Vec2Like>) {
    return `Vec2(${a.join(', ')})`
  }

  static sub = this.subtract
  static mul = this.multiply
  static div = this.divide
  static dist = this.distance
  static sqrDist = this.squaredDistance
  static mag = this.magnitude
  static length = this.magnitude
  static len = this.magnitude
  static sqrLen = this.squaredLength
}

export interface Vec2 {
  sub: typeof Vec2.prototype.subtract
  mul: typeof Vec2.prototype.multiply
  div: typeof Vec2.prototype.divide
  dist: typeof Vec2.prototype.distance
  sqrDist: typeof Vec2.prototype.squaredDistance
}

;(
  [
    ['sub', 'subtract'],
    ['mul', 'multiply'],
    ['div', 'divide'],
    ['dist', 'distance'],
    ['sqrDist', 'squaredDistance']
  ] as const
).forEach(v => (Vec2.prototype[v[0]] = Vec2.prototype[v[1]] as any))
