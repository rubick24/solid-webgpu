import { Vec3 } from '@rubick24/math'
import { createEffect, flush, untrack } from 'solid-js'

import { lookAt } from './camera'
import type { CameraRef, MaybeAccessor } from './types'
import { access, clamp } from './utils'

enum BUTTONS {
  NONE = 0,
  LEFT = 1,
  RIGHT = 2,
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
  camera: MaybeAccessor<CameraRef | undefined>,
  options?: MaybeAccessor<Partial<OrbitControlOptions>>,
) => {
  const center = Vec3.create()
  const _v = Vec3.create()
  const _nextPosition = Vec3.create()
  const _pointers = new Map<number, PointerEvent>()
  let orbitFrame = 0
  let pendingOrbitX = 0
  let pendingOrbitY = 0
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
    enableKeys: true,
  }
  createEffect(
    () => {
      const value = access(options)
      return value ? { ...value } : undefined
    },
    nextOptions => {
      Object.assign(opts, nextOptions)
    },
  )

  let _el: HTMLCanvasElement | undefined
  createEffect(
    () => access(el),
    element => {
      _el = element
      if (!element) {
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
            element.style.cursor = 'grabbing'
            ops.orbit?.(deltaX, deltaY)
          } else if (type === BUTTONS.RIGHT) {
            element.style.cursor = 'grabbing'
            if (opts.enablePan) ops.pan?.(deltaX, deltaY)
          }
        } else if (event.pointerType !== 'touch') {
          element.setPointerCapture(event.pointerId)
        }

        _pointers.set(event.pointerId, event)
      }
      const _onPointerUp = (event: PointerEvent) => {
        element.style.cursor = 'grab'
        element.style.touchAction = opts.enableZoom || opts.enablePan ? 'none' : 'pinch-zoom'
        if (event.pointerType !== 'touch') element.releasePointerCapture(event.pointerId)
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

      element.addEventListener('contextmenu', _onContextMenu)
      element.addEventListener('wheel', _onWheel, { passive: false })
      element.addEventListener('pointerdown', _onPointerDown)
      element.addEventListener('pointermove', _onPointerMove)
      element.addEventListener('pointerup', _onPointerUp)
      element.addEventListener('keydown', _onKeyDown)
      element.tabIndex = 0
      element.style.outline = 'none'
      element.style.cursor = 'grab'

      return () => {
        element.removeEventListener('contextmenu', _onContextMenu)
        element.removeEventListener('wheel', _onWheel)
        element.removeEventListener('pointerdown', _onPointerDown)
        element.removeEventListener('pointermove', _onPointerMove)
        element.removeEventListener('pointerup', _onPointerUp)
        element.removeEventListener('keydown', _onKeyDown)
        _pointers.forEach(_onPointerUp)
        element.style.touchAction = ''
        element.style.cursor = ''
        if (_el === element) _el = undefined
      }
    },
  )

  createEffect(
    () => {
      const value = access(camera)
      return value
        ? {
            position: value.position,
            quaternion: value.quaternion,
            up: value.up,
            setPosition: value.setPosition,
            setQuaternion: value.setQuaternion,
            scene: value.scene,
            initialPosition: untrack(() => value.position()),
            initialUp: untrack(() => value.up()),
          }
        : undefined
    },
    currentCamera => {
      if (!currentCamera) {
        return
      }
      const _camera = currentCamera

      untrack(() => {
        _camera.setQuaternion(v => {
          lookAt(v, currentCamera.initialPosition, currentCamera.initialUp, center)
          return v
        })
      })

      const o3d = _camera
      ops.zoom = (scale: number) => {
        o3d.setPosition(v => {
          v.sub(center)
          const radius = Vec3.length(v)
          v.scale(clamp(opts.minRadius, opts.maxRadius, radius * scale) / radius)
          v.add(center)
          return v
        })
      }

      const applyOrbit = (deltaX: number, deltaY: number) => {
        const offset = Vec3.sub(_v, o3d.position(), center)
        const radius = Vec3.length(offset)
        const deltaPhi = deltaY * (opts.speed / _el!.clientHeight)
        const deltaTheta = deltaX * (opts.speed / _el!.clientHeight)
        const phi = clamp(opts.minPhi, opts.maxPhi, Math.acos(offset.y / radius) - deltaPhi) || Number.EPSILON
        const theta = clamp(opts.minTheta, opts.maxTheta, Math.atan2(offset.z, offset.x) + deltaTheta) || Number.EPSILON

        Vec3.set(_nextPosition, Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
        _nextPosition.scale(radius).add(center)

        // Solid 2 queues writes until the microtask flush. Derive the matching
        // rotation from the target position instead of reading the still-committed
        // position immediately after scheduling its update.
        o3d.setPosition(v => {
          Vec3.set(v, _nextPosition.x, _nextPosition.y, _nextPosition.z)
          return v
        })
        _camera.setQuaternion(v => {
          lookAt(v, _nextPosition, _camera.up(), center)
          return v
        })
      }

      ops.orbit = (deltaX: number, deltaY: number) => {
        pendingOrbitX += deltaX
        pendingOrbitY += deltaY
        if (orbitFrame) return

        orbitFrame = requestAnimationFrame(() => {
          orbitFrame = 0
          const dx = pendingOrbitX
          const dy = pendingOrbitY
          pendingOrbitX = 0
          pendingOrbitY = 0
          applyOrbit(dx, dy)

          // Flush the single coalesced camera write, then render in this same
          // frame so the renderer does not add a second requestAnimationFrame.
          flush()
          untrack(() => _camera.scene()?.[0].renderNow?.())
        })
      }

      ops.pan = (deltaX: number, deltaY: number) => {
        o3d.setPosition(v => {
          v.sub(center)
          Vec3.set(_v, -deltaX, deltaY, 0)
          Vec3.transformQuat(_v, _v, o3d.quaternion())
          _v.scale(opts.speed / _el!.clientHeight)
          center.add(_v)
          v.add(center)
          return v
        })
      }

      return () => {
        if (orbitFrame) cancelAnimationFrame(orbitFrame)
        orbitFrame = 0
        pendingOrbitX = 0
        pendingOrbitY = 0
      }
    },
  )
}
