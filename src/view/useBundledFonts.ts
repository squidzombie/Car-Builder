import { useFonts } from 'expo-font'
import { useTypeface } from '@shopify/react-native-skia'
import { Anton_400Regular } from '@expo-google-fonts/anton'
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue'
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker'
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico'
import { Audiowide_400Regular } from '@expo-google-fonts/audiowide'
import { registerTypeface } from '../renderer/fonts'

/**
 * Load the bundled display typefaces into the renderer's font registry.
 * Call once near the app root; the return value changes as faces finish
 * decoding so callers re-render and text layers pick the real face up.
 * The same faces are also registered with expo-font so React Native
 * <Text> can use them (FONT_CHOICES[].family) for in-face font pills.
 */
export function useBundledFonts(): number {
  useFonts({
    Anton_400Regular,
    BebasNeue_400Regular,
    PermanentMarker_400Regular,
    Pacifico_400Regular,
    Audiowide_400Regular,
  })
  const anton = useTypeface(Anton_400Regular)
  const bebas = useTypeface(BebasNeue_400Regular)
  const marker = useTypeface(PermanentMarker_400Regular)
  const pacifico = useTypeface(Pacifico_400Regular)
  const audiowide = useTypeface(Audiowide_400Regular)

  registerTypeface('anton', anton)
  registerTypeface('bebas', bebas)
  registerTypeface('marker', marker)
  registerTypeface('pacifico', pacifico)
  registerTypeface('audiowide', audiowide)

  return [anton, bebas, marker, pacifico, audiowide].filter(Boolean).length
}
