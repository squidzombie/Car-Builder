import { Platform } from 'react-native'

// JS side of modules/video-export (iOS builds only — Expo Go and Android
// have no native code for it; `videoExportAvailable()` gates the UI).

type VideoExportModule = {
  isAvailable: boolean
  begin(width: number, height: number, fps: number): Promise<void>
  appendFrame(jpegBase64: string): Promise<void>
  finish(): Promise<string>
  cancel(): Promise<void>
}

let mod: VideoExportModule | null = null
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('expo-modules-core').requireNativeModule('VideoExport')
  } catch {
    mod = null
  }
}

export function videoExportAvailable(): boolean {
  return mod?.isAvailable === true
}

export const videoExport = {
  begin: (w: number, h: number, fps: number) => mod!.begin(w, h, fps),
  appendFrame: (b64: string) => mod!.appendFrame(b64),
  finish: () => mod!.finish(),
  cancel: () => (mod ? mod.cancel() : Promise.resolve()),
}
