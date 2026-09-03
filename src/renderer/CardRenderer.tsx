import React, { useEffect, useMemo } from 'react'
import { Platform } from 'react-native'
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated'
import {
  FillType,
  Group,
  Paint,
  Path,
  Rect,
  RoundedRect,
  RuntimeShader,
  Shadow,
  Image as SkiaImage,
  Text as SkiaText,
  Shader,
  LinearGradient,
  RadialGradient,
  Skia,
  matchFont,
  vec,
  type SkImage,
} from '@shopify/react-native-skia'
import type { CardDocument, Layer, Mask, ViewState } from '../model/types'
import { getShape } from '../model/shapes'
import { getTypeface } from './fonts'
import {
  getBevelEffect,
  getFinishEffect,
  buildFinishUniforms,
  buildWearUniforms,
} from '../finishes'
import { getWearEffect } from '../finishes'
import { strokePathFromPoints } from './strokePath'
import { paintColor, PaintChildren } from './paintProps'

/**
 * CardRenderer — pure function of CardDocument + ViewState (CLAUDE.md §2).
 * Editor, export, and web viewer all render through this. No editor state
 * in here, ever. Draws in document pixel space; wrap in a scaled Group or
 * pass `scale` to fit a screen.
 */
/**
 * Tilt can arrive as a plain ViewState (export, tests, anything static) or
 * as a Reanimated shared value (live preview, editor sweep, web viewer).
 * Either way the tilt-dependent uniforms are derived on the UI thread, so
 * a tilt frame never re-renders React (perf pass).
 */
export type TiltInput = ViewState | SharedValue<ViewState>

export type CardRendererProps = {
  doc: CardDocument
  side: 'front' | 'back'
  viewState: TiltInput
  /** decoded image assets by assetId; missing ids render a placeholder */
  assets?: Record<string, SkImage>
  /** uniform scale from document px to output px (default 1) */
  scale?: number
}

const REST_VIEW: ViewState = { tiltX: 0, tiltY: 0, lightX: 0.5, lightY: 0.35 }

const isShared = (v: TiltInput): v is SharedValue<ViewState> => !('tiltX' in v)

/** Normalize plain-or-shared tilt into a shared value the UI thread reads. */
function useViewSV(v: TiltInput): SharedValue<ViewState> {
  const shared = isShared(v)
  // (never read a shared value during render — `own` is unused when shared)
  const own = useSharedValue<ViewState>(shared ? REST_VIEW : v)
  useEffect(() => {
    if (!shared) own.value = v
  }, [shared, v, own])
  return shared ? v : own
}

export function CardRenderer({ doc, side, viewState, assets, scale = 1 }: CardRendererProps) {
  const sv = useViewSV(viewState)
  const { w, h } = doc.size
  const clip = Skia.RRectXY(Skia.XYWHRect(0, 0, w, h), doc.cornerRadius, doc.cornerRadius)
  const layers = doc[side].layers
  const condition = doc.condition
  const wearBase = useMemo(
    () =>
      condition && condition.intensity > 0 ? buildWearUniforms(condition, REST_VIEW, doc.size) : null,
    [condition, doc.size],
  )
  // captured as explicit fields: object spread of a captured object inside
  // a worklet is not reliable on the UI runtime
  const wSize = wearBase?.uSize ?? [w, h]
  const wAmount = (wearBase?.uAmount as number) ?? 0
  const wScratches = (wearBase?.uScratches as number) ?? 0
  const wEdge = (wearBase?.uEdge as number) ?? 0
  const wCorner = (wearBase?.uCorner as number) ?? 0
  const wSeed = (wearBase?.uSeed as number) ?? 0
  const wearUniforms = useDerivedValue(() => {
    const v = sv.value
    return {
      uSize: wSize,
      uTilt: [v.tiltX, v.tiltY],
      uLight: [v.lightX, v.lightY],
      uAmount: wAmount,
      uScratches: wScratches,
      uEdge: wEdge,
      uCorner: wCorner,
      uSeed: wSeed,
    }
  }, [wSize, wAmount, wScratches, wEdge, wCorner, wSeed])
  return (
    <Group transform={[{ scale }]}>
      <Group clip={clip}>
        {/* card stock under transparent layers */}
        <RoundedRect x={0} y={0} width={w} height={h} r={doc.cornerRadius} color="#f4f2ec" />
        {layers.map((layer) =>
          layer.visible ? (
            <LayerNode key={layer.id} layer={layer} doc={doc} viewState={sv} assets={assets} />
          ) : null,
        )}
        {wearBase ? (
          <Rect x={0} y={0} width={w} height={h}>
            <Shader source={getWearEffect()} uniforms={wearUniforms} />
          </Rect>
        ) : null}
      </Group>
    </Group>
  )
}

