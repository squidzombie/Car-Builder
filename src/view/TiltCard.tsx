import React, { useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { Canvas, type SkImage } from '@shopify/react-native-skia'
import type { CardDocument, ViewState } from '../model/types'
import { CardRenderer } from '../renderer/CardRenderer'

const MAX_ROTATE_DEG = 14

/**
 * 3D card preview (CLAUDE.md §7): perspective tilt from ViewState, tap to
 * flip, tilt-reactive drop shadow. Rendering goes through the same
 * CardRenderer as everything else.
 */
export function TiltCard({
  doc,
  view,
  width,
  assets,
}: {
  doc: CardDocument
  view: ViewState
  width: number
  assets?: Record<string, SkImage>
}) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const flip = useRef(new Animated.Value(0)).current
  const flipped = useRef(false)

  const scale = width / doc.size.w
  const height = doc.size.h * scale

  const onFlip = () => {
    flipped.current = !flipped.current
    Animated.spring(flip, {
      toValue: flipped.current ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start()
    // swap the rendered side at the halfway point of the spring
    setTimeout(() => setSide(flipped.current ? 'back' : 'front'), 140)
  }

  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const tiltXDeg = `${(view.tiltY * -MAX_ROTATE_DEG).toFixed(2)}deg`
  const tiltYDeg = `${(view.tiltX * MAX_ROTATE_DEG).toFixed(2)}deg`
  // back side renders mirrored by the flip; counter-rotate its content
  const mirror = side === 'back' ? { transform: [{ scaleX: -1 }] } : undefined
  // the mirror flips the canvas' horizontal axis, so flip the shader's
  // horizontal tilt/light too — highlights keep tracking the physical light
  const sideView =
    side === 'back'
      ? { tiltX: -view.tiltX, tiltY: view.tiltY, lightX: 1 - view.lightX, lightY: view.lightY }
      : view

  return (
    <Pressable onPress={onFlip}>
      <Animated.View
        style={[
          styles.card,
          {
            width,
            height,
            shadowOffset: { width: view.tiltX * -18, height: 10 + view.tiltY * -14 },
            transform: [
              { perspective: 900 },
              { rotateX: tiltXDeg },
              { rotateY: tiltYDeg },
              { rotateY },
            ],
          },
        ]}
      >
        <View style={[{ width, height }, mirror]}>
          <Canvas style={{ width, height }}>
            <CardRenderer doc={doc} side={side} viewState={sideView} assets={assets} scale={scale} />
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
