import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Canvas, Rect } from '@shopify/react-native-skia'
import { CardRenderer } from '../renderer/CardRenderer'
import type { CardDocument, ViewState } from '../model/types'
import { lightFromTilt } from '../model/types'
import { deserializeCard } from '../model/serialize'
import { demoCard } from '../templates/demo'
import { TiltCard } from '../view/TiltCard'
import { useDocImages } from '../view/useDocImages'
import { useBundledFonts } from '../view/useBundledFonts'
import { SUPABASE_URL } from '../model/shareConfig'

// The /c/{id} web viewer (M6, CLAUDE.md §9): the SAME CardRenderer as the
// app, tilted by mouse position (desktop) or device orientation (mobile
// web). `/c/demo` renders the built-in demo card for local testing.

const SMOOTHING = 0.14

export function ShareViewer({ cardId }: { cardId: string }) {
  const { width, height } = useWindowDimensions()
  useBundledFonts()
  const [doc, setDoc] = useState<CardDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>({ tiltX: 0, tiltY: 0, lightX: 0.5, lightY: 0.35 })
  const target = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (cardId === 'demo') {
      setDoc(demoCard())
      return
    }
    if (!SUPABASE_URL) {
      setError('This link is not connected to a card store yet.')
      return
    }
    fetch(`${SUPABASE_URL}/storage/v1/object/public/cards/${cardId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`not found (${r.status})`)
        return r.text()
      })
      .then((json) => setDoc(deserializeCard(json)))
      .catch(() => setError('This card could not be found. The link may be wrong or expired.'))
  }, [cardId])

  // mouse tilt (desktop) + device orientation (mobile web)
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      }
    }
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      target.current = {
        x: Math.max(-1, Math.min(1, e.gamma / 30)),
        y: Math.max(-1, Math.min(1, (e.beta - 40) / 30)),
      }
    }
    window.addEventListener('pointermove', onPointer)
    window.addEventListener('deviceorientation', onOrient)
    let raf = 0
    const current = { x: 0, y: 0 }
    const step = () => {
      current.x += (target.current.x - current.x) * SMOOTHING
      current.y += (target.current.y - current.y) * SMOOTHING
      setView((prev) => {
        if (Math.abs(prev.tiltX - current.x) < 0.001 && Math.abs(prev.tiltY - current.y) < 0.001) {
          return prev
        }
        return { tiltX: current.x, tiltY: current.y, ...lightFromTilt(current.x, current.y) }
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('deviceorientation', onOrient)
      cancelAnimationFrame(raf)
    }
  }, [])

  const assets = useDocImages(doc ?? demoCard())
  const cardWidth = Math.min(width - 48, height * 0.62, 420)

  if (cardId === 'plain') {
    // render sanity probe: one bare rect, no shaders/fonts/images
    return (
      <View style={styles.root}>
        <Canvas style={{ width: 300, height: 300 }}>
          <Rect x={20} y={20} width={260} height={260} color="#e63946" />
        </Canvas>
      </View>
    )
  }

  if (cardId === 'tilt') {
    // probe 3: TiltCard with a STATIC view — isolates the 60fps loop
    return (
      <View style={styles.root}>
        <TiltCard
          doc={demoCard()}
          view={{ tiltX: 0.3, tiltY: -0.2, lightX: 0.6, lightY: 0.3 }}
          width={320}
        />
      </View>
    )
  }

  if (cardId === 'flat') {
    // probe 2: full CardRenderer, no TiltCard wrapper
    const d = demoCard()
    if (typeof window !== 'undefined' && window.location.search.includes('notext')) {
      d.front.layers = d.front.layers.filter((l) => l.type !== 'text')
    }
    return (
      <View style={styles.root}>
        <Canvas style={{ width: 320, height: 448 }}>
          <CardRenderer
            doc={d}
            side="front"
            viewState={{ tiltX: 0.3, tiltY: -0.2, lightX: 0.6, lightY: 0.3 }}
            scale={320 / d.size.w}
          />
        </Canvas>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {doc ? (
        <TiltCard doc={doc} view={view} width={cardWidth} assets={assets} />
      ) : (
        <Text style={styles.message}>{error ?? 'Loading card…'}</Text>
      )}
      <View style={styles.footer}>
        <Text style={styles.brand}>Card Builder</Text>
        <Text style={styles.hint}>
          {doc ? 'Move your mouse (or tilt your phone) to see the shine · click to flip' : ' '}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08090f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { color: '#7f8db0', fontSize: 15, paddingHorizontal: 32, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 28, alignItems: 'center', gap: 6 },
  brand: { color: '#e6ecf7', fontSize: 15, fontWeight: '600', letterSpacing: 1 },
  hint: { color: '#5a6478', fontSize: 12 },
})
