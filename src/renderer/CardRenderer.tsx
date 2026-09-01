import React from 'react'
import { Platform } from 'react-native'
import {
  Group,
  Paint,
  Path,
  Rect,
  RoundedRect,
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
import { getFinishEffect, buildFinishUniforms, buildWearUniforms } from '../finishes'
import { getWearEffect } from '../finishes'
import { BlendColor } from '@shopify/react-native-skia'
import { strokePathFromPoints } from './strokePath'
import { paintColor, PaintChildren } from './paintProps'

/**
 * CardRenderer — pure function of CardDocument + ViewState (CLAUDE.md §2).
 * Editor, export, and web viewer all render through this. No editor state
 * in here, ever. Draws in document pixel space; wrap in a scaled Group or
 * pass `scale` to fit a screen.
 */
export type CardRendererProps = {
  doc: CardDocument
  side: 'front' | 'back'
  viewState: ViewState
  /** decoded image assets by assetId; missing ids render a placeholder */
  assets?: Record<string, SkImage>
  /** uniform scale from document px to output px (default 1) */
  scale?: number
}

export function CardRenderer({ doc, side, viewState, assets, scale = 1 }: CardRendererProps) {
  const { w, h } = doc.size
  const clip = Skia.RRectXY(Skia.XYWHRect(0, 0, w, h), doc.cornerRadius, doc.cornerRadius)
  const layers = doc[side].layers
  return (
    <Group transform={[{ scale }]}>
      <Group clip={clip}>
        {/* card stock under transparent layers */}
        <RoundedRect x={0} y={0} width={w} height={h} r={doc.cornerRadius} color="#f4f2ec" />
        {layers.map((layer) =>
          layer.visible ? (
            <LayerNode key={layer.id} layer={layer} doc={doc} viewState={viewState} assets={assets} />
          ) : null,
        )}
        {doc.condition && doc.condition.intensity > 0 ? (
          <Rect x={0} y={0} width={w} height={h}>
            <Shader
              source={getWearEffect()}
              uniforms={buildWearUniforms(doc.condition, viewState, doc.size)}
            />
          </Rect>
        ) : null}
      </Group>
    </Group>
  )
}

function LayerNode({
  layer,
  doc,
  viewState,
  assets,
}: {
  layer: Layer
  doc: CardDocument
  viewState: ViewState
  assets?: Record<string, SkImage>
}) {
  const { w, h } = doc.size
  const t = layer.transform
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

  // Emboss (Build 4): the content's silhouette drawn twice under itself,
  // offset along the light direction — a highlight edge facing the light
  // and a shadow edge away from it. Offsets follow the tilt, so raised
  // ink visibly catches the light as the card moves.
  let embossPasses: React.ReactNode = null
  if (layer.emboss) {
    let lx = (viewState.lightX - 0.5) * 2
    let ly = (viewState.lightY - 0.35) * 2
    const len = Math.hypot(lx, ly)
    if (len < 0.05) {
      lx = 0.5
      ly = 0.7
    } else {
      lx /= len
      ly /= len
    }
    const mag = 2.5 + layer.emboss.height * 7
    const flip = layer.emboss.style === 'inset' ? -1 : 1
    const hx = -lx * mag * flip
    const hy = -ly * mag * flip
    embossPasses = (
      <>
        <Group
          transform={baseTransform(hx, hy)}
          layer={
            <Paint opacity={0.55} blendMode="screen">
              <BlendColor color="#ffffff" mode="srcIn" />
            </Paint>
          }
        >
          <LayerContent layer={layer} doc={doc} assets={assets} />
        </Group>
        <Group
          transform={baseTransform(-hx, -hy)}
          layer={
            <Paint opacity={0.5} blendMode="multiply">
              <BlendColor color="#000000" mode="srcIn" />
            </Paint>
          }
        >
          <LayerContent layer={layer} doc={doc} assets={assets} />
        </Group>
      </>
    )
  }

  return (
    <Group layer={layerPaint}>
      {embossPasses}
      {content}
      {layer.finish ? <FinishPass layer={layer} doc={doc} viewState={viewState} /> : null}
      {layer.mask ? (
        <MaskPass mask={layer.mask} w={w} h={h} assets={assets} shapes={doc.shapes} />
      ) : null}
    </Group>
  )
}

/** Finish pass: family shader drawn srcATop so it lands only on the layer's alpha. */
function FinishPass({ layer, doc, viewState }: { layer: Layer; doc: CardDocument; viewState: ViewState }) {
  const finish = layer.finish!
  const effect = getFinishEffect(finish.family)
  const withPalette =
    finish.paletteMode === 'custom' && !finish.customColors
      ? { ...finish, customColors: doc.palette.pinned }
      : finish
  const uniforms = buildFinishUniforms(withPalette, viewState, doc.size)
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
  if (mask.type === 'shape' && mask.assetId) {
    const shape = getShape(mask.assetId, shapes)
    if (shape) {
      const path = shapePath(shape.path, p.x ?? 0, p.y ?? 0, p.w ?? w, p.h ?? h)
      if (path) return <Path path={path} color="#ffffff" blendMode="dstIn" />
    }
    return null
  }
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
function shapePath(svg: string, x: number, y: number, w: number, h: number) {
  const path = Skia.Path.MakeFromSVGString(svg)
  if (!path) return null
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
      const path = shapePath(shape.path, 0, 0, s.w, s.h)
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
      return <SkiaText x={x} y={0} text={t.content} font={font} color={t.color} />
    }
    default:
      return null
  }
}
