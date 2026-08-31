import type { Color, Layer, Paint } from '../model/types'

// The color picker edits one "primary color" per layer (M2). Gradient
// editing is out of this slice: a gradient paint reads as its first stop
// and is replaced by a solid when the picker applies a color.

function paintPrimary(p: Paint): Color {
  return 'color' in p ? p.color : p.gradient.stops[0]?.color ?? '#ffffff'
}

/** The layer's primary editable color; null for layers without one (image). */
export function layerColor(layer: Layer): Color | null {
  switch (layer.type) {
    case 'fill':
      return paintPrimary(layer.fill!.paint)
    case 'shape':
      return paintPrimary(layer.shape!.paint)
    case 'text':
      return layer.text!.color
    case 'path':
      return layer.path!.stroke.color
    case 'stamp':
      return paintPrimary(layer.stamp!.paint)
    default:
      return null
  }
}

/** Set the primary color in place (for use inside updateLayer's mutator). */
export function setLayerColor(layer: Layer, color: Color): void {
  switch (layer.type) {
    case 'fill':
      layer.fill!.paint = { color }
      break
    case 'shape':
      layer.shape!.paint = { color }
      break
    case 'text':
      layer.text!.color = color
      break
    case 'path':
      layer.path!.stroke.color = color
      break
    case 'stamp':
      layer.stamp!.paint = { color }
      break
  }
}
