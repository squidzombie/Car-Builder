import {
  StyleSheet,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

// Design tokens (Build 3, memory: ui-design-bar). One system everywhere:
// three background planes, one accent, hierarchy from surface + type —
// not decoration. Dense UI, quiet chrome, 44pt touch targets.

export const color = {
  bg0: '#08090f', // screen ground
  bgBar: '#0d1120', // tool/props bars — between ground and panel
  bg1: '#10141f', // panels and sheets
  bg2: '#1a2136', // elevated surfaces (menus, popovers, tiles)
  track: '#12162a', // segmented-control track
  chip: '#1c2233', // interactive chip on a panel
  chipGlass: '#1c2233ee', // chip floating over the canvas
  chipOnElevated: '#242e4d', // interactive chip on an elevated surface
  chipActive: '#2a3554',
  rowSelected: '#18203a', // selected list row
  accent: '#4da3ff',
  onAccent: '#0b0e19', // text on an accent-filled control
  hairline: '#232b42',
  hairlineBright: '#3d4a6e',
  text: '#e6ecf7',
  textMid: '#c9d6ea',
  textDim: '#7f8db0',
  textFaint: '#5a6478',
  textGhost: '#3d4560',
  glyph: '#aeb9d0', // shape/icon glyph fill
  warn: '#ffd166',
  danger: '#c76a72',
  swatchBack: '#e8e8e8',
}

export const type = {
  /** captions, hints */ xs: 11,
  /** labels */ sm: 12,
  /** chips, secondary */ md: 13,
  /** body, buttons */ base: 14,
  /** sheet titles */ lg: 15,
} as const

export const radius = { sm: 8, md: 10, lg: 12, xl: 20 } as const

/** The one elevation recipe for transient surfaces. */
export const elevated: ViewStyle = {
  backgroundColor: color.bg2,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: color.hairlineBright,
  shadowColor: '#000000',
  shadowOpacity: 0.45,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
}

export const chip: ViewStyle = {
  minHeight: 36,
  paddingHorizontal: 14,
  borderRadius: radius.sm,
  backgroundColor: color.chip,
  alignItems: 'center',
  justifyContent: 'center',
}

export const chipActive: ViewStyle = {
  backgroundColor: color.chipActive,
  borderWidth: 1,
  borderColor: color.accent,
}

export const chipText: TextStyle = { color: color.textDim, fontSize: type.md }
export const chipTextActive: TextStyle = { color: color.text }

/**
 * Pressed-state feedback for Pressable `style` props: dims while touched.
 * Usage: style={pressed(styles.button, isActive && styles.buttonActive)}
 */
export const pressed =
  (...styles: StyleProp<ViewStyle>[]) =>
  (state: PressableStateCallbackType): StyleProp<ViewStyle> =>
    [...styles, state.pressed && { opacity: 0.55 }]
