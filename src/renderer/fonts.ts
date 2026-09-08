import type { SkTypeface } from '@shopify/react-native-skia'

// Bundled display fonts (CLAUDE.md §4): condensed sports, script, chrome.
// Typefaces are loaded once at app start (view/useBundledFonts) into this
// registry; CardRenderer reads it synchronously and falls back to the
// system font until a face is ready. Layer.text.font stores the key.
// `family` is the same face as registered with expo-font, so UI chrome
// (the Text sheet's font pills) can show each choice in its own face.

export const FONT_CHOICES: { key: string; label: string; family?: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'anton', label: 'Anton', family: 'Anton_400Regular' },
  { key: 'bebas', label: 'Bebas', family: 'BebasNeue_400Regular' },
  { key: 'marker', label: 'Marker', family: 'PermanentMarker_400Regular' },
  { key: 'pacifico', label: 'Script', family: 'Pacifico_400Regular' },
  { key: 'audiowide', label: 'Chrome', family: 'Audiowide_400Regular' },
]

const registry = new Map<string, SkTypeface>()

export function registerTypeface(key: string, tf: SkTypeface | null | undefined): void {
  if (tf) registry.set(key, tf)
}

export function getTypeface(key: string): SkTypeface | undefined {
  return registry.get(key)
}
