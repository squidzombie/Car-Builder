# Card Builder

A mobile app for designing custom trading cards and viewing them with a realistic, tilt-reactive holographic finish. (Yes, the repo is named Car-Builder — it's cards.)

The full spec — scope, data model, finish system, build order — lives in [CLAUDE.md](./CLAUDE.md).

## Status

M0/M1 checkpoint: data model, pure `CardRenderer` with all six layer types, all five finish families as SkSL shaders, gyro + drag tilt, flip, and a hand-written demo template that exercises everything. Needs verification on a real phone (CLAUDE.md §11).

## Run it

```sh
npm install
npx expo start
```

Scan the QR code with Expo Go (or run a dev build — Skia requires a dev build on some setups; if Expo Go fails, run `npx expo run:android` / `run:ios`).

Tilt the phone to move the holo. Tap the card to flip. The button toggles gyro/drag input.

## Checks

```sh
npm run typecheck   # tsc --noEmit
npm test            # model round-trip tests + SkSL compilation through CanvasKit
```

## Layout

```
src/model/      CardDocument types, JSON serialize/validate, shape library, colors
src/finishes/   SkSL per family (*.sksl.ts) + presets + uniform builder
src/renderer/   CardRenderer (pure: CardDocument + ViewState → pixels)
src/view/       useTilt (gyro/drag), TiltCard 3D preview
src/templates/  blank + demo (hand-written M1 template)
```

Shader sources are embedded in `*.sksl.ts` files (Metro can't import raw `.sksl` without a custom transformer); the `.sksl` infix marks them as the shader files CLAUDE.md §12 refers to.
