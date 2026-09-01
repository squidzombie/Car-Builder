# Beta roadmap — planned 2026-08-31, awaiting Max's go

Sequenced as TestFlight builds: each build is small enough to ship and
get feedback on, ordered fixes → foundation → showpieces → breadth.
CLAUDE.md stays the spec authority; this is the execution order.

## Build 2 — beta fixes (small, ship fast)

1. **Gyro baseline drift** (`src/view/useTilt.ts`): baseline is captured
   once at launch, so opening the app tilted skews the card permanently.
   Fix: continuously drift the baseline toward the smoothed current pose
   (~3–5s time constant) so any sustained pose becomes the new zero while
   fast tilts still shine. Test: launch flat vs. launch sideways, then
   settle; also long holds at an angle.
2. **Add-layer menu elevation** (`LayerPanel.tsx`): quick contrast fix —
   lighter surface + hairline border + shadow so the dropdown reads as a
   plane above the rows (full add-flow redesign lands in Build 3).

## Build 3 — UI hierarchy pass (the Apple/Adobe directive)

Goal: dense-but-refined. One design system applied everywhere, not
per-screen tweaks.

1. **Surface tokens** (`src/editor/theme.ts`): 3 background levels
   (screen / panel / elevated surface), 1 accent, hairline+shadow
   elevation recipe, type scale (11/12/13/15), 8pt spacing scale.
   Refit toolbar, ToolBar, props bar, LayerPanel, all five sheets.
2. **One Sheet component**: shared container (grab handle, title row,
   consistent padding/radius/elevation) wrapped by color/mask/text/
   finish/builder/chooser — kills the five slightly-different sheets.
3. **Sectioned "Add" sheet** replacing the + dropdown: categories with
   visual previews — Photo · Text · Shapes · Borders · Fills. This is
   also the future home of Build 5's preset libraries.
4. Sweep the remaining emoji glyphs (👁🔒🗑⧉) for drawn/monochrome icons;
   quiet the chrome (fewer filled pills, more hairlines + spacing).

## Build 4 — surface effects: emboss + card condition (the showpieces)

1. **Emboss (per-layer "surface")** — raised-ink look, e.g. a 1/1 serial
   whose ink visibly sits above the card:
   - Model: `Layer.emboss?: { height: 0..1; style: 'raised' | 'inset' }`
     (optional field, round-trip test per §12).
   - Render: inside the layer's group, draw the content silhouette twice
     offset along the light vector (screen-blend highlight toward the
     light, multiply shadow away from it, offsets/opacity ∝ height ×
     tilt) under the real content. Tilt-reactive depth, cheap.
   - UI: FX sheet gains a "Surface" row: Flat / Raised / Inset + height
     slider. Default templates: serial-number text ships Raised.
2. **Card condition / grade (card-level)** — toggle how "lived" the card
   looks:
   - Model: `CardDocument.condition?: { preset: string; intensity: 0..1 }`
     presets: gem-mint (off), mint, near-mint, played, heavily-played.
   - Render: final overlay pass in CardRenderer — new `wear.sksl` :
     hash-based hairline scratches that flare only when aligned with the
     specular direction, edge whitening near the border, corner scuffs,
     faint print lines. Uniform params from preset × intensity.
   - UI: on the preview screen (it's a card-level property, not a layer):
     small "Condition" chip row. §12 screenshots via render-finishes-style
     script.
   - This is the demo-magic feature: scratches glinting as you tilt.

## Build 5 — content breadth (more defaults everywhere)

1. **Border presets library** (~14): thin/double line, two-tone frame,
   corner-accent (deco brackets), pennant edge, stitched jersey border,
   comic burst, vintage filigree (polygon-builder paths), torn edge,
   split diagonal, pinstripe inset... Each = a small factory returning
   1–2 layers sized to the card; previewed as tiles in the Add sheet's
   Borders section; finish-ready (any border can take refractor/gold).
2. **Element presets per section**: name-plate styles (~6), badge styles
   (~6), stat-table style variants for backs (~3).
3. **2–3 new templates** built from the above (e.g. Retro, Chrome,
   Galaxy) + more themed palettes.
4. Keep every preset a plain CardDocument fragment — §3 model unchanged.

## Backlog (after these, roughly in order)

- Web share links (M6 remainder): Supabase upload + /c/{id} viewer
  (needs the bundled fonts on web too).
- Subject cutout via dev build (unlocked now that we ship via EAS).
- M7: onboarding (30s, ends on a tilting sample card), perf pass
  (Reanimated shared-value tilt if needed), store assets.

## Working notes

- Every build: typecheck + tests + emulator verification before
  `eas build` + `eas submit`.
- Design bar: transient surfaces are distinct planes; hierarchy from
  surface + type, not decoration (memory: ui-design-bar).
