import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

// Small haptic vocabulary: a featherweight selection click on press-in for
// buttons, one light tick for selections and snaps, a medium thump for
// the card flip. Silent on web; every call is fire-and-forget so a
// missing engine never breaks a gesture.

const canBuzz = Platform.OS === 'ios' || Platform.OS === 'android'

/** Lightest click there is — for press-in on ordinary controls. */
export const press = () => {
  if (canBuzz) Haptics.selectionAsync().catch(() => {})
}

export const tick = () => {
  if (canBuzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

export const thump = () => {
  if (canBuzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}

/** Spread onto a Pressable: `<Pressable {...pressHaptic} …>` */
export const pressHaptic = { onPressIn: press }
