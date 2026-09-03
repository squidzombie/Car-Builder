// Soft rounded bevel for embossed layers (design pass, item 6). Runs as a
// runtime-shader IMAGE FILTER over the layer's own rendering: the slope of
// the layer's alpha near its edge is the surface normal of a rounded
// bevel, which is lit by the virtual light. Everything happens inside the
// silhouette — nothing is drawn outside it — so tight letterforms stay
// crisp (the old offset-duplicate emboss haloed on them). Inset is the
// same math with the light direction flipped (uFlip = -1).
//
// uniforms: image (the layer), uLight unit direction the light TRAVELS in
// screen space, uRadius bevel width px, uStrength 0..1, uFlip ±1.

export const BEVEL_SKSL = `
uniform shader image;
uniform float2 uLight;
uniform float  uRadius;
uniform float  uStrength;
uniform float  uFlip;

half4 main(float2 xy) {
  half4 c = image.eval(xy);
  if (c.a < 0.004) return c;

  // alpha gradient from taps at r and r/2 on the axes and diagonals —
  // the multi-radius mix is what rounds the profile instead of a hard chamfer
  float r = uRadius;
  float d = r * 0.7071;
  float ax = image.eval(xy + float2(r, 0.0)).a - image.eval(xy - float2(r, 0.0)).a;
  float ay = image.eval(xy + float2(0.0, r)).a - image.eval(xy - float2(0.0, r)).a;
  ax += image.eval(xy + float2(r * 0.5, 0.0)).a - image.eval(xy - float2(r * 0.5, 0.0)).a;
  ay += image.eval(xy + float2(0.0, r * 0.5)).a - image.eval(xy - float2(0.0, r * 0.5)).a;
  float a1 = image.eval(xy + float2(d, d)).a - image.eval(xy - float2(d, d)).a;
  float a2 = image.eval(xy + float2(d, -d)).a - image.eval(xy - float2(d, -d)).a;
  ax += (a1 + a2) * 0.7071;
  ay += (a1 - a2) * 0.7071;

  float2 g = float2(ax, ay) * 0.25;   // points inward (toward higher alpha)
  float slope = length(g);
  if (slope < 0.002) return c;         // flat interior: untouched
  float2 n = g / slope;

  // an edge whose outward normal faces the light catches it
  float lit = dot(n, uLight) * uFlip;
  float prof = smoothstep(0.0, 0.6, slope);
  float hi = max(lit, 0.0) * prof;
  float sh = max(-lit, 0.0) * prof;
  float spec = pow(max(lit, 0.0), 6.0) * prof;

  float3 rgb = float3(c.rgb);
  rgb += float(c.a) * (hi * 0.55 + spec * 0.45) * uStrength;
  rgb *= 1.0 - sh * 0.62 * uStrength;
  rgb = min(rgb, float3(float(c.a)));   // keep premultiplied alpha valid
  return half4(half3(rgb), c.a);
}
`
