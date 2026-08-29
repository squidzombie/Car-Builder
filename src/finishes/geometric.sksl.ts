import { UNIFORMS, HELPERS } from './common.sksl'

// Geometric family: Voronoi / faceted cells, each with its own hue offset and
// specular. Presets: cracked ice, mosaic, prizm facets, disco.
// uP0 = edge brightness (cracked-ice white seams)
// uP1 = per-cell hue spread
// uP2 = cell specular strength
// uP3 = cell density

export const GEOMETRIC_SKSL = `
${UNIFORMS}
${HELPERS}

half4 main(float2 xy) {
  float2 uv = xy / uSize;
  float phase = uTilt.x * 1.2 + uTilt.y * 0.9;

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

  // Each facet catches the rainbow at its own angle.
  float3 col = paletteColor(cellRand * uP1 + phase + uv.x * 0.3);

  // Per-cell specular: facets flash as tilt sweeps past their random normal.
  float flash = pow(max(0.0, sin(cellRand * 6.2831 + phase * 3.0)), 4.0) * uP2;
  col += flash;

  // Bright seams between cells (cracked ice).
  float seam = smoothstep(0.10, 0.0, edge) * uP0;
  col += seam;

  float spec = specular(uv);
  col += spec * 0.6;
  col += grain(xy);

  float a = uIntensity * clamp(0.5 + flash * 0.5 + seam * 0.6 + spec * 0.4, 0.0, 1.0);
  return half4(col * a, a);
}
`
