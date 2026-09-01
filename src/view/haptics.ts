import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

// Small haptic vocabulary (design pass): one light tick for selections
// and snaps, a medium thump for the card flip. Silent on web; every call
// is fire-and-forget so a missing engine never breaks a gesture.

const canBuzz = Platform.OS === 'ios' || Platform.OS === 'android'

export const tick = () => {
  if (canBuzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

export const thump = () => {
  if (canBuzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}