// Memoized: a tilt frame changes nothing here (the shared value is the
// same object), so static layers skip reconciliation entirely.
const LayerNode = React.memo(function LayerNode({
  layer,
  doc,
  viewState,
  assets,
}: {
  layer: Layer
  doc: CardDocument
  viewState: SharedValue<ViewState>
  assets?: Record<string, SkImage>
}) {
  const { w, h } = doc.size
  const t = layer.transform
  const emboss = layer.emboss

  // Emboss: a soft rounded bevel lit by the virtual light, computed from
  // the layer's own alpha slope inside its silhouette (bevel.sksl). The
  // light follows the tilt, so raised ink visibly catches it as the card
  // moves; inset is the same bevel with the light flipped. Hooks first —
  // the early return below must not skip them.
  const bevelUniforms = useDerivedValue(() => {
    const v = viewState.value
    let lx = (v.lightX - 0.5) * 2
    let ly = (v.lightY - 0.35) * 2
    const len = Math.sqrt(lx * lx + ly * ly)
    if (len < 0.05) {
      lx = 0.5
      ly = 0.7
    } else {
      lx /= len
      ly /= len
    }
    const hgt = emboss ? emboss.height : 0
    return {
      // the shader wants the direction the light travels: away from the
      // light source, i.e. the negated to-light vector
      uLight: [-lx, -ly],
      uRadius: 2 + hgt * 9,
      uStrength: 0.55 + hgt * 0.45,
      uFlip: emboss && emboss.style === 'inset' ? -1 : 1,
    }
  }, [emboss])

  const needsLayer =
    layer.finish !== undefined || layer.mask !== undefined || layer.emboss !== undefined
  const layerPaint =
    needsLayer || layer.opacity < 1 || layer.blendMode !== 'srcOver' ? (
      <Paint opacity={layer.opacity} blendMode={layer.blendMode} />
    ) : undefined

  const baseTransform = (dx = 0, dy = 0) => [
    { translateX: t.x + dx },
    { translateY: t.y + dy },
    { rotate: (t.rotation * Math.PI) / 180 },
    { scaleX: t.scaleX },
    { scaleY: t.scaleY },
  ]

  const content = (
    <Group transform={baseTransform()}>
      <LayerContent layer={layer} doc={doc} assets={assets} />
    </Group>
  )

  if (!layerPaint) return content

  const bevel = emboss ? (
    <RuntimeShader source={getBevelEffect()} uniforms={bevelUniforms} />
  ) : null

  // Shape masks clip the layer group directly: a dstIn pass only touches
  // pixels its geometry covers, so a shape drawn dstIn would leave
  // everything outside itself intact (no-op). Fades keep the dstIn pass —
  // their full-card gradient rect covers the whole surface.
  let shapeClip
  if (layer.mask?.type === 'shape' && layer.mask.assetId) {
    const maskShape = getShape(layer.mask.assetId, doc.shapes)
    if (maskShape) {
      const mp = layer.mask.params
      shapeClip =
        shapePath(
          maskShape.path,
          mp.x ?? 0,
          mp.y ?? 0,
          mp.w ?? w,
          mp.h ?? h,
          maskShape.fillRule,
        ) ?? undefined
    }
  }

  return (
    <Group layer={layerPaint} clip={shapeClip}>
      {bevel ? <Group layer={<Paint>{bevel}</Paint>}>{content}</Group> : content}
      {layer.finish ? <FinishPass layer={layer} doc={doc} viewState={viewState} /> : null}
      {layer.mask && layer.mask.type !== 'shape' ? (
        <MaskPass mask={layer.mask} w={w} h={h} assets={assets} shapes={doc.shapes} />
      ) : null}
    </Group>
  )
})

