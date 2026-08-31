# Card Builder — Project Spec

> Drop this in the repo as `CLAUDE.md`. It is the source of truth for scope, architecture, and build order. Update it when decisions change.

## 1. What we're building

A mobile app for designing custom trading cards (front and back) and viewing them with a realistic, tilt-reactive holographic finish. Sports-card-first in presentation and marketing; fully general underneath.

**The signature moment:** tilt your phone and watch the foil shimmer shift like a real Prizm/refractor. Everything else serves that.

**Positioning:** "Make your own sports card." Templates, finish names, and starter content lean sports. The engine has zero sports assumptions, so a stoner card with a custom pot-leaf stamp is just a different template.

## 2. Platform and stack

| Layer | Choice | Why |
|---|---|---|
| App | Expo (React Native), TypeScript | One codebase for iOS, Android, and web viewer; Expo handles camera roll, gyro, builds, store submission |
| Rendering | `@shopify/react-native-skia` | Real shader runtime (SkSL) for holo finishes; same renderer on web via CanvasKit |
| State | Zustand + Immer | Simple, undo-friendly |
| Backend | Supabase (Postgres + Storage) | Card JSON + PNG storage, anonymous share links, no auth in v1 |
| Web viewer | Expo web build, route `/c/{id}` | Reuses the card renderer; mouse + device-orientation tilt |

Non-negotiable: the card renderer (`CardRenderer`) must be a pure function of `CardDocument` + `ViewState` (tilt, light position). Editor, export, and web viewer all call the same thing.

## 3. Data model

```ts
type CardDocument = {
  id: string
  version: 1
  size: { w: number; h: number }      // px at 300dpi; default 2.5in x 3.5in = 750 x 1050
  cornerRadius: number
  palette: Palette
  shapes?: Shape[]                    // custom shapes used by this card; travel with it
  front: Side
  back: Side
  meta: { title?: string; templateId?: string; createdAt: string; updatedAt: string }
}

type Side = { layers: Layer[] }        // bottom to top

type Layer = {
  id: string
  name: string
  type: 'fill' | 'image' | 'shape' | 'path' | 'stamp' | 'text'
  transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }
  opacity: number
  blendMode: BlendMode
  locked: boolean
  visible: boolean
  mask?: Mask                          // optional alpha mask (fades, cutouts)
  finish?: Finish                      // optional foil — see §5
  // type-specific:
  fill?: { color: Color | Gradient }
  image?: { assetId: string; cutout?: 'none' | 'subject' | 'manual' }
  shape?: { shapeId: string; fill: Color | Gradient; stroke?: Stroke }
  path?: { strokes: { points: Point[] }[]; stroke: Stroke }  // free draw; a session's strokes share one layer + style
  stamp?: { shapeId: string; instances: StampInstance[]; fill: Color | Gradient }
  text?: { content: string; font: string; size: number; color: Color; align: 'l' | 'c' | 'r' }
}

type StampInstance = { x: number; y: number; rotation: number; scale: number }

type Mask = { type: 'linear-fade' | 'radial-fade' | 'shape' | 'raster'; params: Record<string, number>; assetId?: string }

type Shape = { id: string; name: string; path: string /* SVG path, normalized to 0..1 box */; builtIn: boolean }
```

**Rules**
- Layers are the only thing the user edits. Finishes and masks live on layers.
- A stamp layer holds many instances of one shape; that's what makes stamping cheap and symmetry easy.
- Custom shapes are stored as normalized SVG paths so a polygon builder output and a hand-drawn outline are the same thing downstream.
- Everything serializes to JSON. No binary state except image assets (referenced by `assetId`).

## 4. Editor features (v1)

### Layers
Add / delete / reorder / rename / lock / hide / duplicate. Undo/redo (command stack, 50 deep). Tap to select, two-finger to transform, pinch to scale, twist to rotate.

