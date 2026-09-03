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

  // --- scattered hairline scratches ---
  // A sparse jittered grid; each occupied cell holds ONE short scratch
  // with its own position, angle, length, and a slight bow — no shared
  // direction, so nothing reads as ruled lines. Each scratch glints only
  // when the light rakes across its own direction, so they flare one at
  // a time as the card tilts rather than in formation.
  float2 cellSize = float2(110.0, 110.0);
  float2 cellId = floor(xy / cellSize);
  for (int gy = -1; gy <= 1; gy++) {
    for (int gx = -1; gx <= 1; gx++) {
      float2 id = cellId + float2(float(gx), float(gy));
      float h0 = hash(id + uSeed);
      if (h0 > 0.42 * uScratches) continue;   // only some cells carry one
      float h1 = hash(id * 1.7 + uSeed + 11.0);
      float h2 = hash(id * 2.3 + uSeed + 23.0);
      float h3 = hash(id * 3.1 + uSeed + 37.0);

      float2 center = (id + float2(0.2 + h1 * 0.6, 0.2 + h2 * 0.6)) * cellSize;
      float ang = h3 * 6.2831;
      float2 dir = float2(cos(ang), sin(ang));
      float2 perp = float2(-dir.y, dir.x);
      float halfLen = 14.0 + h2 * 60.0;

      float2 rel = xy - center;
      float along = dot(rel, dir);
      float across = dot(rel, perp);
      // gentle bow along the length so it isn't a ruler-straight stroke
      across -= sin(along / halfLen * 1.5708) * (h3 - 0.5) * 7.0;

      float endFade = smoothstep(halfLen, halfLen * 0.55, abs(along));
      float line_ = smoothstep(1.4, 0.15, abs(across));
      // wispy: brightness varies along the scratch
      float wisp = 0.55 + 0.45 * vnoise(float2(along * 0.09, h0 * 61.0));

      float alignment = abs(dot(perp, lightDir));
      float glint = pow(alignment, 10.0);

      glow += line_ * endFade * glint * wisp * 1.15;
    }
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
