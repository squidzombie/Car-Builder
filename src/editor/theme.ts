import {
  StyleSheet,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

// Design tokens (memory: ui-design-bar, ui-visual-first). One system
// everywhere: a neutral charcoal ramp for every surface, and blue reserved
// for one job — "this is selected". Depth comes from a lit-from-above
// bevel on interactive controls (raised at rest, sunk while pressed), not
// from decoration. Dense UI, quiet chrome, 44pt touch targets.

export const color = {
  bg0: '#151517', // screen ground — light charcoal, never pure black
  bgBar: '#19191c', // tool/props bars — between ground and panel
  bg1: '#1d1d20', // panels and sheets
  bg2: '#27272b', // elevated surfaces (menus, popovers, picker panels)
  track: '#141416', // recessed track (segmented control, slider well)
  chip: '#2b2b30', // interactive control on a panel
  chipGlass: '#2b2b30ee', // control floating over the canvas
  chipOnElevated: '#34343a', // interactive control on an elevated surface
  chipActive: '#3b3b41', // selected / open control: raised neutral fill
  rowSelected: '#252529', // selected list row
  accent: '#4da3ff', // ONLY for selected-state marks and the primary CTA
  onAccent: '#0c0c0e', // text on an accent-filled control
  hairline: '#2d2d32',
  hairlineBright: '#424248',
  text: '#f2f2f4',
  textMid: '#cfcfd4',
  textDim: '#8f8f97',
  textFaint: '#67676e',
  textGhost: '#4b4b51',
  glyph: '#c5c5cc', // shape/icon glyph fill
  warn: '#ffd166',
  danger: '#e0646f',
  swatchBack: '#e8e8e8',
  /** top-edge light catch on raised controls */
  bevelLight: 'rgba(255,255,255,0.07)',
  /** bottom-edge shade under raised controls */
  bevelShade: 'rgba(0,0,0,0.42)',
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

/**
 * Raised control: a lit top edge and a shaded bottom edge. Shadows are
 * invisible on dark surfaces, so depth is carried by the bevel instead.
 * Mix into any button-like style; `pressed()` sinks it while touched.
 */
export const raised: ViewStyle = {
  borderWidth: 1,
  borderTopColor: color.bevelLight,
  borderLeftColor: 'rgba(255,255,255,0.03)',
  borderRightColor: 'rgba(0,0,0,0.18)',
  borderBottomColor: color.bevelShade,
}

const sunk: ViewStyle = {
  borderTopColor: 'rgba(0,0,0,0.38)',
  borderLeftColor: 'rgba(0,0,0,0.16)',
  borderRightColor: 'rgba(255,255,255,0.02)',
  borderBottomColor: 'rgba(255,255,255,0.05)',
  transform: [{ translateY: 1 }],
  opacity: 0.9,
}

export const chip: ViewStyle = {
  minHeight: 36,
  paddingHorizontal: 14,
  borderRadius: radius.sm,
  backgroundColor: color.chip,
  alignItems: 'center',
  justifyContent: 'center',
  ...raised,
}

/** Selected chip: raised neutral fill; the accent goes on the label. */
export const chipActive: ViewStyle = {
  backgroundColor: color.chipActive,
}

export const chipText: TextStyle = { color: color.textDim, fontSize: type.md }
export const chipTextActive: TextStyle = { color: color.accent, fontWeight: '600' }

/**
 * Pressed-state feedback for Pressable `style` props: a raised control
 * sinks (bevel inverts, 1px drop); anything else just dims slightly.
 * Usage: style={pressed(styles.button, isActive && styles.buttonActive)}
 */
export const pressed =
  (...styles: StyleProp<ViewStyle>[]) =>
  (state: PressableStateCallbackType): StyleProp<ViewStyle> =>
    [...styles, state.pressed && sunk]
