import { Vec3 } from 'math'
import { createEffect, onCleanup } from 'solid-js'
import { CameraToken } from './tokenizer'
import { access, clamp, MaybeAccessor } from './utils'

enum BUTTONS {
  NONE = 0,
  LEFT = 1,
  RIGHT = 2
}

const KEYBOARD_ZOOM_SPEED = 0.04
const KEYBOARD_MOVE_SPEED = Math.PI * 4

export type OrbitControlOptions = {
  speed: number
  minRadius: number
  maxRadius: number
  minTheta: number
  maxTheta: number
  minPhi: number
  maxPhi: number

  enableZoom: boolean
  enablePan: boolean
  enableKeys: boolean
}

export const createOrbitControl = (
  el: MaybeAccessor<HTMLCanvasElement | undefined>,
  camera: MaybeAccessor<CameraToken | undefined>,
  options?: MaybeAccessor<Partial<OrbitControlOptions>>
) => {
  const center = Vec3.create()
  const _v = Vec3.create()
  const _pointers = new Map<number, PointerEvent>()
  const ops: {
    zoom?: (scale: number) => void
    orbit?: (dx: number, dy: number) => void
    pan?: (dx: number, dy: number) => void
  } = {}

  const opts: OrbitControlOptions = {
    speed: 3,
    minRadius: 0,
    maxRadius: Infinity,
    minTheta: -Infinity,
    maxTheta: Infinity,
    minPhi: 0,
    maxPhi: Math.PI,

    enableZoom: true,
    enablePan: true,
    enableKeys: true
  }
  createEffect(() => Object.assign(opts, access(options)))

  let _el: HTMLCanvasElement | undefined = undefined
  createEffect(() => {
    _el = access(el)
    if (!_el) {
      return
    }

    const _onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }
    const _onWheel = (event: WheelEvent) => {
      if (!opts.enableZoom) return
      event.preventDefault()
      ops.zoom?.(1 + event.deltaY / 720)
    }
    const _onPointerDown = (event: PointerEvent) => {
      _pointers.set(event.pointerId, event)
    }
    const _onPointerMove = (event: PointerEvent) => {
      const prevPointer = _pointers.get(event.pointerId)!
      if (prevPointer) {
        const deltaX = (event.pageX - prevPointer.pageX) / _pointers.size
        const deltaY = (event.pageY - prevPointer.pageY) / _pointers.size

        const type = event.pointerType === 'touch' ? _pointers.size : event.buttons
        if (type === BUTTONS.LEFT) {
          _el!.style.cursor = 'grabbing'
          ops.orbit?.(deltaX, deltaY)
        } else if (type === BUTTONS.RIGHT) {
          _el!.style.cursor = 'grabbing'
          if (opts.enablePan) ops.pan?.(deltaX, deltaY)
        }
      } else if (event.pointerType !== 'touch') {
        _el!.setPointerCapture(event.pointerId)
      }

      _pointers.set(event.pointerId, event)
    }
    const _onPointerUp = (event: PointerEvent) => {
      _el!.style.cursor = 'grab'
      _el!.style.touchAction = opts.enableZoom || opts.enablePan ? 'none' : 'pinch-zoom'
      if (event.pointerType !== 'touch') _el!.releasePointerCapture(event.pointerId)
      _pointers.delete(event.pointerId)
    }
    const _onKeyDown = (event: KeyboardEvent) => {
      if (!opts.enableKeys) return

      const move = event.shiftKey && opts.enablePan ? ops.pan : ops.orbit
      const moveModifier = event.ctrlKey ? 10 : 1

      switch (event.code) {
        case 'Minus':
          if (!event.ctrlKey || !opts.enableZoom) return
          event.preventDefault()
          return ops.zoom?.(1 + KEYBOARD_ZOOM_SPEED)
        case 'Equal':
          if (!event.ctrlKey || !opts.enableZoom) return
          event.preventDefault()
          return ops.zoom?.(1 - KEYBOARD_ZOOM_SPEED)
        case 'ArrowUp':
          event.preventDefault()
          return move?.(0, -KEYBOARD_MOVE_SPEED * moveModifier)
        case 'ArrowDown':
          event.preventDefault()
          return move?.(0, KEYBOARD_MOVE_SPEED * moveModifier)
        case 'ArrowLeft':
          event.preventDefault()
          return move?.(-KEYBOARD_MOVE_SPEED * moveModifier, 0)
        case 'ArrowRight':
          event.preventDefault()
          return move?.(KEYBOARD_MOVE_SPEED * moveModifier, 0)
      }
    }

    _el.addEventListener('contextmenu', _onContextMenu)
    _el.addEventListener('wheel', _onWheel, { passive: true })
    _el.addEventListener('pointerdown', _onPointerDown)
    _el.addEventListener('pointermove', _onPointerMove)
    _el.addEventListener('pointerup', _onPointerUp)
    _el.addEventListener('keydown', _onKeyDown)
    _el.tabIndex = 0
    _el.style.outline = 'none'
    _el.style.cursor = 'grab'

    onCleanup(() => {
      if (!_el) {
        return
      }
      _el.removeEventListener('contextmenu', _onContextMenu!)
      _el.removeEventListener('wheel', _onWheel!)
      _el.removeEventListener('pointermove', _onPointerMove!)
      _el.removeEventListener('pointerup', _onPointerUp!)
      _el.removeEventListener('keydown', _onKeyDown!)
      _pointers.forEach(_onPointerUp!)
      _el.style.touchAction = ''
      _el.style.cursor = ''
    })
  })

  createEffect(() => {
    const _camera = access(camera)
    if (!_camera) {
      return
    }
    _camera.lookAt(center)

    ops.zoom = (scale: number) => {
      _camera.position.sub(center)
      const radius = Vec3.length(_camera.position)
      _camera.position.scale(clamp(opts.minRadius, opts.maxRadius, radius * scale) / radius)
      _camera.position.add(center)
    }

    ops.orbit = (deltaX: number, deltaY: number) => {
      const offset = _camera.position.sub(center)
      const radius = Vec3.length(offset)
      const deltaPhi = deltaY * (opts.speed / _el!.clientHeight)
      const deltaTheta = deltaX * (opts.speed / _el!.clientHeight)
      const phi = clamp(opts.minPhi, opts.maxPhi, Math.acos(offset.y / radius) - deltaPhi) || Number.EPSILON
      const theta = clamp(opts.minTheta, opts.maxTheta, Math.atan2(offset.z, offset.x) + deltaTheta) || Number.EPSILON
      Vec3.set(_camera.position, Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
      _camera.position.scale(radius).add(center)
      _camera.lookAt(center)
    }

    ops.pan = (deltaX: number, deltaY: number) => {
      _camera.position.sub(center)
      Vec3.set(_v, -deltaX, deltaY, 0)
      Vec3.transformQuat(_v, _v, _camera.quaternion)
      _v.scale(opts.speed / _el!.clientHeight)
      center.add(_v)
      _camera.position.add(center)
    }
  })
}
