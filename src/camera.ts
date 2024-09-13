import { DEG2RAD, GLM_EPSILON, Mat4, Vec3 } from './math'
import { Vec3Like } from './math/types'
import { Object3D } from './object3d'
import { DesktopInput } from './input'
import { Frustum } from './frustum'

export class Camera extends Object3D {
  /**
   * A projection matrix. Useful for projecting transforms.
   */
  readonly projectionMatrix = new Mat4()
  /**
   * A view matrix. Useful for aligning transforms with the camera.
   */
  readonly viewMatrix = new Mat4()
  /**
   * A projection-view matrix. Used internally for checking whether objects are in view.
   */
  readonly projectionViewMatrix = new Mat4()
  /**
   * Frustum clipping planes. Used to calculate a frustum representation.
   */
  readonly frustum = new Frustum()

  _lookAtMatrix = new Mat4()

  updateMatrix() {
    super.updateMatrix()
    if (this.matrixAutoUpdate) this.viewMatrix.copy(this.matrix).invert()
  }
}

/**
 * Constructs a camera with a perspective projection. Useful for 3D rendering.
 */
export class PerspectiveCamera extends Camera {
  /** Vertical field of view in degrees. Default is `75` */
  public fov = 75 * DEG2RAD
  /** Frustum aspect ratio. Default is `1` */
  public aspect = 1
  /** Frustum near plane (minimum). Default is `0.1` */
  public near = 0.1
  /** Frustum far plane (maximum). Default is `1000` */
  public far = 1000
  constructor(options?: { fov?: number; aspect?: number; near?: number; far?: number }) {
    super()
    if (options?.fov !== undefined) this.fov = options.fov
    if (options?.aspect !== undefined) this.aspect = options.aspect
    if (options?.near !== undefined) this.near = options.near
    if (options?.far !== undefined) this.far = options.far
  }

  updateMatrix(): void {
    super.updateMatrix()
    if (this.matrixAutoUpdate) {
      Mat4.perspectiveZO(this.projectionMatrix, this.fov, this.aspect, this.near, this.far)
    }
  }
}

/**
 * Constructs a camera with an orthographic projection. Useful for 2D and isometric rendering.
 */
export class OrthographicCamera extends Camera {
  /** Frustum near plane (minimum). Default is `0.1` */
  public near = 0.1
  /** Frustum far plane (maximum). Default is `1000` */
  public far = 1000
  /** Frustum left plane. Default is `-1` */
  public left = -1
  /** Frustum right plane. Default is `1` */
  public right = 1
  /** Frustum bottom plane. Default is `-1` */
  public bottom = -1
  /** Frustum top plane. Default is `1` */
  public top = 1
  constructor(options?: { near?: number; far?: number; left?: number; right?: number; bottom?: number; top?: number }) {
    super()
    if (options?.near !== undefined) this.near = options.near
    if (options?.far !== undefined) this.far = options.far
    if (options?.left !== undefined) this.left = options.left
    if (options?.right !== undefined) this.right = options.right
    if (options?.bottom !== undefined) this.bottom = options.bottom
    if (options?.top !== undefined) this.top = options.top
  }

  updateMatrix(): void {
    super.updateMatrix()
    if (this.matrixAutoUpdate) {
      Mat4.orthoZO(this.projectionMatrix, this.left, this.right, this.bottom, this.top, this.near, this.far)
    }
  }
}

export class ArcRotateCamera extends PerspectiveCamera {
  public target: Vec3 = Vec3.create()
  public theta: number = Math.PI / 2
  public phi: number = Math.PI / 2
  public radius: number = 3

  constructor(
    options?: ConstructorParameters<typeof PerspectiveCamera>[0] & {
      target?: Vec3Like
      theta?: number
      phi?: number
      radius?: number
    }
  ) {
    super(options)
    if (options?.target !== undefined) this.target.copy(options.target)
    if (options?.theta !== undefined) this.theta = options.theta
    if (options?.phi !== undefined) this.phi = options.phi
    if (options?.radius !== undefined) this.radius = options.radius
  }

  updateMatrix(): void {
    const cosA = Math.cos(this.theta)
    const sinA = Math.sin(this.theta)
    const cosB = Math.cos(this.phi)
    const sinB = Math.sin(this.phi) !== 0 ? Math.sin(this.phi) : GLM_EPSILON

    Vec3.set(this.position, cosA * sinB, cosB, sinA * sinB)

    this.position.scale(this.radius)

    Mat4.targetTo(this._lookAtMatrix, this.position, this.target, this.up)
    Mat4.getRotation(this.quaternion, this._lookAtMatrix)

    super.updateMatrix()
  }

  public processDesktopInput(di: DesktopInput) {
    if (di.mouseInput.dragging) {
      const deltaX = di.mouseInput.x - di.mouseInput.lastX
      const deltaY = di.mouseInput.y - di.mouseInput.lastY
      const radianX = (deltaX / di.el.clientWidth) * Math.PI * 2
      const radianY = -(deltaY / di.el.clientHeight) * Math.PI * 2
      this.theta += radianX
      this.phi += radianY
    }
    const deltaWheel = di.mouseInput.lastWheel - di.mouseInput.wheel
    this.radius += deltaWheel / 1000
  }
}
