import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Sharing from 'expo-sharing'
import { Canvas, ImageFormat, useCanvasRef, type SkImage } from '@shopify/react-native-skia'
import { useSharedValue } from 'react-native-reanimated'
import { CardRenderer } from '../renderer/CardRenderer'
import { lightFromTilt, type CardDocument, type ViewState } from '../model/types'
import { videoExport } from '../native/videoExport'

// Looping tilt video (CLAUDE.md §9 v1.5): renders the card offscreen at
// full document size through a seamless 3s sweep of tilts, hands each
// frame to the native H.264 writer as a JPEG, then opens the share sheet
// with the mp4. Progress reports 0..1 for the button label.

const FPS = 30
const SECONDS = 3
const FRAMES = FPS * SECONDS

/** Seamless loop: a tilted ellipse in tilt space, one full revolution. */
function tiltAt(i: number): ViewState {
  const t = (i / FRAMES) * Math.PI * 2
  const tiltX = Math.sin(t) * 0.7
  const tiltY = Math.cos(t) * 0.45 - 0.1
  return { tiltX, tiltY, ...lightFromTilt(tiltX, tiltY) }
}

const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

export function VideoExport({
  doc,
  side,
  assets,
  onProgress,
  onDone,
}: {
  doc: CardDocument
  side: 'front' | 'back'
  assets: Record<string, SkImage>
  onProgress: (p: number) => void
  onDone: () => void
}) {
  const ref = useCanvasRef()
  const tilt = useSharedValue<ViewState>(tiltAt(0))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // even dimensions for H.264
        const w = doc.size.w - (doc.size.w % 2)
        const h = doc.size.h - (doc.size.h % 2)
        await videoExport.begin(w, h, FPS)
        for (let i = 0; i < FRAMES; i++) {
          if (cancelled) {
            await videoExport.cancel()
            return
          }
          tilt.value = tiltAt(i)
          await nextFrame()
          const image = ref.current?.makeImageSnapshot()
          if (!image) throw new Error('snapshot failed')
          await videoExport.appendFrame(image.encodeToBase64(ImageFormat.JPEG, 92))
          onProgress((i + 1) / FRAMES)
        }
        const uri = await videoExport.finish()
        if (!cancelled && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(uri, { mimeType: 'video/mp4', dialogTitle: 'Share card video' })
        }
      } catch {
        setFailed(true)
        await videoExport.cancel().catch(() => {})
      } finally {
        if (!cancelled) onDone()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (failed) return null
  return (
    <View style={styles.holder} pointerEvents="none">
      <Canvas ref={ref} style={{ width: doc.size.w, height: doc.size.h }}>
        <CardRenderer doc={doc} side={side} viewState={tilt} assets={assets} />
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create({
  holder: { position: 'absolute', left: -4000, top: 0 },
})
