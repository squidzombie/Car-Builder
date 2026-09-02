# Handoff — 2026-09-02: testing-feedback batch (post run 4)

Worked Max's review doc in its suggested order; all emulator-verified:
1. Image masking (verify-first): renderer's 'shape' mask branch existed
   since Build 3 but had NO UI and was a silent no-op (dstIn only
   touches pixels the shape covers). Fixed as a clip on the layer
   group; Mask sheet gains Shape type + picker + Size; new Rounded
   builtin. Works with drawn shapes and pairs with the cutout.
2. Geometric audit: cracked-ice/mosaic/prizm-facets/disco were ONE
   voronoi at different params. Disco rebuilt as mirror-ball orbs
   (mode 3), Checkerboard (mode 4) replaces trademark 'Mosaic',
   'Prizm Facets' renamed Facet + differentiated (big flat cells).
3. FX menu redone TWICE - Max rejected the text-header version
   mid-session; final: open family chip shares the preset panel's
   surface and flows into it (connected tab), presets are 54px LIVE
   shader swatches with tiny captions. He wants visual-first, minimal
   descriptive text - remember for future UI.
4. Wear scratches strictly light-gated (no 0.22 baseline) - face is
   clean at rest; Max judges on device, full removal is the fallback.
5. Borders: Angle cut / Notched / Arch top / Scalloped shaped frames
   (evenodd frame shapes, geometry renders in docs/borders via
   scripts/check-frames.ts); Bold/Double/Two-tone cut.
6. Preset bundling (open): recommended keeping effect-bundled borders
   as curated combos - awaiting Max's call.
NOTE: emulator app state was wiped during debugging (fresh M1 demo
card + onboarding replays). adb root kills the adb reverse - re-run
`adb reverse tcp:8081 tcp:8081` after any root/unroot.

---

# Earlier — 2026-09-01: TestFlight run 4 queued

EAS iOS build a7b14ed4 (production) queued with everything below; Max
submits via `npx eas-cli submit -p ios --latest`. This build carries
the first native module — watch its compile result.

Since the design lockdown, this sitting also landed (each verified on
the emulator, 103/103 tests):
- Rectangle as a first-class shape (Shape.defaultAspect) + rotate
  handle on the selection box (beginRotate/applyRotate, 45° snap).
- Stamp Size slider (16–320) and Draw Width slider (2–48) replacing
  the S/M/L / three-dots presets.
- Shape builder Draw tab: freehand strokes → custom shape. Filled
  (auto-closed evenodd silhouette, model/shapes.buildDrawnShapePath)
  or Ink (stroke outlines at chosen width, editor/drawnShape.ts via
  SkPath.stroke + PathOp.Union). Shape.fillRule threaded through
  renderer/glyphs/hit-testing.
- M7 onboarding: one-time "Make it shine" welcome sheet (flag in the
  state file via storage.loadOnboarded/saveOnboarded).
- Subject cutout: modules/subject-cutout (Swift, VNGenerateForeground-
  InstanceMaskRequest, iOS 17+, full-frame transparent-background
  output) + src/native/subjectCutout.ts guard + "Cut out" props-bar
  button on image layers. Hidden on Android/Expo Go; UNVERIFIED on
  device until Max tries the TestFlight build — first thing to test.

---

# Earlier — 2026-09-01: DESIGN LOCKDOWN, 3 chunks landed

Direction from Max: sharing is parked; lock down the in-app experience
and design first. Nothing moved out of the app — the web viewer is an
extra render target; the Link button stays hidden until shareConfig has
keys.

Landed (each typechecked, 96/96 tests, emulator-verified, committed):
1. **Motion + touch feedback + preview home** — Sheet entrance
   animation (240ms slide/fade + backdrop fade), Android hardware back
   closes sheets (was exiting the app), KeyboardAvoidingView on BOTH
   platforms (edge-to-edge Android doesn't resize the window; the
   rename sheet was fully hidden behind the keyboard), `pressed()`
   dim-on-touch on every high-touch Pressable, expo-haptics (tick on
   select/rotation-snap, thump on flip), preview screen is now a home:
   tappable title → rename sheet, Edit card = primary accent button.
