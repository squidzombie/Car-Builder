import React, { useMemo } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { demoCard } from './src/templates/demo'
import { deserializeCard, serializeCard } from './src/model/serialize'
import { useTilt } from './src/view/useTilt'
import { TiltCard } from './src/view/TiltCard'

// M0/M1 checkpoint app: load a hand-written template through the JSON
// round-trip, render it with the pure CardRenderer, drive it with tilt.
export default function App() {
  const { width } = useWindowDimensions()
  const { view, panHandlers } = useTilt()

  // Round-trip on load so a serialization bug is impossible to miss.
  const doc = useMemo(() => deserializeCard(serializeCard(demoCard())), [])

  const cardWidth = Math.min(width - 48, 380)

  return (
    <View style={styles.root} {...panHandlers}>
      <StatusBar style="light" />
      <TiltCard doc={doc} view={view} width={cardWidth} />
      <View style={styles.controls}>
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
    gap: 8,
  },
  hint: { color: '#5a6478', fontSize: 12 },
})
