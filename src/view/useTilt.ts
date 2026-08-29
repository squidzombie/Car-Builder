import { useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder } from 'react-native'
import { DeviceMotion } from 'expo-sensors'
import type { ViewState } from '../model/types'
import { lightFromTilt } from '../model/types'

export type TiltMode = 'gyro' | 'drag'

const DEAD_ZONE = 0.03
const SMOOTHING = 0.18 // lerp factor per frame
const GYRO_RANGE = 0.6 // radians of device rotation mapped to full tilt

function applyDeadZone(v: number): number {
  if (Math.abs(v) < DEAD_ZONE) return 0
  return Math.sign(v) * ((Math.abs(v) - DEAD_ZONE) / (1 - DEAD_ZONE))
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

/**
 * Tilt input (CLAUDE.md §7): gyroscope by default with dead zone + smoothing,
 * drag fallback, toggleable. Returns a full ViewState (light derived from tilt).
 */
export function useTilt(initialMode: TiltMode = 'gyro') {
  const [mode, setMode] = useState<TiltMode>(initialMode)
  const [view, setView] = useState<ViewState>({ tiltX: 0, tiltY: 0, lightX: 0.5, lightY: 0.35 })
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })
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

  // gyro input
  useEffect(() => {
    if (mode !== 'gyro') return
    baseline.current = null
    DeviceMotion.setUpdateInterval(33)
    const sub = DeviceMotion.addListener((m) => {
      const rot = m.rotation
      if (!rot) return
      // First reading becomes the neutral pose so the card rests flat however
      // the user is holding the phone.
      if (!baseline.current) baseline.current = { beta: rot.beta, gamma: rot.gamma }
      const dx = (rot.gamma - baseline.current.gamma) / GYRO_RANGE
      const dy = (rot.beta - baseline.current.beta) / GYRO_RANGE
      target.current = { x: clamp(applyDeadZone(dx)), y: clamp(applyDeadZone(dy)) }
    })
    return () => sub.remove()
  }, [mode])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => mode === 'drag',
        onMoveShouldSetPanResponder: (_e, g) =>
          mode === 'drag' && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
        onPanResponderMove: (_e, g) => {
          target.current = { x: clamp(g.dx / 120), y: clamp(g.dy / 120) }
        },
        onPanResponderRelease: () => {
          target.current = { x: 0, y: 0 }
        },
      }),
    [mode],
  )

  return { view, mode, setMode, panHandlers: panResponder.panHandlers }
}
