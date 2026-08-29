import { UNIFORMS, HELPERS } from './common.sksl'

// Metallic family: anisotropic brushed highlight over a tinted base with
// strong specular. Presets: gold, silver, chrome, rose gold.
// uP0/uP1/uP2 = base tint RGB
// uP3 = brush frequency (0 = smooth chrome)

export const METALLIC_SKSL = `
${UNIFORMS}
${HELPERS}

half4 main(float2 xy) {
  float2 uv = xy / uSize;
  float phase = uTilt.x + uTilt.y * 0.5;

  float3 tint = float3(uP0, uP1, uP2);
  if (uColorCount > 0.5) tint = uColors[0].rgb;

  // brushed-metal streaks: high-frequency noise stretched horizontally
  float brush = 0.0;
  if (uP3 > 0.0) {
    brush = vnoise(float2(uv.x * 3.0, uv.y * uP3 * uScale)) - 0.5;
  }

  // anisotropic highlight band sweeping with tilt
  float band = uv.y - 0.5 + brush * 0.15 + (uv.x - 0.5) * 0.25;
  float hi = exp(-pow((band - phase * 0.35) * 5.0, 2.0));

  float spec = specular(uv);
  float lum = 0.55 + brush * 0.25 + hi * 0.9 + spec * 0.8;
  float3 col = tint * lum;
  // near-white core of the highlight sells the metal
  col = mix(col, float3(1.0), clamp(hi * 0.5 + spec * 0.35, 0.0, 1.0));
  col += grain(xy);

  float a = uIntensity * clamp(0.75 + hi * 0.25, 0.0, 1.0);
  return half4(col * a, a);
}
`
