import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useTilt } from './src/view/useTilt'
import { TiltCard } from './src/view/TiltCard'
import { EditorScreen } from './src/editor/EditorScreen'
import { useEditor } from './src/state/useEditor'

// Two screens sharing one document store: the tilting preview (the magic
// moment, and the app's default view) and the M2 editor. Edits show up in
// the preview instantly because both read the same doc.
export default function App() {
  const [screen, setScreen] = useState<'preview' | 'edit'>('preview')
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

  const cardWidth = Math.min(width - 48, 380)

  return (
    <View style={styles.root} {...panHandlers}>
      <TiltCard doc={doc} view={view} width={cardWidth} />
      <View style={styles.controls}>
        <Pressable style={styles.editButton} onPress={onEdit} hitSlop={6}>
          <Text style={styles.editButtonText}>Edit card</Text>
        </Pressable>
        <Text style={styles.hint}>Tilt or drag to shine • tap to flip</Text>
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
  controls: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 10,
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1c2233',
  },
  editButtonText: { color: '#c9d6ea', fontSize: 14 },
  hint: { color: '#5a6478', fontSize: 12 },
})
