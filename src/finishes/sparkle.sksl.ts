import { UNIFORMS, HELPERS } from './common.sksl'

// Sparkle family: hashed point grid with tilt-gated twinkle — each fleck has a
// random orientation and only fires when the tilt sweeps past it.
// Presets: glitter, starfield.
// uP0 = density (cells across)
// uP1 = fleck size
// uP2 = twinkle sharpness
// uP3 = colored flecks (0 = white, 1 = palette)

export const SPARKLE_SKSL = `
${UNIFORMS}
${HELPERS}

half4 main(float2 xy) {
  float2 uv = xy / uSize;
  float aspect = uSize.y / uSize.x;
  float2 suv = float2(uv.x, uv.y * aspect);

  float2 p = suv * uP0 * uScale;
  float2 cell = floor(p);
  float2 f = fract(p);

  float sum = 0.0;
  float3 col = float3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float2 g = float2(float(x), float(y));
      float2 id = cell + g;
      float2 o = hash22(id);
      float2 d = g + o - f;
      float dist = length(d);

      // random orientation; the fleck flashes when tilt aligns with it
      float ang = hash21(id + 3.7) * 6.2831;
      float gate = dot(float2(cos(ang), sin(ang)), uTilt) + hash21(id + 9.1) * 2.0 - 1.0;
      float tw = pow(max(0.0, 1.0 - abs(gate)), uP2);

      float fleck = smoothstep(uP1, 0.0, dist) * tw;
      sum += fleck;
      float3 fc = uP3 > 0.5 ? paletteColor(hash21(id) + uTilt.x * 0.5) : float3(1.0);
      col += fc * fleck;
    }
  }

  float spec = specular(uv);
  col += spec * 0.25;
  col += grain(xy) * 0.5;

  float a = uIntensity * clamp(sum + spec * 0.15, 0.0, 1.0);
  return half4(col * a, a);
}
`