/** Finish pass: family shader drawn srcATop so it lands only on the layer's alpha. */
function FinishPass({
  layer,
  doc,
  viewState,
}: {
  layer: Layer
  doc: CardDocument
  viewState: SharedValue<ViewState>
}) {
  const finish = layer.finish!
  const effect = getFinishEffect(finish.family)
  const pinned = doc.palette.pinned
  const size = doc.size
  // everything but tilt/light is static per finish; only those two are
  // re-derived per frame, on the UI thread
  const base = useMemo(() => {
    const withPalette =
      finish.paletteMode === 'custom' && !finish.customColors
        ? { ...finish, customColors: pinned }
        : finish
    return buildFinishUniforms(withPalette, REST_VIEW, size)
  }, [finish, pinned, size])
  // captured as explicit fields (see wearUniforms)
  const uSize = base.uSize
  const uIntensity = base.uIntensity
  const uScale = base.uScale
  const uColorCount = base.uColorCount
  const uColors = base.uColors
  const uP0 = base.uP0
  const uP1 = base.uP1
  const uP2 = base.uP2
  const uP3 = base.uP3
  const uMode = base.uMode
  const uniforms = useDerivedValue(() => {
    const v = viewState.value
    return {
      uSize,
      uTilt: [v.tiltX, v.tiltY],
      uLight: [v.lightX, v.lightY],
      uIntensity,
      uScale,
      uColorCount,
      uColors,
      uP0,
      uP1,
      uP2,
      uP3,
      uMode,
    }
  }, [base])
  return (
    <Rect x={0} y={0} width={doc.size.w} height={doc.size.h} blendMode="srcATop">
      <Shader source={effect} uniforms={uniforms} />
    </Rect>
  )
}

/** Mask pass: dstIn keeps layer pixels where the mask is opaque. */
function MaskPass({
  mask,
  w,
  h,
  assets,
  shapes,
}: {
  mask: Mask
  w: number
  h: number
  assets?: Record<string, SkImage>
  shapes?: CardDocument['shapes']
}) {
  const p = mask.params
  if (mask.type === 'linear-fade') {
    const angle = (((p.angle ?? 90) * Math.PI) / 180)
    const cx = w / 2
    const cy = h / 2
    const half = (Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h) / 2
    const start = Math.max(0, Math.min(1, p.start ?? 0.5))
    const end = Math.max(start, Math.min(1, p.end ?? 1))
    return (
      <Rect x={0} y={0} width={w} height={h} blendMode="dstIn">
        <LinearGradient
          start={vec(cx - Math.cos(angle) * half, cy - Math.sin(angle) * half)}
          end={vec(cx + Math.cos(angle) * half, cy + Math.sin(angle) * half)}
          colors={['#ffffff', '#ffffff', '#ffffff00']}
          positions={[0, start, end]}
        />
      </Rect>
    )
  }
  if (mask.type === 'radial-fade') {
    const inner = Math.max(0, Math.min(1, p.inner ?? 0.4))
    const outer = Math.max(inner + 0.001, Math.min(1, p.outer ?? 1))
    return (
      <Rect x={0} y={0} width={w} height={h} blendMode="dstIn">
        <RadialGradient
          c={vec((p.cx ?? 0.5) * w, (p.cy ?? 0.5) * h)}
          r={Math.max(w, h) * 0.7}
          colors={['#ffffff', '#ffffff', '#ffffff00']}
          positions={[0, inner, outer]}
        />
      </Rect>
    )
  }
  // (shape masks are handled as a clip on the layer group in LayerNode)
  if (mask.type === 'raster' && mask.assetId && assets?.[mask.assetId]) {
    return (
      <SkiaImage
        image={assets[mask.assetId]}
        x={0}
        y={0}
        width={w}
        height={h}
        fit="fill"
        blendMode="dstIn"
      />
    )
  }
  return null
}

/** Parse a normalized (0..1) SVG shape path and map it into an x/y/w/h box. */
function shapePath(
  svg: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fillRule?: 'nonzero' | 'evenodd',
) {
  const path = Skia.Path.MakeFromSVGString(svg)
  if (!path) return null
  if (fillRule === 'evenodd') path.setFillType(FillType.EvenOdd)
  const m = Skia.Matrix()
  m.translate(x, y)
  m.scale(w, h)
  path.transform(m)
  return path
}

const FONT_FAMILY = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' })

