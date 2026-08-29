import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { demoCard } from './src/templates/demo'
import { deserializeCard, serializeCard } from './src/model/serialize'
import { useTilt } from './src/view/useTilt'
import { TiltCard } from './src/view/TiltCard'

// M0/M1 checkpoint app: load a hand-written template through the JSON
// round-trip, render it with the pure CardRenderer, drive it with tilt.
export default function App() {
  const { width } = useWindowDimensions()
  const { view, mode, setMode, panHandlers } = useTilt('gyro')

  // Round-trip on load so a serialization bug is impossible to miss.
  const doc = useMemo(() => deserializeCard(serializeCard(demoCard())), [])

  const cardWidth = Math.min(width - 48, 380)

  return (
    <View style={styles.root} {...panHandlers}>
      <StatusBar style="light" />
      <TiltCard doc={doc} view={view} width={cardWidth} />
      <View style={styles.controls}>
        <Pressable
          style={styles.button}
          onPress={() => setMode(mode === 'gyro' ? 'drag' : 'gyro')}
        >
          <Text style={styles.buttonText}>
            {mode === 'gyro' ? 'Tilt: gyroscope (tap for drag)' : 'Tilt: drag (tap for gyro)'}
          </Text>
        </Pressable>
        <Text style={styles.hint}>Tap the card to flip</Text>
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
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1c2233',
  },
  buttonText: { color: '#c9d6ea', fontSize: 14 },
  hint: { color: '#5a6478', fontSize: 12 },
})
