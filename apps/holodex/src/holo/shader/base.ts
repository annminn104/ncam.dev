export const VERTEX_SHADER = /* glsl */ `
out vec2 vUv;
void main() {
  // three.js's PlaneGeometry emits uv.y = 1 at the top (uv.y points up —
  // PlaneGeometry.js pushes 1 - (iy / gridY)), but everything downstream of
  // vUv is authored in y-down card space: the clip insets and stage cut-out
  // in regions.ts, every effect's fromTop offset, and the CSS-derived
  // gradients they all come from. Flip once here so vUv matches that
  // convention everywhere else it's consumed, instead of leaving every
  // consumer to re-derive (or silently disagree about) the flip.
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Everything every effect shares: the varyings, the clip uniforms, and the
 * coverage function. The coverage maths mirrors `coversPoint` in ../regions.ts
 * exactly — that function is its tested twin.
 */
export const baseGLSL = /* glsl */ `
in vec2 vUv;
out vec4 fragColor;

uniform vec4 uClipRect;   // top, right, bottom, left, as fractions
uniform vec4 uCutA;       // boxes cut out of it (regions.ts's cutsFor):
uniform vec4 uCutB;       // x0, y0, x1, y1, all zeros for none
uniform vec4 uCutC;
uniform vec4 uBorder;     // the border's inner edge, as uClipRect, when the
                          // foil covers the border too; all zeros for none
uniform vec2 uBorderRound; // its corners' radii, x of the card's width and y
                          // of its height (regions.ts's BORDER_ROUND); zeros for none
uniform float uInvert;    // 1.0 for reverse holo
uniform float uCardOpacity;

/**
 * Whether uv lies in a cut box: x0 <= x < x1 and y0 <= y < y1, matching
 * coversPoint's comparisons. step(edge, v) is v >= edge, so 1.0 - step(edge,
 * v) is v < edge. A box of zeros holds no point.
 */
float inBox(vec2 uv, vec4 box) {
  return step(box.x, uv.x) * (1.0 - step(box.z, uv.x)) * step(box.y, uv.y) * (1.0 - step(box.w, uv.y));
}

/**
 * Whether the foil reaches this fragment. uv.y runs down the card — true
 * because the vertex shader above flips three.js's y-up uv before vUv ever
 * reaches here.
 */
float coverage(vec2 uv) {
  float inside = step(uClipRect.w, uv.x)
               * step(uv.x, 1.0 - uClipRect.y)
               * step(uClipRect.x, uv.y)
               * step(uv.y, 1.0 - uClipRect.z);
  inside *= (1.0 - inBox(uv, uCutA)) * (1.0 - inBox(uv, uCutB)) * (1.0 - inBox(uv, uCutC));
  // The card's border, everything outside uBorder's rect with its corners
  // rounded by uBorderRound: none when both are all zeros, a plain rect that
  // holds the whole card. How far into a corner's radii uv lies, each 0
  // outside its corner and past 1 beyond the arc.
  float cornerX = max(max(uBorder.w + uBorderRound.x - uv.x, uv.x - (1.0 - uBorder.y - uBorderRound.x)), 0.0) / max(uBorderRound.x, 1e-6);
  float cornerY = max(max(uBorder.x + uBorderRound.y - uv.y, uv.y - (1.0 - uBorder.z - uBorderRound.y)), 0.0) / max(uBorderRound.y, 1e-6);
  float border = 1.0 - step(uBorder.w, uv.x)
                     * step(uv.x, 1.0 - uBorder.y)
                     * step(uBorder.x, uv.y)
                     * step(uv.y, 1.0 - uBorder.z)
                     * step(cornerX * cornerX + cornerY * cornerY, 1.0);
  inside = max(inside, border);

  return mix(inside, 1.0 - inside, uInvert);
}

/**
 * Whether uv lies inside an inset rect: (top, right, bottom, left) as
 * fractions, an element's own clip (types.ts's Element.clip), which the
 * compiler writes in from regions.ts. The same comparisons as coverage()'s
 * rect test above, so coversPoint is this one's tested twin as well.
 */
float insideRect(vec2 uv, vec4 inset) {
  return step(inset.w, uv.x) * step(uv.x, 1.0 - inset.y) * step(inset.x, uv.y) * step(uv.y, 1.0 - inset.z);
}
`;
