# Handoff — state of the project as of 2026-08-31

Context for Claude Code (or any developer) picking this up locally. The spec
in `CLAUDE.md` is the source of truth for scope and build order; this file is
where the build actually stands.

## Where we are

**M0/M1 are DONE and device-verified.** The M0 checkpoint passed on the
user's iPhone (2026-08-30): holo quality approved. The device test produced
two fixes (drag-to-tilt coexists with gyro, back-face light mirroring) —
committed in `acd8c1e`.

**M2 (editor core) is in progress.** Working so far, all on branch
`claude/car-builder-handoff-zae22z`:

- Editor store (`src/state/editorStore.ts`): zustand+immer, snapshot
  undo/redo (50 deep), gesture grouping (a whole drag = one undo step),
  layer commands, palette pin/recent actions.
- Editor screen (`src/editor/EditorScreen.tsx`): tap-to-select (hit-test in
  `src/editor/bounds.ts`), one-finger drag-to-move, **two-finger
  pinch-to-scale + twist-to-rotate** (pure math in
  `src/editor/transformGesture.ts` — anchor-follows-midpoint model, scale
  clamped 0.05..20), undo/redo, front/back switch, selection props bar
  (name, rotation/scale readout, color chip).
- Layer panel (`src/editor/LayerPanel.tsx`): select/reorder/rename/lock/
  hide/duplicate/delete, add fill/shape layers.
- **Color picker** (`src/editor/ColorPicker.tsx`, §6): hue ring +
  SV square (Skia-drawn), alpha slider, hex input, pinned swatches
  (long-press recent → pin, long-press pin → unpin), recents (pushed on
  picker close when the color changed), **eyedropper** (samples real canvas
  pixels via `makeImageSnapshot` of a 1×1 rect). Picker edits the layer's
  "primary color" (`src/editor/layerColor.ts`); applying a solid replaces a
  gradient paint — gradient editing is a later slice.

## Verified

- `npm run typecheck` clean; `npm test` 41/41 (jest-expo, includes real
  SkSL compilation through CanvasKit).
- Preview and editor share one store; edits appear live in the tilt preview.
- **Verified on the Android emulator (Pixel_7, Expo Go)**, including the
  two-finger pinch+twist via a sendevent multitouch script
  (`adb root` + type-B events on `/dev/input/event2`): select, drag,
  pinch/rotate (props bar readout matches), color picker end to end
  (wheel, alpha, hex, pin, recents-on-close, eyedropper sampling real
  canvas pixels), full undo chain back to pristine.
- Emulator findings fixed along the way: SweepGradient on a stroked circle
  renders unreliably (ring is now 72 solid arc segments), and the editor
  card is now fitted to the measured canvas-area height (it used to
  overflow on top of the toolbar and steal its taps).

## Still open in M2

- Drag-reorder of pinned swatches (§6 says drag; long-press flows exist).
- Starter palettes (~30 team-color sets) — data-only, §6.
- Canvas hit-testing is AABB-based, so a full-card frame shape (demo "Foil
  border") shadows every canvas tap; layer-panel selection is the
  workaround. Consider path-accurate hit testing for shape layers.
- Possible polish: rotation snap at 0/90/180/270 during twist.
- `SkPath.*` deprecation warnings from react-native-skia 2.6 (strokePath,
  renderer, shapes): migrate to `Skia.PathBuilder` in a maintenance pass.

## User priorities to keep in mind

- The user is excited about finish presets + custom color palettes feeding
  the holo effects ("select a set number of colors for a holo effect").
  The engine already supports it (`Finish.paletteMode: 'custom'` +
  `customColors`, renderer falls back to pinned palette) — make sure the
  M4 finish UI exposes palette choice prominently, and §6 starter palettes
  land with it.

## After M2

- §12 screenshots for `docs/finishes/` at tilts (0,0), (1,0), (0,1) — still
  unmet from M1.
- Merge to `main` (PR from this branch) — was gated on the device
  checkpoint, which has now passed.
- M3: photo import + cutout + fade masks, free draw, stamping, mirror
  symmetry, custom polygon builder, text editing UI.

## Environment notes

- Windows host. Android emulator available: AVD `Pixel_7`
  (`%LOCALAPPDATA%/Android/Sdk` — adb/emulator NOT on the bash PATH, use
  full paths). User's iPhone runs sideloaded Expo Go (see memory notes).
- `npx expo start --tunnel` works around Windows firewall for phone tests;
  `@expo/ngrok` is a devDependency.
- Do NOT run `npm audit fix --force` (breaks pinned native-module versions).
- Tilt updates flow through React state (~30Hz). Fine so far; §5 perf bar
  (60fps mid-range Android) may eventually need shared values / direct
  uniforms. Don't optimize before it's proven necessary on device.
- Text layers use system fonts via `matchFont`; bundled display fonts (§4)
  are M3.
