import { UNIFORMS, HELPERS } from './common.sksl'

// Fluid family: domain-warped noise; tilt drives the warp offset (not time),
// so the pattern flows as you tilt. Presets: lava, oil slick, aurora, liquid chrome.
// uP0 = warp strength
// uP1 = color band frequency
// uP2 = contrast
// uP3 = base pattern frequency

export const FLUID_SKSL = `
${UNIFORMS}
${HELPERS}

half4 main(float2 xy) {
  float2 uv = xy / uSize;
  float2 tiltOff = uTilt * 0.6;

  float2 p = uv * uP3 * uScale;
  float2 q = float2(fbm(p + tiltOff), fbm(p + float2(5.2, 1.3) - tiltOff));
  float2 r = float2(
    fbm(p + uP0 * q + float2(1.7, 9.2) + tiltOff * 0.5),
    fbm(p + uP0 * q + float2(8.3, 2.8) - tiltOff * 0.5)
  );
  float v = fbm(p + uP0 * r);

  float t = v * uP1 + uTilt.x * 0.8 + uTilt.y * 0.4;
  float3 col = paletteColor(t);

  float bright = pow(v, uP2);
  col *= 0.6 + bright * 1.2;

  float spec = specular(uv);
  col += spec * 0.7;
  col += grain(xy);

  float a = uIntensity * clamp(0.35 + bright * 0.65 + spec * 0.4, 0.0, 1.0);
  return half4(col * a, a);
}
`
