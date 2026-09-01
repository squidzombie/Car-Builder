import { Platform } from 'react-native'

// On web, CanvasKit (Skia's wasm build) must finish loading before any
// module that imports @shopify/react-native-skia is evaluated — so the
// app is required lazily behind LoadSkiaWeb. Native loads directly.
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web')
  LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' }).then(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerRootComponent } = require('expo')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    registerRootComponent(require('./App').default)
  })
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerRootComponent } = require('expo')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  registerRootComponent(require('./App').default)
}