function LayerContent({
  layer,
  doc,
  assets,
}: {
  layer: Layer
  doc: CardDocument
  assets?: Record<string, SkImage>
}) {
  const { w, h } = doc.size
  switch (layer.type) {
    case 'fill': {
      const paint = layer.fill!.paint
      return (
        <Rect x={0} y={0} width={w} height={h} color={paintColor(paint)}>
          <PaintChildren paint={paint} w={w} h={h} />
        </Rect>
      )
    }
    case 'image': {
      const { assetId, w: iw, h: ih } = layer.image!
      const img = assets?.[assetId]
      if (!img) {
        return <Rect x={0} y={0} width={iw} height={ih} color="#c9c4bb" />
      }
      return <SkiaImage image={img} x={0} y={0} width={iw} height={ih} fit="cover" />
    }
    case 'shape': {
      const s = layer.shape!
      const shape = getShape(s.shapeId, doc.shapes)
      if (!shape) return null
      const path = shapePath(shape.path, 0, 0, s.w, s.h, shape.fillRule)
      if (!path) return null
      return (
        <>
          <Path path={path} color={paintColor(s.paint)}>
            <PaintChildren paint={s.paint} w={s.w} h={s.h} />
          </Path>
          {s.stroke ? (
            <Path
              path={path}
              style="stroke"
              strokeWidth={s.stroke.width}
              strokeJoin="round"
              color={s.stroke.color}
            />
          ) : null}
        </>
      )
    }
    case 'path': {
      const p = layer.path!
      return (
        <>
          {p.strokes.map((s, i) => (
            <Path
              key={i}
              path={strokePathFromPoints(s.points)}
              style="stroke"
              strokeWidth={p.stroke.width}
              strokeCap="round"
              strokeJoin="round"
              color={p.stroke.color}
            />
          ))}
        </>
      )
    }
    case 'stamp': {
      const s = layer.stamp!
      const shape = getShape(s.shapeId, doc.shapes)
      if (!shape) return null
      const base = Skia.Path.MakeFromSVGString(shape.path)
      if (!base) return null
      if (shape.fillRule === 'evenodd') base.setFillType(FillType.EvenOdd)
      return (
        <>
          {s.instances.map((inst, i) => {
            const size = s.baseSize * inst.scale
            const aspect = shape.defaultAspect ?? 1
            const iw = aspect >= 1 ? size : size * aspect
            const ih = iw / aspect
            const path = base.copy()
            const m = Skia.Matrix()
            m.translate(inst.x, inst.y)
            m.rotate((inst.rotation * Math.PI) / 180)
            m.translate(-iw / 2, -ih / 2)
            m.scale(iw, ih)
            path.transform(m)
            return (
              <Path key={i} path={path} color={paintColor(s.paint)}>
                <PaintChildren paint={s.paint} w={iw} h={ih} />
              </Path>
            )
          })}
        </>
      )
    }
    case 'text': {
      const t = layer.text!
      const tf = t.font !== 'system' ? getTypeface(t.font) : undefined
      let font
      if (tf) {
        font = Skia.Font(tf, t.size)
      } else if (Platform.OS !== 'web') {
        font = matchFont({ fontFamily: FONT_FAMILY, fontSize: t.size, fontWeight: 'bold' })
      } else {
        // CanvasKit has no system fonts: fall back to a bundled face, and
        // skip the layer until the faces finish loading (a throw here
        // would blank the whole canvas)
        const fallback = getTypeface('anton') ?? getTypeface('bebas')
        if (!fallback) return null
        font = Skia.Font(fallback, t.size)
      }
      let x = 0
      if (t.align !== 'l') {
        // measureText is a not-implemented stub on RN Skia web (throwing
        // inside the render blanks the whole canvas); getTextWidth works
        // everywhere via glyph widths
        const width =
          Platform.OS === 'web'
            ? font.getTextWidth(t.content)
            : font.measureText(t.content).width
        x = t.align === 'c' ? -width / 2 : -width
      }
      // outline is a stroked pass behind the fill; the shadow hangs off
      // whichever pass is the outer silhouette
      const outline = t.outline && t.outline.width > 0 ? t.outline : undefined
      const shadow = t.shadow ? (
        <Shadow dx={t.shadow.dx} dy={t.shadow.dy} blur={t.shadow.blur} color={t.shadow.color} />
      ) : null
      return (
        <>
          {outline ? (
            <SkiaText
              x={x}
              y={0}
              text={t.content}
              font={font}
              color={outline.color}
              style="stroke"
              strokeWidth={outline.width}
              strokeJoin="round"
              strokeCap="round"
            >
              {shadow}
            </SkiaText>
          ) : null}
          <SkiaText x={x} y={0} text={t.content} font={font} color={t.color}>
            {outline ? null : shadow}
          </SkiaText>
        </>
      )
    }
    default:
      return null
  }
}
