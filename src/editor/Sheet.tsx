import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { color, radius, type } from './theme'

// The one bottom-sheet container (Build 3): grab handle, title row, Done,
// consistent padding/elevation. `backdrop` dims and closes on tap — use it
// for modal choices; leave it off when the card above should stay visible
// and interactive (mask/text/finish editors).

type Props = {
  title: string
  onClose: () => void
  closeLabel?: string
  backdrop?: boolean
  children: React.ReactNode
  /** optional extra header control rendered before the close button */
  headerRight?: React.ReactNode
}

export function Sheet({ title, onClose, closeLabel = 'Done', backdrop, children, headerRight }: Props) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {backdrop ? <Pressable style={styles.backdrop} onPress={onClose} /> : null}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerActions}>
            {headerRight}
            <Pressable style={styles.doneButton} hitSlop={8} onPress={onClose}>
              <Text style={styles.doneText}>{closeLabel}</Text>
            </Pressable>
          </View>
        </View>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#000000aa',
  },
  sheet: {
    backgroundColor: color.bg1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairlineBright,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.hairlineBright,
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: color.text, fontSize: type.lg, fontWeight: '600', flexShrink: 1 },
  doneButton: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: color.chipActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: color.text, fontSize: type.base, fontWeight: '600' },
})
