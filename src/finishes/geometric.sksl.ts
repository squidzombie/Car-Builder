import { UNIFORMS, HELPERS } from './common.sksl'

// Geometric family: faceted patterns, each cell/element with its own hue
// offset and specular. Presets: cracked ice, mosaic, prizm facets, disco
// (voronoi, uMode 0), circles (overlapping ring lattice like the classic
// Prizm "circles" foil, uMode 1), bismuth (stepped rectilinear hoppers
// like bismuth crystal growth, uMode 2).
// uP0 = edge/line brightness
// uP1 = per-cell hue spread
// uP2 = cell specular strength
// uP3 = pattern density

export const GEOMETRIC_SKSL = `
${UNIFORMS}
${HELPERS}

half4 main(float2 xy) {
  float2 uv = xy / uSize;
  float phase = uTilt.x * 1.2 + uTilt.y * 0.9;

  float aspect = uSize.x / uSize.y;
  float3 col = float3(0.0);
  float energy = 0.0; // drives alpha alongside specular

  if (uMode > 1.5) {
    // --- bismuth: jittered stepped square hoppers ---
    float2 p = uv * float2(aspect, 1.0) * uP3 * uScale;
    float2 cell = floor(p);
    float2 f = fract(p) - 0.5;
    float2 jit = (hash22(cell) - 0.5) * 0.4;
    f -= jit;
    float cellRand = hash21(cell);

    float d = max(abs(f.x), abs(f.y)) * 2.0;          // chebyshev: square rings
    float steps_ = 4.0 + floor(cellRand * 3.0);
    float q = d * steps_;
    float ring = floor(q);

    // terraced hue steps per ring, hopper-tinted per cell
    col = paletteColor(cellRand * uP1 + ring * 0.11 + phase);

    // thin bright seam at each terrace boundary
    float toEdge = 0.5 - abs(fract(q) - 0.5);
    float seam = smoothstep(0.10, 0.0, toEdge) * uP0;
    col = col * (0.55 + 0.45 * smoothstep(0.0, 0.25, toEdge)); // shade terrace walls
    col += seam;

    float flash = pow(max(0.0, sin(cellRand * 6.2831 + ring + phase * 3.0)), 4.0) * uP2;
    col += flash;
    energy = flash * 0.5 + seam * 0.6;
  } else if (uMode > 0.5) {
    // --- circles: overlapping ring lattice (flower-of-life foil) ---
    float2 p = uv * float2(aspect, 1.0) * uP3 * uScale;
    float glow = 0.0;
    for (int gy = -1; gy <= 1; gy++) {
      for (int gx = -1; gx <= 1; gx++) {
        float2 base = floor(p) + float2(float(gx), float(gy));
        float2 center = base + 0.5;
        center.x += mod(base.y, 2.0) * 0.5;
        float r = distance(p, center);
        for (int k = 0; k < 2; k++) {
          float R = 0.42 + float(k) * 0.33;
          float line_ = smoothstep(0.045, 0.0, abs(r - R));
          if (line_ > 0.001) {
            float hue = hash21(base + float(k) * 13.7) * uP1 + phase + r * 0.4;
            float ang = atan(p.y - center.y, p.x - center.x);
            float glint = 0.35 + 0.65 * pow(abs(sin(ang + phase * 2.5 + float(k) * 1.7)), 3.0);
            col += paletteColor(hue) * line_ * glint;
            glow += line_ * glint;
          }
        }
      }
    }
    col += glow * 0.15;
    energy = min(glow, 1.2) * uP0 * 0.8;
  } else {
    // --- voronoi facets (cracked ice / mosaic / prizm / disco) ---
    float2 p = uv * uP3 * uScale;
    float2 cell = floor(p);
    float2 f = fract(p);

    float d1 = 8.0; float d2 = 8.0;
    float2 bestId = float2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        float2 g = float2(float(x), float(y));
        float2 o = hash22(cell + g);
        float2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; bestId = cell + g; }
        else if (d < d2) { d2 = d; }
      }
    }

    float edge = sqrt(d2) - sqrt(d1); // 0 at cell borders
    float cellRand = hash21(bestId);

    col = paletteColor(cellRand * uP1 + phase + uv.x * 0.3);

    float flash = pow(max(0.0, sin(cellRand * 6.2831 + phase * 3.0)), 4.0) * uP2;
    col += flash;

    float seam = smoothstep(0.10, 0.0, edge) * uP0;
    col += seam;
    energy = flash * 0.5 + seam * 0.6;
  }

  float spec = specular(uv);
  col += spec * 0.6;
  col += grain(xy);

  float a = uIntensity * clamp(0.5 + energy + spec * 0.4, 0.0, 1.0);
  return half4(col * a, a);
}
`