2. **Editor chrome on theme tokens** — all remaining hardcoded hexes in
   ToolBar/EditorScreen/LayerPanel/App swept into theme.ts (new tokens:
   bgBar, track, chipGlass, rowSelected, onAccent, glyph, danger).
   Verified pixel-identical.
3. **Eyedropper loupe + slider hit targets** (UX review #10, #9) —
   drag-to-aim loupe (swatch + hex above the fingertip, ~30/s 1px
   snapshots, haptic on commit); MiniSlider gets a ~50dp padded hit
   area.

**CRITICAL FIX riding along in chunk 1: Android bundling was broken**
since the web-viewer work — `index.ts`'s `require('@shopify/react-
native-skia/lib/module/web')` is bundled by Metro regardless of the
Platform branch, dragging canvaskit-wasm (which imports `fs`) into the
native bundle → dev-server 500. Fix: split entries — `index.ts`
(native) / `index.web.ts` (LoadSkiaWeb gate), `package.json` main is
now extensionless `"index"` so Metro platform-resolves. Web export not
re-verified since the split — run `npx expo export --platform web`
before the next viewer deploy.

Open UX-review items needing Max's call: #6 two-finger rotate-vs-zoom
discoverability (dedicated rotate handle? first-run hint), #7 undo/redo
placement (top bar = worst one-handed reach). Remaining polish: pin
hold-affordance wiggle, gradient tile icon, M7 onboarding/empty states.

---

# Earlier handoff — 2026-09-01: WEB VIEWER WORKING ✓

## Web share viewer: RESOLVED

The /c/{id} viewer renders the full card in the browser — all shaders,
fonts, 3D mouse tilt, flip — verified via headless Edge (rig:
`MSYS_NO_PATHCONV=1 node scripts/web-shot.js /c/demo out.png`, Metro
running). The entire black-canvas saga traced to exactly TWO web stubs
in RN Skia (everything else was red herrings from impure bisection):
1. `matchFont` — no system fonts on CanvasKit → CardRenderer falls back
   to a bundled typeface on web.
2. `font.measureText` — not-implemented stub that THREW on every
   center/right-aligned text layer, blanking the whole canvas →
   `getTextWidth` on web.
Rule for this codebase: any RN Skia API that throws inside the render
kills the entire canvas silently; on web check JsiSk*.js for
throwNotImplementedOnRNWeb before using an API.
(Also kept: integer canvas sizes; wheel-canvas explicit background.)

Remaining for end-to-end share links:
1. User creates a Supabase project + public "cards" bucket, pastes URL +
   anon key into src/model/shareConfig.ts (Link button appears on the
   preview screen automatically).
2. Host the web build (candidate: `npx expo export --platform web` then
   EAS Hosting deploy — logged in already) and set VIEWER_URL.

---

## RESUME HERE: /c/{id} web viewer black-canvas debugging

Built this session (commits pending in this WIP): web share links —
ShareViewer (`src/web/ShareViewer.tsx`, routed via `/c/{id}` in App on
web), Skia-web loading (`index.ts` LoadSkiaWeb + `public/canvaskit.wasm`),
shareApi/shareConfig (Supabase upload, config placeholders — user will
provide keys), Link button on preview (hidden until configured),
react-native-web/react-dom installed, headless-Edge screenshot rig
(`MSYS_NO_PATHCONV=1 node scripts/web-shot.js /c/demo out.png`; Metro
must be running: `npx expo start`).

**Debug status — the /c/demo card canvas renders BLACK on web.**
Probes (in ShareViewer): `/c/plain` bare red rect ✓ WORKS; `/c/flat`
full CardRenderer, static viewState, integer canvas size ✓ WORKS
(all shaders/masks/stamps render!); `/c/demo` (real path via TiltCard +
60fps mouse-tilt state loop) ✗ BLACK.

Fixed along the way (both real bugs, keep):
1. matchFont has no system fonts on CanvasKit → threw and blanked the
   whole canvas → CardRenderer now falls back to a bundled typeface on
   web (skips text layer until faces load).
2. TiltCard's canvas height was fractional (448.0000000006) → rounded.
   (Suspected RN-Skia-web fractional-size failure — plausible but NOT
   yet proven to be A cause; retest cleanly.)

NEXT STEPS (one variable at a time — I conflated changes late in the
session): (1) re-run `/c/tilt` (TiltCard + STATIC view) as-is now —
if it renders, structure is fine and the culprit is the 60fps setView
rAF loop in ShareViewer (then try: throttle updates / gate first draw
until fonts ready / stable object identities); if still black, strip
Pressable + styles.card from TiltCard's web branch again (bare
View+Canvas inside TiltCard) to separate component-boundary vs wrappers.
Note: 3D-transform-breaks-compositing hypothesis was tested only with
the fractional height present — retest before trusting it; ideally
restore the Animated 3D branch if it turns out fine.

