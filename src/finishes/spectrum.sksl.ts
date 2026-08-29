import { UNIFORMS, HELPERS } from './common.sksl'

// Spectrum family: hue sweep as f(tilt · direction), optional line pattern
// modulating phase. Presets: rainbow, refractor, wave refractor.
// uP0 = line frequency (0 = smooth rainbow)
// uP1 = line angle (radians)
// uP2 = wave amount (0 = straight lines)
// uP3 = band frequency across the card

export const SPECTRUM_SKSL = `
${UNIFORMS}
${HELPERS}

half4 main(float2 xy) {
  float2 uv = xy / uSize;
  float phase = uTilt.x * 1.4 + uTilt.y * 0.7;

  float2 dir = float2(cos(uP1), sin(uP1));
  float coord = dot(uv, dir) * uP3 * uScale;

  float lines = 1.0;
  if (uP0 > 0.0) {
    float w = coord * uP0;
    if (uP2 > 0.0) w += sin(uv.y * 6.2831 * 2.0 + phase * 2.0) * uP2;
    float s = sin(w * 6.2831);
    lines = 0.55 + 0.45 * s;
    phase += s * 0.12; // lines shift the hue phase like refractor ridges
  }

  float3 col = paletteColor(coord + phase);
  float spec = specular(uv);
  col += spec * 0.85;
  col += grain(xy);

  float a = uIntensity * (0.45 + 0.4 * lines + 0.5 * spec);
  a = clamp(a, 0.0, 1.0);
  return half4(col * a, a);
}
`
