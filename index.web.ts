// Web entry (Metro resolves .web.ts on web only, keeping canvaskit-wasm
// out of the native bundle). CanvasKit must finish loading before any
// module that imports @shopify/react-native-skia is evaluated — so the
// app is required lazily behind LoadSkiaWeb.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web')
LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' }).then(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerRootComponent } = require('expo')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  registerRootComponent(require('./App').default)
})

export {}