Also: EAS build #3 (Build 6 fixes) is compiled & unsubmitted (user's
choice); emulator + Metro need restarting after the reboot; machine IP
may change again (expo start prints the new exp:// URL).

---
# Previous notes (2026-08-31 night: TestFlight live)

## Beta feedback from Max's iPhone — FIX FIRST next session

1. **Gyro baseline bug (`src/view/useTilt.ts`)**: opening the app with the
   phone held tilted captures that pose as the zero baseline; returning
   the phone to normal leaves the card "way tilted and it doesn't
   recover." The baseline is captured once and never re-calibrates.
   Fix sketch: continuously drift the baseline toward the smoothed
   current reading with a long time constant (~3-5s) so any sustained
   pose becomes the new zero, while fast tilts still shine — or
   re-baseline when the offset stays saturated for >2s. Verify by
   launching the app with the phone flat on a table vs held sideways.
2. **Add-layer dropdown contrast (`src/editor/LayerPanel.tsx`)**: the "+"
   options row blends into the layer rows below. Transient surfaces need
   to read as a distinct elevated plane (lighter surface color, border,
   or shadow).
3. **Design bar raised**: "the UI is packing a lot in so we need to be
   high end... lessons learned throughout the years of Apple and Adobe."
   Treat dense-UI hierarchy seriously in every UI change from now on;
   don't defer egregious cases to M7. (See memory: ui-design-bar.)

## TestFlight state

- First build uploaded 2026-08-31 via EAS (project
  @squidzombie/cardbuilder, Expo account squidzombie already logged in on
  this machine; ASC auth = EAS-stored auto-generated API key).
- External group "Squids" with public link
  https://testflight.apple.com/join/Zv35qcan — pending Beta App Review
  (check Test Information is filled + build compliance answered).
- Update flow: `npx eas-cli build -p ios --profile production &&
  npx eas-cli submit -p ios --latest`.

---

## Latest slice (fonts + finish editor) — emulator-verified

- **Bundled display fonts** (§4 complete): Anton, Bebas Neue, Permanent
  Marker, Pacifico, Audiowide via @expo-google-fonts; SkTypeface registry
  (`renderer/fonts.ts`) filled by `useBundledFonts` at app root; font
  chips in the TextEditor. Fallback to system face until decoded.
  NOTE for web viewer (M6): the same faces must load there too.
- **M4 finish editor core**: FinishEditor sheet on every layer (FX chip) —
  family + preset chips (all 17), intensity/scale sliders, Rainbow vs
  Card-palette mode (palette-fed holo verified live), None to remove.
  Editor canvas sweeps tilt while the sheet is open (live shimmer).
- M4 possibly remaining: per-preset param tweaking UI (uP0..uP3) if we
  want it user-facing — §5 lists only intensity/scale/palette controls,
  so M4 may be DONE as specced; judge on device feel.
- Metro gotcha: newly installed npm packages needed a Metro restart plus
  `npx expo start --clear`; kill the stale process on 8081 first
  (netstat -ano | grep :8081).

---
# Previous notes (2026-08-31 evening: M3)

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
