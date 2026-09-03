import { useEffect, useMemo, useRef } from 'react'
import { PanResponder } from 'react-native'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { DeviceMotion } from 'expo-sensors'
import type { ViewState } from '../model/types'
import { lightFromTilt } from '../model/types'

import {
  GYRO_RANGE,
  applyDeadZone,
  clamp,
  initialBaseline,
  nextBaseline,
  type Baseline,
} from './tiltMath'

const SMOOTHING = 0.18 // lerp factor per frame
const DRAG_RANGE = 120 // px of finger travel mapped to full tilt
const DRAG_SLOP = 8 // px of movement before a touch counts as a drag, not a tap

export const REST_VIEW: ViewState = { tiltX: 0, tiltY: 0, lightX: 0.5, lightY: 0.35 }

/**
 * Tilt input (CLAUDE.md §7): gyroscope and finger drag are both always live —
 * a drag takes over while the finger is down and hands back to the gyro on
 * release. Returns the tilt as a Reanimated SHARED VALUE (perf pass): the
 * smoothing loop writes it every frame without a single React re-render,
 * and the card's shaders and 3D transform read it on the UI thread.
 *
 * Spread `panHandlers` on a view that CONTAINS the card's tap target: the
 * responder captures the touch only once it moves past DRAG_SLOP, so taps
 * still reach the card (flip) while drags never trigger it.
 */
export function useTilt(): {
  tilt: SharedValue<ViewState>
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers']
} {
  const tilt = useSharedValue<ViewState>(REST_VIEW)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })
  const gyroTarget = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const grabbed = useRef({ x: 0, y: 0 })
  const baseline = useRef<Baseline | null>(null)

  // smoothing loop: one tiny JS callback per frame that only touches the
  // shared value — no state, no reconciliation
  useEffect(() => {
    let raf = 0
    const step = () => {
      const c = current.current
      const t = target.current
      c.x += (t.x - c.x) * SMOOTHING
      c.y += (t.y - c.y) * SMOOTHING
      const prev = tilt.value
      if (Math.abs(prev.tiltX - c.x) >= 0.001 || Math.abs(prev.tiltY - c.y) >= 0.001) {
        tilt.value = { tiltX: c.x, tiltY: c.y, ...lightFromTilt(c.x, c.y) }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [tilt])

  // gyro input — keeps updating during a drag so release hands back smoothly
  useEffect(() => {
    DeviceMotion.setUpdateInterval(33)
    const sub = DeviceMotion.addListener((m) => {
      const rot = m.rotation
      if (!rot) return
      // First reading becomes the neutral pose so the card rests flat however
      // the user is holding the phone; afterwards the neutral pose settles
      // onto whatever pose the phone is held STILL in (tiltMath) — never
      // stuck skewed, never fighting a deliberate tilt.
      if (!baseline.current) baseline.current = initialBaseline(rot)
      const dx = (rot.gamma - baseline.current.gamma) / GYRO_RANGE
      const dy = (rot.beta - baseline.current.beta) / GYRO_RANGE
      baseline.current = nextBaseline(
        baseline.current,
        { beta: rot.beta, gamma: rot.gamma },
        Math.max(Math.abs(dx), Math.abs(dy)),
      )
      gyroTarget.current = { x: clamp(applyDeadZone(dx)), y: clamp(applyDeadZone(dy)) }
      if (!dragging.current) target.current = gyroTarget.current
    })
    return () => sub.remove()
  }, [])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // capture: steal the touch from the card's Pressable once it is
        // clearly a drag, so the flip only ever fires on a genuine tap
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > DRAG_SLOP || Math.abs(g.dy) > DRAG_SLOP,
        onPanResponderGrant: () => {
          dragging.current = true
          grabbed.current = { ...current.current }
        },
        onPanResponderMove: (_e, g) => {
          target.current = {
            x: clamp(grabbed.current.x + g.dx / DRAG_RANGE),
            y: clamp(grabbed.current.y + g.dy / DRAG_RANGE),
          }
        },
        onPanResponderRelease: () => {
          dragging.current = false
          target.current = gyroTarget.current
        },
        onPanResponderTerminate: () => {
          dragging.current = false
          target.current = gyroTarget.current
        },
      }),
    [],
  )

  return { tilt, panHandlers: panResponder.panHandlers }
}
