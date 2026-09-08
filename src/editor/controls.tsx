import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import {
  color,
  panel,
  pill,
  pillActive,
  pillText,
  pillTextActive,
  pressed,
  radius,
  space,
  type,
} from './theme'
import { pressHaptic } from '../view/haptics'

// Shared controls for the M7 visual pass. These encode the approved
// FX-picker language once so every sheet and bar reads the same:
//   Segmented - a recessed track holding soft pills (modes, tabs, sides)
//   Panel     - the one-surface container for an option group
//   Pill      - an option on a panel: quiet at rest, filled when chosen
//   Tile      - a live preview with an accent ring and a tiny caption
//   StatusDot - the "this layer has one" mark, replacing text bullets

export type FeatherName = React.ComponentProps<typeof Feather>['name']

type SegItem<T extends string> = {
  key: T
  label?: string
  icon?: FeatherName
  /** custom content; receives the active state */
  render?: (active: boolean) => React.ReactNode
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  stretch,
  vertical,
  compact,
  style,
}: {
  items: SegItem<T>[]
  value: T
  onChange: (key: T) => void
  /** fill the row, equal widths (sheet tabs) */
  stretch?: boolean
  vertical?: boolean
  /** shorter pills for bars */
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        styles.track,
        vertical && styles.trackVertical,
        stretch ? styles.trackStretch : styles.trackHug,
        style,
      ]}
    >
      {items.map((it) => {
        const active = it.key === value
        return (
          <Pressable
            {...pressHaptic}
            key={it.key}
            style={pressed(
              styles.segment,
              compact && styles.segmentCompact,
              stretch && styles.segmentStretch,
              active && styles.segmentActive,
            )}
            onPress={() => onChange(it.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={it.label}
          >
            {it.render ? (
              it.render(active)
            ) : (
              <View style={styles.segmentInner}>
                {it.icon ? (
                  <Feather name={it.icon} size={15} color={active ? color.accent : color.textDim} />
                ) : null}
                {it.label ? (
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {it.label}
                  </Text>
                ) : null}
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

export function Panel({
  children,
  style,
  padded,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** inner padding for free-form content */
  padded?: boolean
}) {
  return <View style={[styles.panel, padded && styles.panelPadded, style]}>{children}</View>
}

/** A row of pills inside a Panel; `scroll` for strips longer than the sheet. */
export function PillRow({
  children,
  scroll,
  style,
}: {
  children: React.ReactNode
  scroll?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const row = <View style={[styles.pillRow, style]}>{children}</View>
  if (!scroll) return row
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {row}
    </ScrollView>
  )
}

export function Pill({
  label,
  icon,
  active,
  danger,
  disabled,
  onPress,
  children,
  style,
  accessibilityLabel,
}: {
  label?: string
  icon?: FeatherName
  active?: boolean
  danger?: boolean
  disabled?: boolean
  onPress?: () => void
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const fg = danger ? color.danger : active ? color.accent : color.textDim
  return (
    <Pressable
      {...pressHaptic}
      style={pressed(styles.pill, active && styles.pillActive, disabled && styles.pillDisabled, style)}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active === true, disabled: disabled === true }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View style={styles.pillInner}>
        {icon ? <Feather name={icon} size={15} color={fg} /> : null}
        {children}
        {label ? (
          <Text
            style={[styles.pillText, active && styles.pillTextActive, danger && styles.pillTextDanger]}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

/** Thin vertical separator between pill groups on one strip. */
export function PillDivider() {
  return <View style={styles.pillDivider} />
}

/** A row of Tiles; `scroll` for long preset strips. */
export function TileRow({
  children,
  scroll,
  style,
}: {
  children: React.ReactNode
  scroll?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const row = <View style={[styles.tileRow, style]}>{children}</View>
  if (!scroll) return row
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {row}
    </ScrollView>
  )
}

export const TILE = 54

export function Tile({
  active,
  onPress,
  caption,
  width = TILE,
  height = TILE,
  children,
  accessibilityLabel,
}: {
  active?: boolean
  onPress?: () => void
  caption?: string
  width?: number
  height?: number
  /** the preview itself, sized width x height */
  children: React.ReactNode
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      {...pressHaptic}
      style={pressed(styles.tile, { width: width + 10 })}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active === true }}
      accessibilityLabel={accessibilityLabel ?? caption}
    >
      <View style={[styles.tileRing, active && styles.tileRingActive]}>
        <View style={{ width, height, backgroundColor: color.bg0 }}>{children}</View>
      </View>
      {caption ? (
        <Text style={[styles.tileCaption, active && styles.tileCaptionActive]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  )
}

export function StatusDot() {
  return <View style={styles.statusDot} />
}

/** Quiet centered hint under a control group. */
export function Hint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: color.track,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  trackVertical: { flexDirection: 'column' },
  trackStretch: { alignSelf: 'stretch' },
  trackHug: { alignSelf: 'center' },
  segment: {
    minHeight: 34,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCompact: { minHeight: 30, paddingHorizontal: 14 },
  segmentStretch: { flex: 1 },
  segmentActive: pillActive,
  segmentInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentText: pillText,
  segmentTextActive: pillTextActive,
  panel,
  panelPadded: { padding: space.md },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  pill,
  pillActive,
  pillDisabled: { opacity: 0.35 },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillText,
  pillTextActive,
  pillTextDanger: { color: color.danger },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    marginHorizontal: space.xs,
    backgroundColor: color.hairlineBright,
  },
  tileRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  tile: { alignItems: 'center', gap: 4 },
  tileRing: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileRingActive: { borderColor: color.accent },
  tileCaption: { color: color.textDim, fontSize: type.xs },
  tileCaptionActive: { color: color.text, fontWeight: '600' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.accent },
  hint: { color: color.textGhost, fontSize: type.sm, textAlign: 'center', paddingVertical: space.sm },
})
