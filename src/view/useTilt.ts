import { useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder } from 'react-native'
import { DeviceMotion } from 'expo-sensors'
import type { ViewState } from '../model/types'
import { lightFromTilt } from '../model/types'

const DEAD_ZONE = 0.03
const SMOOTHING = 0.18 // lerp factor per frame
const GYRO_RANGE = 0.6 // radians of device rotation mapped to full tilt
const DRAG_RANGE = 120 // px of finger travel mapped to full tilt
const DRAG_SLOP = 8 // px of movement before a touch counts as a drag, not a tap

// The neutral pose is not fixed: it drifts toward however the phone is
// actually being held, so launching with the phone tilted (or settling
// into a new position) self-corrects instead of leaving the card skewed
// (first beta feedback). Slow enough that quick tilts still shine.
// Two speeds: ambient drift is slow (tau ~8s) so deliberately holding a
// tilt to admire the shine barely fades, but an offset pinned PAST full
// tilt (the launched-sideways case) is absorbed fast until back in range.
const BASELINE_DRIFT = 0.004 // per ~33ms reading
const BASELINE_DRIFT_PINNED = 0.05

function applyDeadZone(v: number): number {
  if (Math.abs(v) < DEAD_ZONE) return 0
  return Math.sign(v) * ((Math.abs(v) - DEAD_ZONE) / (1 - DEAD_ZONE))
}

/** Pure baseline update for one gyro reading (exported for tests). */
export function nextBaseline(
  baseline: { beta: number; gamma: number },
  rot: { beta: number; gamma: number },
  offsetMagnitude: number,
): { beta: number; gamma: number } {
  const f = offsetMagnitude > 1 ? BASELINE_DRIFT_PINNED : BASELINE_DRIFT
  return {
    beta: baseline.beta + (rot.beta - baseline.beta) * f,
    gamma: baseline.gamma + (rot.gamma - baseline.gamma) * f,
  }
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

/**
 * Tilt input (CLAUDE.md §7): gyroscope and finger drag are both always live —
 * a drag takes over while the finger is down and hands back to the gyro on
 * release. Returns a full ViewState (light derived from tilt).
 *
 * Spread `panHandlers` on a view that CONTAINS the card's tap target: the
 * responder captures the touch only once it moves past DRAG_SLOP, so taps
 * still reach the card (flip) while drags never trigger it.
 */
export function useTilt() {
  const [view, setView] = useState<ViewState>({ tiltX: 0, tiltY: 0, lightX: 0.5, lightY: 0.35 })
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })
  const gyroTarget = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const grabbed = useRef({ x: 0, y: 0 })
  const baseline = useRef<{ beta: number; gamma: number } | null>(null)

  // smoothing loop
  useEffect(() => {
    let raf = 0
    const step = () => {
      const c = current.current
      const t = target.current
      c.x += (t.x - c.x) * SMOOTHING
      c.y += (t.y - c.y) * SMOOTHING
      setView((prev) => {
        if (Math.abs(prev.tiltX - c.x) < 0.001 && Math.abs(prev.tiltY - c.y) < 0.001) return prev
        return { tiltX: c.x, tiltY: c.y, ...lightFromTilt(c.x, c.y) }
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  // gyro input — keeps updating during a drag so release hands back smoothly
  useEffect(() => {
    DeviceMotion.setUpdateInterval(33)
    const sub = DeviceMotion.addListener((m) => {
      const rot = m.rotation
      if (!rot) return
      // First reading becomes the neutral pose so the card rests flat however
      // the user is holding the phone; afterwards the baseline slowly drifts
      // toward the current pose so it can never get stuck skewed.
      if (!baseline.current) baseline.current = { beta: rot.beta, gamma: rot.gamma }
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

  return { view, panHandlers: panResponder.panHandlers }
}