### Photo import
Camera roll → image layer. Subject cutout: iOS `VNGenerateForegroundInstanceMask` via native module; Android: ML Kit Subject Segmentation with manual-eraser fallback. Fade masks (linear/radial, adjustable angle and softness) for the classic "player fades into background" look.

### Shapes
Built-in library: circle, square, triangle, star (5/6-point), hexagon, diamond, shield, banner, lightning, flame, crown, wing, laurel. Custom polygon builder: enter side count (3–24), optional star inset ratio, optional corner rounding → saved to user library. Custom shapes work everywhere a built-in does.

### Free draw
Pressure-insensitive smoothed strokes (Catmull-Rom), width, color, opacity. Eraser. Each draw session = one path layer until user starts a new one.

### Stamping
Pick a shape, tap or drag to place instances. Options: size, rotation (fixed / random range / follow-drag-direction), spacing on drag, jitter. Stamps go into the active stamp layer.

### Symmetry assist
Applies to draw and stamp. v1 modes: **mirror horizontal**, **mirror vertical**, **both**. v2: radial (N-fold rotational), kaleidoscope. Symmetry is applied at input time (generates mirrored strokes/instances), not as a render effect, so the result is real editable content.

### Text
Basic: name, number, team, position. System fonts plus 4–6 bundled display fonts (condensed sports, script, chrome-style).

### Card back
Same editor, separate layer stack. Back templates include a stats table block (text layers arranged in a grid) — editable cells, not a special layer type.

## 5. Finish system (holo)

A `Finish` is an optional property on any layer. It renders as a shader pass over that layer's alpha, driven by `ViewState`.

```ts
type Finish = {
  family: 'spectrum' | 'geometric' | 'fluid' | 'metallic' | 'sparkle'
  preset: string                       // e.g. 'refractor', 'cracked-ice', 'lava'
  intensity: number                    // 0..1
  scale: number                        // pattern size
  paletteMode: 'rainbow' | 'custom'
  customColors?: Color[]               // from card palette
  params: Record<string, number>       // family-specific
}

type ViewState = {
  tiltX: number; tiltY: number         // -1..1, from gyro or drag
  lightX: number; lightY: number       // virtual light position, derived from tilt + offset
}
```

### Families (each = one SkSL shader with presets)

| Family | Presets (v1 bold) | Technique |
|---|---|---|
| Spectrum | **rainbow**, **refractor** (linear lines), wave refractor | Hue sweep as f(tilt · direction), optional line pattern modulating phase |
| Geometric | **cracked ice**, mosaic, prizm facets, disco | Voronoi / triangulated cells, each with its own hue offset and specular |
| Fluid | **lava**, oil slick, aurora, liquid chrome | Domain-warped simplex noise; tilt drives the warp offset (not time) |
| Metallic | **gold**, silver, chrome, rose gold | Anisotropic highlight + tinted base, strong specular |
| Sparkle | glitter, starfield | Hashed point grid with tilt-gated twinkle |

### Shared composition (per layer, in order)
1. Base pattern (family shader) modulated by tilt
2. Rainbow / palette band swept across by tilt angle
3. Specular glare: soft highlight following the virtual light
4. Fine grain noise (fixed, ~3% intensity) to kill the "too clean" look
5. Multiply by layer alpha and `intensity`

### Quality bar
The reference is the well-known "pokemon cards css" demo by simeydotme. If a finish doesn't feel at least as convincing as that on a real phone, it's not done.

### Performance
Target 60fps on a mid-range Android from ~2022. One offscreen render per finished layer, composited; cache anything not tilt-dependent. If total finished layers > 8, degrade grain and sparkle first.

## 6. Color system

- **Picker:** hue wheel + saturation/value square, hex input, alpha slider
- **Eyedropper:** sample any pixel on the card, including photos
- **Pinned swatches:** per-card palette (`CardDocument.palette`). Long-press any swatch anywhere in the UI to pin. Drag to reorder. Saves and travels with the card.
- **Recents:** last 12 used, auto-tracked, separate from pins
- **Starter palettes:** ~30 team-color sets, plus themed sets (neon, chrome, earth, stoner greens). Loading one appends to pins, doesn't replace.
- **Palette feeds finishes:** `paletteMode: 'custom'` uses pinned colors as the spectrum/band colors, so any finish can be recolored to match the card.

