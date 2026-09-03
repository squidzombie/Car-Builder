import React, { useEffect, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
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
  loadOnboarded,
  restoreAssets,
  saveCard,
  saveLastOpened,
  saveOnboarded,
} from './src/model/storage'
import { ShareViewer } from './src/web/ShareViewer'
import { shareConfigured } from './src/model/shareConfig'
import { uploadCard } from './src/model/shareApi'
import { Sheet } from './src/editor/Sheet'
import { pressHaptic } from './src/view/haptics'
import { color, pressed, raised, type as t } from './src/editor/theme'

// On web the app IS the share viewer: /c/{id} renders a card read-only.
const webShareId =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? /^\/c\/([a-z0-9-]+)/i.exec(window.location.pathname)?.[1] ?? null
    : null

// Two screens sharing one document store: the tilting preview (the magic
// moment, and the app's default view) and the editor. The working card
// auto-saves (debounced) and is restored on launch (M6 local save, §9).
export default function App() {
  const [screen, setScreen] = useState<'preview' | 'edit'>('preview')
  const [booted, setBooted] = useState(false)
  useBundledFonts()

  useEffect(() => {
    if (webShareId) return // viewer mode: no local storage
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
    if (!booted || webShareId) return
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

  if (webShareId) {
    return <ShareViewer cardId={webShareId} />
  }

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
  const { tilt, panHandlers } = useTilt()
  const doc = useEditor((s) => s.doc)
  const assets = useDocImages(doc)
  const [choosing, setChoosing] = useState(false)
  const [grading, setGrading] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [welcome, setWelcome] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [exportSide, setExportSide] = useState<'front' | 'back' | null>(null)
  const [linking, setLinking] = useState(false)
  const shownSide = useRef<'front' | 'back'>('front')

  // M7 onboarding: a one-time welcome over the already-tilting demo card
  useEffect(() => {
    let alive = true
    loadOnboarded()
      .then((seen) => {
        if (alive && !seen) setWelcome(true)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const dismissWelcome = () => {
    setWelcome(false)
    saveOnboarded().catch(() => {})
  }

  const title = doc.meta.title ?? 'Untitled card'
  const commitTitle = () => {
    const trimmed = draftTitle.trim()
    if (trimmed) useEditor.getState().apply((d) => (d.meta.title = trimmed))
    setRenaming(false)
  }

  const shareLink = async () => {
    if (linking) return
    setLinking(true)
    try {
      const { link } = await uploadCard(useEditor.getState().doc)
      await Share.share({ message: link })
    } catch {
      // upload is best-effort; the button re-enables either way
    } finally {
      setLinking(false)
    }
  }

  const cardWidth = Math.min(width - 48, 380)

  return (
    <View style={styles.root} {...panHandlers}>
      <TiltCard
        doc={doc}
        tilt={tilt}
        width={cardWidth}
        assets={assets}
        onSideChange={(s) => (shownSide.current = s)}
      />
      <Pressable {...pressHaptic} style={pressed(styles.gradeChip)} hitSlop={8} onPress={() => setGrading(true)}>
        <Text style={styles.gradeChipText}>
          {doc.condition ? `Grade · ${doc.condition.preset}` : 'Grade'}
        </Text>
      </Pressable>
      <View style={styles.controls}>
        <Pressable {...pressHaptic}
          style={pressed(styles.titleRow)}
          hitSlop={8}
          onPress={() => {
            setDraftTitle(doc.meta.title ?? '')
            setRenaming(true)
          }}
        >
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          <Feather name="edit-2" size={12} color={color.textFaint} />
        </Pressable>
        <View style={styles.buttonRow}>
          <Pressable {...pressHaptic} style={pressed(styles.editButton, styles.primaryButton)} onPress={onEdit} hitSlop={6}>
            <Text style={[styles.editButtonText, styles.primaryButtonText]}>Edit card</Text>
          </Pressable>
          <Pressable {...pressHaptic} style={pressed(styles.editButton)} onPress={() => setChoosing(true)} hitSlop={6}>
            <Text style={styles.editButtonText}>New</Text>
          </Pressable>
          <Pressable {...pressHaptic}
            style={pressed(styles.editButton)}
            hitSlop={6}
            disabled={exportSide !== null}
            onPress={() => setExportSide(shownSide.current)}
          >
            <Text style={styles.editButtonText}>
              {exportSide ? 'Exporting…' : 'Share'}
            </Text>
          </Pressable>
          {shareConfigured() ? (
            <Pressable {...pressHaptic}
              style={pressed(styles.editButton)}
              hitSlop={6}
              disabled={linking}
              onPress={shareLink}
            >
              <Text style={styles.editButtonText}>{linking ? 'Uploading…' : 'Link'}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.hint}>Tilt or drag to shine • tap to flip • Share exports this side</Text>
      </View>
      {welcome ? (
        <Sheet title="Make it shine" onClose={dismissWelcome} closeLabel="Skip">
          <View style={styles.welcomeRow}>
            <Feather name="smartphone" size={18} color={color.accent} />
            <Text style={styles.welcomeText}>
              Tilt your phone — the foil shifts like a real card
            </Text>
          </View>
          <View style={styles.welcomeRow}>
            <Feather name="refresh-cw" size={18} color={color.accent} />
            <Text style={styles.welcomeText}>Tap the card to flip it over</Text>
          </View>
          <View style={styles.welcomeRow}>
            <Feather name="edit-3" size={18} color={color.accent} />
            <Text style={styles.welcomeText}>
              Edit card to add photos, foil, stamps, and your name
            </Text>
          </View>
          <Pressable {...pressHaptic} style={pressed(styles.welcomeButton)} onPress={dismissWelcome}>
            <Text style={styles.welcomeButtonText}>Start creating</Text>
          </Pressable>
        </Sheet>
      ) : null}
      {renaming ? (
        <Sheet title="Card name" onClose={commitTitle} backdrop>
          <TextInput
            style={styles.titleInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            onSubmitEditing={commitTitle}
            placeholder="Untitled card"
            placeholderTextColor={color.textFaint}
            autoFocus
            selectTextOnFocus
          />
        </Sheet>
      ) : null}
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
    backgroundColor: color.bg0,
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 300 },
  titleText: { color: color.textMid, fontSize: t.base, fontWeight: '600' },
  titleInput: {
    color: color.text,
    fontSize: 16,
    backgroundColor: color.chip,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: color.chip,
    ...raised,
  },
  editButtonText: { color: color.textMid, fontSize: t.base },
  primaryButton: { backgroundColor: color.accent, ...raised },
  primaryButtonText: { color: color.onAccent, fontWeight: '700' },
  hint: { color: color.textFaint, fontSize: t.sm },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  welcomeText: { color: color.textMid, fontSize: t.base, flexShrink: 1, lineHeight: 20 },
  welcomeButton: {
    marginTop: 6,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: color.accent,
    ...raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeButtonText: { color: color.onAccent, fontSize: t.base, fontWeight: '700' },
  exportHolder: { position: 'absolute', left: -4000, top: 0 },
  gradeChip: {
    position: 'absolute',
    top: 56,
    left: 20,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: color.chip,
    ...raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeChipText: { color: color.textMid, fontSize: t.md },
})
