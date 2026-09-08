import React, { useEffect, useRef } from 'react'
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { color, pressed, radius, raised, type } from './theme'
import { pressHaptic } from '../view/haptics'

// The one bottom-sheet container (Build 3): grab handle, title row, Done,
// consistent padding/elevation. `backdrop` dims and closes on tap — use it
// for modal choices; leave it off when the card above should stay visible
// and interactive (mask/text/finish editors). `onFrame` reports where the
// sheet sits on screen (and null on close) so the editor can keep the
// layer being edited visible above it.

export type SheetFrame = { top: number; height: number }

type Props = {
  title: string
  onClose: () => void
  closeLabel?: string
  backdrop?: boolean
  children: React.ReactNode
  /** optional extra header control rendered before the close button */
  headerRight?: React.ReactNode
  onFrame?: (frame: SheetFrame | null) => void
}

export function Sheet({
  title,
  onClose,
  closeLabel = 'Done',
  backdrop,
  children,
  headerRight,
  onFrame,
}: Props) {
  // entrance: sheet slides up a touch while backdrop and content fade in
  const enter = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [enter])
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] })

  // Android hardware back closes the sheet, not the app
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  // where the sheet sits: measured on layout and again after the keyboard
  // moves it (the keyboard-avoiding padding shifts the sheet, not its size)
  const sheetRef = useRef<View>(null)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame
  const measure = () => {
    if (!onFrameRef.current) return
    sheetRef.current?.measureInWindow((_x, y, _w, h) => {
      onFrameRef.current?.({ top: y, height: h })
    })
  }
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setTimeout(measure, 60))
    const hide = Keyboard.addListener('keyboardDidHide', () => setTimeout(measure, 60))
    return () => {
      show.remove()
      hide.remove()
      onFrameRef.current?.(null)
    }
  }, [])

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {backdrop ? (
        <Animated.View style={[styles.backdrop, { opacity: enter }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
      ) : null}
      {/* keep the sheet's inputs above the keyboard — needed on both
          platforms: edge-to-edge Android doesn't resize the window either */}
      <KeyboardAvoidingView behavior="padding" pointerEvents="box-none">
        <Animated.View
          ref={sheetRef}
          onLayout={measure}
          style={[styles.sheet, { opacity: enter, transform: [{ translateY }] }]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.headerActions}>
              {headerRight}
              <Pressable {...pressHaptic} style={pressed(styles.doneButton)} hitSlop={8} onPress={onClose}>
                <Text style={styles.doneText}>{closeLabel}</Text>
              </Pressable>
            </View>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
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
    paddingTop: 10,
    paddingBottom: 34,
    paddingHorizontal: 16,
    gap: 14,
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
    backgroundColor: color.chip,
    ...raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: color.text, fontSize: type.base, fontWeight: '600' },
})
