import React, { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'
import { Canvas, type SkImage } from '@shopify/react-native-skia'
import type { CardDocument, ViewState } from '../model/types'
import { CardRenderer } from '../renderer/CardRenderer'
import { thump } from './haptics'

const MAX_ROTATE_DEG = 14

/**
 * 3D card preview (CLAUDE.md §7): perspective tilt from a shared-value
 * ViewState, tap to flip, tilt-reactive drop shadow. The transform and
 * the shaders both read the tilt on the UI thread — a tilt frame costs
 * zero React renders (perf pass). Rendering goes through the same
 * CardRenderer as everything else.
 */
export function TiltCard({
  doc,
  tilt,
  width,
  assets,
  onSideChange,
}: {
  doc: CardDocument
  tilt: SharedValue<ViewState>
  width: number
  assets?: Record<string, SkImage>
  onSideChange?: (side: 'front' | 'back') => void
}) {
  const [side, setSideState] = useState<'front' | 'back'>('front')
  const setSide = (s: 'front' | 'back') => {
    setSideState(s)
    onSideChange?.(s)
  }
  const flip = useSharedValue(0)
  const flipped = useRef(false)

  const scale = width / doc.size.w
  // integer height: RN Skia's web canvas silently renders nothing when
  // its CSS size is fractional (found via /c/{id} viewer bring-up)
  const height = Math.round(doc.size.h * scale)

  const onFlip = () => {
    thump()
    flipped.current = !flipped.current
    flip.value = withSpring(flipped.current ? 1 : 0, { damping: 14, stiffness: 120 })
    // swap the rendered side at the halfway point of the spring
    setTimeout(() => setSide(flipped.current ? 'back' : 'front'), 140)
  }

  const cardStyle = useAnimatedStyle(() => {
    const v = tilt.value
    return {
      shadowOffset: { width: v.tiltX * -18, height: 10 + v.tiltY * -14 },
      transform: [
        { perspective: 900 },
        { rotateX: `${v.tiltY * -MAX_ROTATE_DEG}deg` },
        { rotateY: `${v.tiltX * MAX_ROTATE_DEG}deg` },
        { rotateY: `${flip.value * 180}deg` },
      ],
    }
  })

  // the back renders mirrored by the flip; counter-rotate its content, and
  // flip the shader's horizontal tilt/light too so highlights keep
  // tracking the physical light
  const mirror = side === 'back' ? { transform: [{ scaleX: -1 }] } : undefined
  const sideTilt = useDerivedValue<ViewState>(() => {
    const v = tilt.value
    return side === 'back'
      ? { tiltX: -v.tiltX, tiltY: v.tiltY, lightX: 1 - v.lightX, lightY: v.lightY }
      : v
  }, [side])

  return (
    <Pressable onPress={onFlip}>
      <Animated.View style={[styles.card, { width, height }, cardStyle]}>
        <View style={[{ width, height }, mirror]}>
          <Canvas style={{ width, height }}>
            <CardRenderer doc={doc} side={side} viewState={sideTilt} assets={assets} scale={scale} />
          </Canvas>
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
    backgroundColor: 'transparent',
  },
})
