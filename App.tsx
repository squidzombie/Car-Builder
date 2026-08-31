import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useTilt } from './src/view/useTilt'
import { TiltCard } from './src/view/TiltCard'
import { TemplateChooser } from './src/view/TemplateChooser'
import { useDocImages } from './src/view/useDocImages'
import { useBundledFonts } from './src/view/useBundledFonts'
import { TEMPLATES } from './src/templates'
import { EditorScreen } from './src/editor/EditorScreen'
import { useEditor } from './src/state/useEditor'

// Two screens sharing one document store: the tilting preview (the magic
// moment, and the app's default view) and the M2 editor. Edits show up in
// the preview instantly because both read the same doc.
export default function App() {
  const [screen, setScreen] = useState<'preview' | 'edit'>('preview')
  useBundledFonts()
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

  const cardWidth = Math.min(width - 48, 380)

  return (
    <View style={styles.root} {...panHandlers}>
      <TiltCard doc={doc} view={view} width={cardWidth} assets={assets} />
      <View style={styles.controls}>
        <View style={styles.buttonRow}>
          <Pressable style={styles.editButton} onPress={onEdit} hitSlop={6}>
            <Text style={styles.editButtonText}>Edit card</Text>
          </Pressable>
          <Pressable style={styles.editButton} onPress={() => setChoosing(true)} hitSlop={6}>
            <Text style={styles.editButtonText}>New card</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Tilt or drag to shine • tap to flip</Text>
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
        />
      ) : null}
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
})
