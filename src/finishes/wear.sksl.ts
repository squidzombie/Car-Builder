// Card-condition wear overlay (Build 4). Drawn over the finished card,
// inside its clip. Hairline scratches glint only when the virtual light
// sweeps across their direction; edges whiten; corners scuff. All wear is
// deterministic (uSeed) so a card always wears the same way.
//
// uniforms: uSize card px, uTilt/-1..1, uLight 0..1 virtual light,
// uAmount master 0..1, uScratches / uEdge / uCorner per-preset dials,
// uSeed variation.

export const WEAR_SKSL = `
uniform float2 uSize;
uniform float2 uTilt;
uniform float2 uLight;
uniform float  uAmount;
uniform float  uScratches;
uniform float  uEdge;
uniform float  uCorner;
uniform float  uSeed;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

half4 main(float2 xy) {
  float glow = 0.0;   // white wear (whitening, glinting scratches)
  float scuff = 0.0;  // dark surface scuffing

  float2 lightDir = float2(uLight.x - 0.5, uLight.y - 0.35);
  float llen = length(lightDir);
  lightDir = llen > 0.03 ? lightDir / llen : float2(0.6, 0.8);

  // --- hairline scratches: four directional families of short segments ---
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float ang = hash(float2(fk + 1.0, uSeed)) * 6.2831;
    float2 dir = float2(cos(ang), sin(ang));
    float2 perp = float2(-dir.y, dir.x);

    float spacing = 60.0 + 110.0 * hash(float2(fk, uSeed + 3.0));
    // slight waviness so scratches don't read as ruled lines
    float across = dot(xy, perp) / spacing + (vnoise(xy / 41.0 + fk) - 0.5) * 0.08;
    float cell = floor(across);
    float h = hash(float2(cell, fk * 7.0 + uSeed));

    // only some lanes carry a scratch
    float lane = step(h, 0.22 * uScratches);
    float f = abs(fract(across) - 0.5) * spacing;
    float line_ = smoothstep(1.5, 0.2, f);

    // short segments, not edge-to-edge lines
    float along = dot(xy, dir) / (90.0 + 180.0 * h) + h * 37.0;
    float fa = fract(along);
    float seg = smoothstep(0.04, 0.14, fa) * smoothstep(0.58, 0.42, fa);

    // strictly light-gated: a scratch is invisible until the light
    // sweeps across its direction, then it flares briefly — a constant
    // baseline made them read as drawn-on
    float alignment = abs(dot(perp, lightDir));
    float glint = pow(alignment, 10.0);

    glow += lane * line_ * seg * glint * 1.1;
  }

  // --- edge whitening ---
  float m = min(min(xy.x, uSize.x - xy.x), min(xy.y, uSize.y - xy.y));
  float edgeBand = smoothstep(26.0, 2.0, m);
  float edgeNoise = vnoise(xy / 11.0 + uSeed) * 0.65 + vnoise(xy / 3.0 + uSeed) * 0.35;
  glow += edgeBand * pow(edgeNoise, 1.6) * uEdge * 1.1;

  // --- corner scuffs ---
  float2 c1 = float2(0.0, 0.0);
  float2 c2 = float2(uSize.x, 0.0);
  float2 c3 = float2(0.0, uSize.y);
  float2 c4 = uSize;
  float dc = min(min(distance(xy, c1), distance(xy, c2)),
                 min(distance(xy, c3), distance(xy, c4)));
  float cornerBand = smoothstep(95.0, 8.0, dc);
  scuff += cornerBand * vnoise(xy / 7.0 + uSeed * 2.0) * uCorner * 0.5;

  // --- faint all-over surface haze on heavier wear ---
  scuff += vnoise(xy / 2.2 + uSeed) * 0.05 * uCorner;

  glow = min(glow, 1.0) * uAmount;
  scuff = min(scuff, 1.0) * uAmount;

  float3 color = float3(0.93, 0.93, 0.90) * glow + float3(0.05, 0.04, 0.04) * scuff;
  float a = min(glow * 0.85 + scuff * 0.55, 1.0);
  return half4(half3(color), half(a));
}
`
