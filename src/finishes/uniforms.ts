import type { Finish, ViewState } from '../model/types'
import { parseColor } from '../model/color'

const MAX_COLORS = 6

/**
 * Build the uniform set for a finish at the given view state (pure — no Skia
 * import, so it is testable and shared with the web viewer).
 * `size` is the pixel size of the surface the finish covers.
 */
export function buildFinishUniforms(
  finish: Finish,
  view: ViewState,
  size: { w: number; h: number },
): Record<string, number | number[]> {
  const custom =
    finish.paletteMode === 'custom' && finish.customColors && finish.customColors.length > 0
      ? finish.customColors.slice(0, MAX_COLORS)
      : []
  const colors: number[] = []
  for (let i = 0; i < MAX_COLORS; i++) {
    const c = custom[i] ? parseColor(custom[i]) : [0, 0, 0, 1]
    colors.push(c[0], c[1], c[2], c[3])
  }
  return {
    uSize: [size.w, size.h],
    uTilt: [view.tiltX, view.tiltY],
    uLight: [view.lightX, view.lightY],
    uIntensity: finish.intensity,
    uScale: finish.scale,
    uColorCount: custom.length,
    uColors: colors,
    uP0: finish.params.p0 ?? 0,
    uP1: finish.params.p1 ?? 0,
    uP2: finish.params.p2 ?? 0,
    uP3: finish.params.p3 ?? 0,
  }
}