## 7. 3D preview

- Fullscreen card with perspective transform (Skia `Canvas` inside a `Reanimated` 3D rotation, or native `transform` with `perspective`)
- Input: gyroscope (default, with dead zone + smoothing), drag fallback, toggle between them
- Tap or swipe to flip; back side tilts identically
- Subtle drop shadow and edge highlight that respond to tilt to sell the card as a physical object
- Preview is the same `CardRenderer` used in the editor at reduced tilt

## 8. Templates

v1 ships **4**:
1. **Blank** — white card, no layers
2. **Portrait** — photo slot (upper 70%, radial fade bottom), name bar, number badge, refractor border
3. **Full body** — photo slot with subject cutout, diagonal color band behind, cracked-ice background
4. **Action** — photo with linear fade, angled team-color stripes, foil name plate

Every template also defines a **back**: stats table (5 rows x 4 cols), bio text block, logo slot. Templates are just `CardDocument` JSON with placeholder layers, so users can save their own later (v2).

## 9. Export and share

- **Export PNG:** front and back at full resolution, holo baked at a fixed "hero" tilt. Option to export a short looping video of the tilt (v1.5).
- **Share link:** upload `CardDocument` JSON + assets + PNG to Supabase Storage → `https://<domain>/c/{id}`. Web viewer renders with the real shader; mouse-move or device-orientation drives tilt. No login needed to view or to create a link. Links are unlisted (random 10-char id).
- **Local save:** cards persist on device (JSON files via expo-file-system — docs are whole-blob JSON, no queries needed). Cloud is only for share links in v1.

## 10. Out of scope for v1

Accounts, collections/galleries, radial/kaleidoscope symmetry, user-saved templates, print ordering, in-app purchases, animated stickers, multi-card sets, collaboration. Each can be added without changing the data model.

## 11. Build order

Each milestone is a working checkpoint. Do not start the next until the current one runs on a real phone.

**M0 — Prove the magic (throwaway allowed)**
Static card image, two finishes (refractor + lava) as full-card overlays, gyro + drag tilt, flip. Ship to phone. Decide: does this feel right? Tune shaders until yes.

**M1 — Renderer + data model**
`CardDocument` types, `CardRenderer` (pure), all six layer types rendering, finish as a per-layer property, palette in document. Load a hand-written template JSON and render it with tilt.

**M2 — Editor core**
Layer panel, selection + transform gestures, undo/redo, fill and shape layers, color picker with pins/recents/eyedropper.

**M3 — Content tools**
Photo import + cutout + fade masks, free draw, stamping, mirror symmetry, custom polygon builder, text.

**M4 — Finishes UI**
Finish picker per layer, presets for all five families, intensity/scale/palette controls, live preview while tilting.

**M5 — Templates + back**
Four templates with backs, stats table, template chooser on new card.

**M6 — Export + share**
PNG export, Supabase upload, web viewer route, share sheet.

**M7 — Polish + ship**
Onboarding (30 seconds, ends on a tilting sample card), empty states, performance pass, store assets, TestFlight / Play internal test.

## 12. Working agreements for Claude Code

- Keep `CardRenderer` pure and platform-agnostic. No editor state leaks into it.
- Shaders live in `src/finishes/*.sksl` with a matching `.ts` preset file. Every preset needs a screenshot in `docs/finishes/` at tilt (0,0), (1,0), (0,1).
- Every new layer type or finish family must round-trip through JSON serialize → deserialize → render identically. Add a test.
- No feature work on M(n+1) while M(n) has an open bug that reproduces on device.
- When unsure whether something belongs in v1, check §10. If it's listed there, it waits.
