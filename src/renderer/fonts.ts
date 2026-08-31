import type { SkTypeface } from '@shopify/react-native-skia'

// Bundled display fonts (CLAUDE.md §4): condensed sports, script, chrome.
// Typefaces are loaded once at app start (view/useBundledFonts) into this
// registry; CardRenderer reads it synchronously and falls back to the
// system font until a face is ready. Layer.text.font stores the key.

export const FONT_CHOICES: { key: string; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'anton', label: 'Anton' },
  { key: 'bebas', label: 'Bebas' },
  { key: 'marker', label: 'Marker' },
  { key: 'pacifico', label: 'Script' },
  { key: 'audiowide', label: 'Chrome' },
]

const registry = new Map<string, SkTypeface>()

export function registerTypeface(key: string, tf: SkTypeface | null | undefined): void {
  if (tf) registry.set(key, tf)
}

export function getTypeface(key: string): SkTypeface | undefined {
  return registry.get(key)
}
