import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Canvas, useCanvasRef, type SkImage } from '@shopify/react-native-skia'
import { useTilt } from './src/view/useTilt'
import { TiltCard } from './src/view/TiltCard'
import { TemplateChooser } from './src/view/TemplateChooser'
import { ConditionSheet } from './src/view/ConditionSheet'
import { useDocImages } from './src/view/useDocImages'
import { useBundledFonts } from './src/view/useBundledFonts'
import { TEMPLATES } from './src/templates'
import { EditorScreen } from './src/editor/EditorScreen'
import { useEditor } from './src/state/useEditor'
import { CardRenderer } from './src/renderer/CardRenderer'
import { lightFromTilt, type CardDocument, type ViewState } from './src/model/types'
import { setAssetUri } from './src/model/assets'
import {
  loadCard,
  loadLastOpened,
  restoreAssets,
  saveCard,
  saveLastOpened,
} from './src/model/storage'

// Two screens sharing one document store: the tilting preview (the magic
// moment, and the app's default view) and the editor. The working card
// auto-saves (debounced) and is restored on launch (M6 local save, §9).
export default function App() {
  const [screen, setScreen] = useState<'preview' | 'edit'>('preview')
  const [booted, setBooted] = useState(false)
  useBundledFonts()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await restoreAssets(setAssetUri)
        const lastId = await loadLastOpened()
        if (lastId) {
          const doc = await loadCard(lastId)
          if (doc && alive) useEditor.getState().loadDoc(doc)
        }
      } catch {
        // fall back to the in-memory demo card
      }
      if (alive) setBooted(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  // debounced autosave of every document change
  useEffect(() => {
    if (!booted) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.doc === prev.doc) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const doc = useEditor.getState().doc
        saveCard(doc).catch(() => {})
        saveLastOpened(doc.id).catch(() => {})
      }, 800)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsub()
    }
  }, [booted])

  return (
    <>
      <StatusBar style="light" />
      {screen === 'preview' ? (
        <PreviewScreen onEdit={() => setScreen('edit')} />
      ) : (
        <EditorScreen onPreview={() => setScreen('preview')} />
      )}
    </>
  )
}

function PreviewScreen({ onEdit }: { onEdit: () => void }) {
  const { width } = useWindowDimensions()
  const { view, panHandlers } = useTilt()
  const doc = useEditor((s) => s.doc)
  const assets = useDocImages(doc)
  const [choosing, setChoosing] = useState(false)
  const [grading, setGrading] = useState(false)
  const [exportSide, setExportSide] = useState<'front' | 'back' | null>(null)
  const shownSide = useRef<'front' | 'back'>('front')

  const cardWidth = Math.min(width - 48, 380)

  return (
    <View style={styles.root} {...panHandlers}>
      <TiltCard
        doc={doc}
        view={view}
        width={cardWidth}
        assets={assets}
        onSideChange={(s) => (shownSide.current = s)}
      />
      <Pressable style={styles.gradeChip} hitSlop={8} onPress={() => setGrading(true)}>
        <Text style={styles.gradeChipText}>
          {doc.condition ? `Grade · ${doc.condition.preset}` : 'Grade'}
        </Text>
      </Pressable>
      <View style={styles.controls}>
        <View style={styles.buttonRow}>
          <Pressable style={styles.editButton} onPress={onEdit} hitSlop={6}>
            <Text style={styles.editButtonText}>Edit card</Text>
          </Pressable>
          <Pressable style={styles.editButton} onPress={() => setChoosing(true)} hitSlop={6}>
            <Text style={styles.editButtonText}>New card</Text>
          </Pressable>
          <Pressable
            style={styles.editButton}
            hitSlop={6}
            disabled={exportSide !== null}
            onPress={() => setExportSide(shownSide.current)}
          >
            <Text style={styles.editButtonText}>
              {exportSide ? 'Exporting…' : 'Share'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Tilt or drag to shine • tap to flip • Share exports this side</Text>
      </View>
      {choosing ? (
        <TemplateChooser
          onClose={() => setChoosing(false)}
          onPick={(templateId) => {
            const template = TEMPLATES.find((t) => t.id === templateId)
            if (template) {
              useEditor.getState().loadDoc(template.make(`card-${Date.now().toString(36)}`))
              setChoosing(false)
              onEdit()
            }
          }}
          onOpenSaved={(saved) => {
            useEditor.getState().loadDoc(saved)
            setChoosing(false)
          }}
        />
      ) : null}
      {grading ? <ConditionSheet onClose={() => setGrading(false)} /> : null}
      {exportSide ? (
        <ExportSnapshot
          doc={doc}
          side={exportSide}
          assets={assets}
          onDone={() => setExportSide(null)}
        />
      ) : null}
    </View>
  )
}

// PNG export (§9): render the card offscreen at full document size with a
// fixed "hero" tilt, snapshot, write to cache, hand to the share sheet.
const HERO_TILT: ViewState = { tiltX: 0.35, tiltY: -0.22, ...lightFromTilt(0.35, -0.22) }

function ExportSnapshot({
  doc,
  side,
  assets,
  onDone,
}: {
  doc: CardDocument
  side: 'front' | 'back'
  assets: Record<string, SkImage>
  onDone: () => void
}) {
  const ref = useCanvasRef()
  useEffect(() => {
    let cancelled = false
    // give Skia two frames to draw the offscreen canvas before snapshotting
    requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        try {
          const image = ref.current?.makeImageSnapshot()
          if (!image || cancelled) return
          const base64 = image.encodeToBase64()
          const file = `${FileSystem.cacheDirectory}card-${doc.id}-${side}.png`
          await FileSystem.writeAsStringAsync(file, base64, {
            encoding: FileSystem.EncodingType.Base64,
          })
          if (!cancelled && (await Sharing.isAvailableAsync())) {
            await Sharing.shareAsync(file, { mimeType: 'image/png', dialogTitle: 'Share card' })
          }
        } catch {
          // export is best-effort; the button re-enables either way
        } finally {
          if (!cancelled) onDone()
        }
      }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.exportHolder} pointerEvents="none">
      <Canvas ref={ref} style={{ width: doc.size.w, height: doc.size.h }}>
        <CardRenderer doc={doc} side={side} viewState={HERO_TILT} assets={assets} />
      </Canvas>
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
  controls: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 10,
  },
  buttonRow: { flexDirection: 'row', gap: 10 },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1c2233',
  },
  editButtonText: { color: '#c9d6ea', fontSize: 14 },
  hint: { color: '#5a6478', fontSize: 12 },
  exportHolder: { position: 'absolute', left: -4000, top: 0 },
  gradeChip: {
    position: 'absolute',
    top: 56,
    left: 20,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#1c2233',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeChipText: { color: '#c9d6ea', fontSize: 13 },
})
