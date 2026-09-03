// Photo adjustment math (pure, no Skia import — unit-tested).

export type ImageAdjust = { brightness: number; contrast: number; saturation: number }

/**
 * 4x5 color matrix for photo adjustments: saturation via the luminance
 * mix, contrast as a scale about mid-grey, brightness as a scale.
 * Skia's float matrix takes its translate column in 0..1.
 */
export function adjustMatrix(a: ImageAdjust): number[] {
  const s = Math.max(0, a.saturation)
  const lr = 0.2126 * (1 - s)
  const lg = 0.7152 * (1 - s)
  const lb = 0.0722 * (1 - s)
  const c = 1 + a.contrast
  const b = 1 + a.brightness
  const t = 0.5 * (1 - c) // keeps mid-grey fixed under the contrast scale
  const k = c * b
  return [
    (lr + s) * k, lg * k, lb * k, 0, t * b,
    lr * k, (lg + s) * k, lb * k, 0, t * b,
    lr * k, lg * k, (lb + s) * k, 0, t * b,
    0, 0, 0, 1, 0,
  ]
}
