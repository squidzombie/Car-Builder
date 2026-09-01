import React, { useMemo, useRef } from 'react'
import { PanResponder, StyleSheet, Text, View } from 'react-native'
import { color, type } from './theme'

// Small shared slider (builder, mask/text editors). The responder lives
// on a vertically-padded hit area (~50dp) around the visual track;
// children are pointerEvents:none so locationX is hit-area-relative,
// which matches the track horizontally (no horizontal padding).

export function MiniSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onBegin,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  /** called once when a drag starts (undo grouping) */
  onBegin?: () => void
}) {
  const trackW = useRef(1)
  const cb = useRef({ onChange, onBegin })
  cb.current = { onChange, onBegin }
  const rangeRef = useRef({ min, max, step })
  rangeRef.current = { min, max, step }

  const setFromX = (x: number) => {
    const { min: lo, max: hi, step: st } = rangeRef.current
    let v = lo + Math.max(0, Math.min(1, x / trackW.current)) * (hi - lo)
    if (st) v = Math.round(v / st) * st
    cb.current.onChange(Math.max(lo, Math.min(hi, v)))
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          cb.current.onBegin?.()
          setFromX(e.nativeEvent.locationX)
        },
        onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const frac = (value - min) / (max - min)

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View
        style={styles.hit}
        onLayout={(e) => (trackW.current = Math.max(1, e.nativeEvent.layout.width))}
        {...pan.panHandlers}
      >
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.trackFill, { width: `${frac * 100}%` }]} />
          <View style={[styles.thumb, { left: `${frac * 100}%` }]} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sliderRow: { gap: 2 },
  sliderLabel: { color: color.textDim, fontSize: type.sm },
  hit: { paddingVertical: 8, justifyContent: 'center' },
  track: {
    height: 34,
    borderRadius: 17,
    backgroundColor: color.chip,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: color.chipActive,
  },
  thumb: {
    position: 'absolute',
    width: 4,
    height: 24,
    borderRadius: 2,
    marginLeft: -2,
    backgroundColor: color.accent,
  },
})
