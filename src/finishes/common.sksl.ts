// Shared SkSL for all finish families: uniform block, palette, specular,
// grain, and noise helpers. Each family shader is UNIFORMS + HELPERS + its body.
// (Shader sources live in *.sksl.ts so Metro can bundle them without a
// custom transformer; the .sksl infix marks them as shader files per CLAUDE.md §12.)

/**
 * Uniform interface shared by every family. uColorCount == 0 means rainbow
 * palette mode; otherwise uColors[0..uColorCount) are cycled.
 * uP0..uP3 are family-specific params (documented per family).
 */
export const UNIFORMS = `
uniform float2 uSize;
uniform float2 uTilt;
uniform float2 uLight;
uniform float  uIntensity;
uniform float  uScale;
uniform float  uColorCount;
uniform half4  uColors[6];
uniform float  uP0;
uniform float  uP1;
uniform float  uP2;
uniform float  uP3;
uniform float  uMode;
`

export const HELPERS = `
float hash21(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float2 hash22(float2 p) {
  float n = hash21(p);
  return float2(n, hash21(p + n + 17.17));
}

// value noise
float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + float2(1.0, 0.0));
  float c = hash21(i + float2(0.0, 1.0));
  float d = hash21(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + float2(11.5, 7.7);
    amp *= 0.5;
  }
  return v;
}

float3 hueRamp(float t) {
  t = fract(t);
  float3 c = clamp(abs(fract(t + float3(0.0, 0.6666, 0.3333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return c * c * (3.0 - 2.0 * c); // smoothed rainbow
}

// Palette band: rainbow, or the card's pinned colors cycled smoothly.
// Constant-index loop instead of dynamic array indexing for GLES2 devices.
float3 paletteColor(float t) {
  if (uColorCount < 0.5) return hueRamp(t);
  float n = uColorCount;
  float x = fract(t) * n;
  float j0 = mod(floor(x), n);
  float j1 = mod(floor(x) + 1.0, n);
  float3 c0 = uColors[0].rgb;
  float3 c1 = uColors[0].rgb;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (abs(fi - j0) < 0.5) c0 = uColors[i].rgb;
    if (abs(fi - j1) < 0.5) c1 = uColors[i].rgb;
  }
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(c0, c1, f);
}

// Soft specular glare following the virtual light (composition step 3).
float specular(float2 uv) {
  float d = distance(uv, uLight);
  float glare = exp(-d * d * 6.0);
  float band = exp(-pow((uv.x - uv.y) - (uLight.x - uLight.y), 2.0) * 10.0);
  return glare * 0.75 + band * 0.25;
}

// Fine fixed grain (~3%) to kill the "too clean" look (composition step 4).
float grain(float2 xy) {
  return (hash21(floor(xy * 0.9)) - 0.5) * 0.06;
}
`

export type FinishUniforms = {
  uSize: [number, number]
  uTilt: [number, number]
  uLight: [number, number]
  uIntensity: number
  uScale: number
  uColorCount: number
  uColors: number[] // 6 * rgba, flattened
  uP0: number
  uP1: number
  uP2: number
  uP3: number
  /** family-specific pattern variant (geometric: 0 voronoi, 1 circles, 2 bismuth) */
  uMode: number
}
