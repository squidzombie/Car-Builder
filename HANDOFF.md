# Handoff — state of the project as of 2026-08-31 (evening: M3 nearly done)

## M3 status (content tools, CLAUDE.md §4) — built and emulator-verified

- **Draw**: ToolBar modes Select/Draw/Stamp; width presets, brush color
  (picker + eyedropper retarget to the tool), Catmull-Rom strokes, dot on
  tap, stroke-level eraser. Strokes accumulate into the selected drawing
  when the style matches; otherwise a new path layer is created. Model
  change: `path.strokes[]` — a session's strokes share one layer + style.
- **Stamp**: shape strip (14 builtins + doc customs, Skia glyph previews),
  S/M/L, fixed/random/follow rotation, jitter, spacing on drag.
- **Mirror symmetry** off/H/V/both for draw AND stamp, applied at input
  time (real content). Two fingers in tool modes always zoom/pan; a stroke
  in flight cancels via undo (tool gesture = one history entry).
- **ShapeBuilder** (§4 polygon builder): sides 3–24, star inset, corner
  rounding, live preview → saved into `CardDocument.shapes` (travels with
  the card), auto-selected for stamping.
- **Photo import**: expo-image-picker → in-memory asset registry
  (`src/model/assets.ts`, id→uri) → `useDocImages` decodes SkImages with a
  session cache; preview + editor both pass `assets` to CardRenderer.
- **Fade masks** (MaskEditor sheet): none/linear/radial, angle + fade
  start + softness sliders, live preview, slider drag = one undo step.
- **Text editing** (TextEditor sheet): content, size slider, alignment.
- Shared MiniSlider component (`src/editor/MiniSlider.tsx`).

## M3 remaining / deferred

- **Subject cutout** (§4) requires native modules (iOS Vision / ML Kit) —
  impossible in Expo Go; needs a dev build. Deferred; fade masks cover the
  classic look meanwhile. `image.cutout` field already exists in the model.
- Bundled display fonts (§4) — still system fonts via matchFont.
- Asset persistence: registry is in-memory; picked-photo URIs live in the
  picker cache. Durable copies land with M6 local save (expo-file-system).
- Eraser only erases the SELECTED drawing (by design for now).

---

# Earlier handoff notes (2026-08-31 daytime)

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

## Second M2 slice (2026-08-31, afternoon)

All emulator-verified unless noted:

- **Path-accurate hit testing** (`bounds.ts` + `shapeHit.ts`): shape hits
  refined by Skia `path.contains` (injected, bounds.ts stays pure);
  transparent-fill shapes (border frames) hit only near their outline;
  stamps hit per instance; paths hit near the stroke; taps outside the
  card hit nothing (reliable deselect). The demo "Foil border" no longer
  shadows the canvas.
- **Canvas zoom/pan** (user request): two fingers with nothing selected
  zoom (1–8x) + pan the canvas about the finger midpoint; one finger pans
  while zoomed; % chip resets. Two fingers WITH a selection still
  transform the layer.
- **Rotation snap** to 0/±90/180 within 3° during twist.
- **Starter palettes** (§6): 34 sets in `src/model/starterPalettes.ts`,
  loaded via chips in the picker; `loadPalette` appends unique, one undo.
- **§12 finish screenshots DONE**: `npm run finish-shots` renders all 17
  presets × 3 tilts through CanvasKit into docs/finishes/ (51 PNGs
  committed). Re-run after any shader/preset change.

## Third M2 slice (2026-08-31, evening) — pin grid fixed, M2 COMPLETE

- **Pin drag-to-reorder fixed and emulator-verified** (tap-to-apply,
  hold-to-remove, drag-to-reorder all confirmed). The old approach hit an
  Android quirk: `measureInWindow` returns a y ~54dp above where touch
  `pageY` says the same row is (status-bar inset disagreement, Pixel_7).
  New approach avoids absolute coordinates entirely: each swatch has its
  own PanResponder and the drop slot is computed from the swatch's index
  plus the gesture's RELATIVE dx/dy in 38px slot units (`PinSwatch` /
  `targetIndex` in ColorPicker.tsx). Rule of thumb for this codebase:
  never mix measureInWindow with pageX/pageY; prefer relative deltas.
- **M2 (editor core) is complete** per §11: layer panel, selection +
  transform gestures, undo/redo, fill/shape layers, color picker with
  pins/recents/eyedropper — plus canvas zoom/pan, hit-test refinement,
  starter palettes, rotation snap.

## Next

1. Merge to `main` (PR from this branch) — M0–M2 all device-verified.
2. M3 content tools: photo import + cutout + fade masks, free draw,
   stamping, mirror symmetry, custom polygon builder UI, text editing.
   (`buildPolygonPath` and all shape plumbing already exist in the model.)
3. Deferred polish: SkPath deprecation migration to PathBuilder; §5 perf
   pass if tilt stutters on device (move ViewState to shared values).
4. M4 finishes UI: user especially wants palette-fed holo (see memory /
   "User priorities" above) — make palette choice prominent.

## Gotchas for the next session

- Expo Go Fast Refresh got stale twice after multi-file edits (kept
  running old code, once with a phantom "SweepGradient doesn't exist"
  error). Remedy: dev menu (`adb shell input keyevent 82`) → Reload, or
  restart `npx expo start`.
- adb/emulator are NOT on bash PATH: use `$LOCALAPPDATA/Android/Sdk/...`.
- Multitouch injection: `adb root`, then sendevent type-B protocol on
  `/dev/input/event2` (scripts existed in the session scratchpad —
  rewrite from HANDOFF if needed: slot/tracking-id/x/y/syn per frame,
  coords scaled to 0..32767 over the 1080x2400 screen).

## Still open in M2

- Fix the pin-grid gesture issue above.
- `SkPath.*` deprecation warnings from react-native-skia 2.6 (strokePath,
  renderer, shapes): migrate to `Skia.PathBuilder` in a maintenance pass.
- Fast Refresh got the app into a stale half-refreshed state twice during
  this session (`ReferenceError: SweepGradient doesn't exist` from an old
  tree). When edits seem to not apply: dev menu (keyevent 82) → Reload.

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
