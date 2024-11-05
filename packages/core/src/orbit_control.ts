import { Vec3 } from 'math'
import { Camera } from './camera'
import { clamp } from './utils'

enum BUTTONS {
  NONE = 0,
  LEFT = 1,
  RIGHT = 2
}

const KEYBOARD_ZOOM_SPEED = 0.04
const KEYBOARD_MOVE_SPEED = Math.PI * 4

export class OrbitControl {
  readonly center = Vec3.create()

  speed = 3
  minRadius = 0
  maxRadius = Infinity
  minTheta = -Infinity
  maxTheta = Infinity
  minPhi = 0
  maxPhi = Math.PI

  enableZoom = true
  enablePan = true
  enableKeys = true

  _element: HTMLElement | null = null

  private _camera: Camera
  private _v: Vec3 = Vec3.create()
  private _pointers = new Map<number, PointerEvent>()

  constructor(camera: Camera) {
    this._camera = camera
    this._camera.lookAt(this.center)
  }

  /**
   * Adjusts camera orbital zoom.
   */
  zoom(scale: number): void {
    this._camera.position.sub(this.center)
    const radius = Vec3.length(this._camera.position)
    this._camera.position.scale(clamp(this.minRadius, this.maxRadius, radius * scale) / radius)
    this._camera.position.add(this.center)
  }

  /**
   * Adjusts camera orbital position.
   */
  orbit(deltaX: number, deltaY: number): void {
    const offset = this._camera.position.sub(this.center)
    const radius = Vec3.length(offset)
    const deltaPhi = deltaY * (this.speed / this._element!.clientHeight)
    const deltaTheta = deltaX * (this.speed / this._element!.clientHeight)
    const phi = clamp(this.minPhi, this.maxPhi, Math.acos(offset.y / radius) - deltaPhi) || Number.EPSILON
    const theta = clamp(this.minTheta, this.maxTheta, Math.atan2(offset.z, offset.x) + deltaTheta) || Number.EPSILON
    Vec3.set(this._camera.position, Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
    this._camera.position.scale(radius).add(this.center)
    this._camera.lookAt(this.center)
  }

  /**
   * Adjusts orthogonal camera pan.
   */
  pan(deltaX: number, deltaY: number): void {
    this._camera.position.sub(this.center)
    Vec3.set(this._v, -deltaX, deltaY, 0)
    Vec3.transformQuat(this._v, this._v, this._camera.quaternion)
    this._v.scale(this.speed / this._element!.clientHeight)
    this.center.add(this._v)
    this._camera.position.add(this.center)
  }

  private _onContextMenu?: (event: MouseEvent) => void
  private _onWheel?: (event: WheelEvent) => void
  private _onPointerDown?: (event: PointerEvent) => void
  private _onPointerMove?: (event: PointerEvent) => void

  private _onPointerUp?: (event: PointerEvent) => void

  private _onKeyDown?: (event: KeyboardEvent) => void

  /**
   * Connects controls' event handlers, enabling interaction.
   */
  connect(element: HTMLElement): void {
    this.disconnect()
    this._onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }
    this._onWheel = (event: WheelEvent) => {
      if (!this.enableZoom) return
      event.preventDefault()
      this.zoom(1 + event.deltaY / 720)
    }
    this._onPointerDown = (event: PointerEvent) => {
      this._pointers.set(event.pointerId, event)
    }
    this._onPointerMove = (event: PointerEvent) => {
      const prevPointer = this._pointers.get(event.pointerId)!
      if (prevPointer) {
        const deltaX = (event.pageX - prevPointer.pageX) / this._pointers.size
        const deltaY = (event.pageY - prevPointer.pageY) / this._pointers.size

        const type = event.pointerType === 'touch' ? this._pointers.size : event.buttons
        if (type === BUTTONS.LEFT) {
          this._element!.style.cursor = 'grabbing'
          this.orbit(deltaX, deltaY)
        } else if (type === BUTTONS.RIGHT) {
          this._element!.style.cursor = 'grabbing'
          if (this.enablePan) this.pan(deltaX, deltaY)
        }
      } else if (event.pointerType !== 'touch') {
        this._element!.setPointerCapture(event.pointerId)
      }

      this._pointers.set(event.pointerId, event)
    }
    this._onPointerUp = (event: PointerEvent) => {
      this._element!.style.cursor = 'grab'
      this._element!.style.touchAction = this.enableZoom || this.enablePan ? 'none' : 'pinch-zoom'
      if (event.pointerType !== 'touch') this._element!.releasePointerCapture(event.pointerId)
      this._pointers.delete(event.pointerId)
    }
    this._onKeyDown = (event: KeyboardEvent) => {
      if (!this.enableKeys) return

      const move = event.shiftKey && this.enablePan ? this.pan.bind(this) : this.orbit.bind(this)
      const moveModifier = event.ctrlKey ? 10 : 1

      switch (event.code) {
        case 'Minus':
          if (!event.ctrlKey || !this.enableZoom) return
          event.preventDefault()
          return this.zoom(1 + KEYBOARD_ZOOM_SPEED)
        case 'Equal':
          if (!event.ctrlKey || !this.enableZoom) return
          event.preventDefault()
          return this.zoom(1 - KEYBOARD_ZOOM_SPEED)
        case 'ArrowUp':
          event.preventDefault()
          return move(0, -KEYBOARD_MOVE_SPEED * moveModifier)
        case 'ArrowDown':
          event.preventDefault()
          return move(0, KEYBOARD_MOVE_SPEED * moveModifier)
        case 'ArrowLeft':
          event.preventDefault()
          return move(-KEYBOARD_MOVE_SPEED * moveModifier, 0)
        case 'ArrowRight':
          event.preventDefault()
          return move(KEYBOARD_MOVE_SPEED * moveModifier, 0)
      }
    }

    element.addEventListener('contextmenu', this._onContextMenu)
    element.addEventListener('wheel', this._onWheel)
    element.addEventListener('pointerdown', this._onPointerDown)
    element.addEventListener('pointermove', this._onPointerMove)
    element.addEventListener('pointerup', this._onPointerUp)
    element.addEventListener('keydown', this._onKeyDown)
    element.tabIndex = 0
    element.style.outline = 'none'
    this._element = element
    this._element.style.cursor = 'grab'
  }

  /**
   * Disconnects controls' event handlers, disabling interaction.
   */
  disconnect(): void {
    const element = this._element
    if (!element) {
      return
    }
    element.removeEventListener('contextmenu', this._onContextMenu!)
    element.removeEventListener('wheel', this._onWheel!)
    element.removeEventListener('pointermove', this._onPointerMove!)
    element.removeEventListener('pointerup', this._onPointerUp!)
    element.removeEventListener('keydown', this._onKeyDown!)
    this._pointers.forEach(this._onPointerUp!)
    element.style.touchAction = ''
    this._element!.style.cursor = ''
    this._element = null
  }
}

export type OrbitControlConstructor = typeof OrbitControl
