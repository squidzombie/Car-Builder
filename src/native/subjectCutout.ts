import { Platform } from 'react-native'

// JS side of modules/subject-cutout. The native module exists only in
// dev/TestFlight iOS builds (Expo Go and Android have no native code for
// it), so everything is guarded: `cutoutAvailable()` gates the UI and
// `liftSubject` resolves null on any failure.

type SubjectCutoutModule = {
  isAvailable: boolean
  liftSubject(uri: string): Promise<string | null>
}

let mod: SubjectCutoutModule | null = null
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('expo-modules-core').requireNativeModule('SubjectCutout')
  } catch {
    mod = null // Expo Go / module not in this build
  }
}

/** True when this build can lift subjects (iOS 17+ dev/store build). */
export function cutoutAvailable(): boolean {
  return mod?.isAvailable === true
}

/**
 * Lift the foreground subject out of the image at `uri`. Resolves a new
 * PNG file URI (same dimensions, transparent background), or null when
 * no subject was found or the platform can't do it.
 */
export async function liftSubject(uri: string): Promise<string | null> {
  if (!mod) return null
  try {
    return await mod.liftSubject(uri)
  } catch {
    return null
  }
}
