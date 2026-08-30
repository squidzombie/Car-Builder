# Handoff — state of the project as of 2026-08-30

Context for Claude Code (or any developer) picking this up locally. The spec
in `CLAUDE.md` is the source of truth for scope and build order; this file is
where the build actually stands.

## Where we are

**M0/M1 are code-complete but NOT yet verified on a real phone.** Per
CLAUDE.md §11, the milestone isn't done until it runs on a device and the
holo feels right. That device test is the immediate next step — do not start
M2 (editor core) until it has happened.

Everything below was built in a cloud session and pushed to
`claude/car-builder-handoff-zae22z` (two commits on top of the initial one).
`main` is still empty except the original README — merge when the device
checkpoint passes.

## What exists

- **Expo SDK 57 + TypeScript** scaffold. Deps pinned to Expo-compatible
  versions (`@shopify/react-native-skia` 2.6.2, `expo-sensors`,
  `react-native-reanimated` 4.5.1, `react-native-gesture-handler`,
  `react-native-worklets`, `zustand`, `immer`).
- `src/model/` — full `CardDocument`/`Layer`/`Finish`/`ViewState` types
  (CLAUDE.md §3/§5), `serialize.ts` with a validating deserializer
  (`CardParseError`), `shapes.ts` with all 14 built-in shapes as normalized
  SVG paths plus `buildPolygonPath` (the §4 polygon builder), `color.ts`.
- `src/finishes/` — SkSL for all five families in `*.sksl.ts` files
  (spectrum, geometric, fluid, metallic, sparkle), shared helpers in
  `common.sksl.ts` (palette band, specular, grain, noise), `presets.ts`
  (every preset from the §5 table; params map to uniforms uP0..uP3,
  documented at the top of each family file), `uniforms.ts` (pure uniform
  builder, no Skia import), `index.ts` (effect compile + cache).
- `src/renderer/CardRenderer.tsx` — pure function of doc + ViewState. All
  six layer types; per-layer finish drawn `srcATop` inside an offscreen
  layer group so it lands only on the layer's alpha; linear/radial/shape/
  raster masks via `dstIn`; gradients; Catmull-Rom stroke smoothing in
  `strokePath.ts`.
- `src/view/useTilt.ts` — DeviceMotion-based gyro tilt with dead zone,
  smoothing, and auto-baselining to the initial phone pose; drag fallback
  via PanResponder; mode toggle. `TiltCard.tsx` — perspective tilt,
  tap-to-flip (RN Animated spring), tilt-reactive shadow.
- `src/templates/` — `blank.ts` and `demo.ts`. The demo card exercises all
  six layer types and all five bold finishes front and back, and `App.tsx`
  loads it through serialize→deserialize on purpose.

## Verified (in the cloud, not on device)

- `npm run typecheck` (tsc --noEmit) clean.
- `npm test` — 12 tests: JSON round-trip identity for blank + demo,
  malformed-document rejection, shape-library invariants, and **all five
  SkSL shaders compiled through real Skia** (CanvasKit in a node jest env).

## Immediate next step: device test (Windows host)

1. `npx expo start` and open in **Expo Go** on the phone (same Wi-Fi).
   Skia and expo-sensors are both bundled in Expo Go for SDK 57, so this
   should work. If the LAN connection fails (Windows firewall), try
   `npx expo start --tunnel`.
2. If Expo Go crashes or renders a blank card: Android dev build
   (`npx expo run:android`, needs Android Studio). iOS dev builds need a
   Mac — use Expo Go or EAS Build for iPhone.
3. Judge the M0 question: does the refractor/holo feel real when tilting?
   Quality bar is simeydotme's "pokemon cards css" demo (§5). Tuning knobs:
   preset params in `src/finishes/presets.ts`, shared look (specular shape,
   grain level, palette sweep) in `src/finishes/common.sksl.ts`, gyro feel
   (dead zone, smoothing, range) at the top of `src/view/useTilt.ts`.

## Known deviations / notes

- Shader sources are `*.sksl.ts` (exported template strings), not raw
  `.sksl` — Metro can't import raw text without a custom transformer. The
  `.sksl` infix marks them as the shader files §12 means. Screenshot
  requirement of §12 (docs/finishes/ at three tilts) is still unmet.
- `expo install` was blocked by the cloud proxy; versions were taken from
  `expo/bundledNativeModules.json`. On a normal network `npx expo install`
  works fine for future deps.
- Tilt updates flow through React state (~30Hz setState). Fine for the
  checkpoint; if it stutters on device, the §5 perf bar (60fps mid-range
  Android) likely means moving ViewState onto Reanimated shared values /
  Skia uniforms without re-render. Don't optimize before it's proven
  necessary on device.
- Text layers use system fonts via `matchFont` (bold). Bundled display
  fonts (§4) are still to do (M3).
- `npm audit` reports ~10 moderate vulns in transitive dev/build deps —
  known Expo-ecosystem noise. Do NOT run `npm audit fix --force`; it will
  break pinned native-module versions.
- Palette lookups in SkSL use a constant-index loop instead of dynamic
  array indexing on purpose (GLES2 device compatibility).

## After the device checkpoint

1. Fix whatever the phone reveals; tune shaders until the M0 answer is yes.
2. Take the §12 screenshots for `docs/finishes/`.
3. Merge to `main` (PR from this branch).
4. Start M2: layer panel, selection + transform gestures, undo/redo command
   stack (zustand + immer are already installed), color picker with
   pins/recents/eyedropper.
