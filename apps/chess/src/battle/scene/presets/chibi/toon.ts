import {
  BackSide,
  Color,
  DataTexture,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
} from 'three';
import { onDispose, own } from '../../dispose';

// The chibi figures' three materials, shared by every chibi piece: the toon body (part colours
// baked as vertex colours), the ink outline (one per ink colour) and the unlit accents.

let gradient: DataTexture | null = null;
let toon: MeshToonMaterial | null = null;
let accent: MeshBasicMaterial | null = null;
const outlines = new Map<string, MeshBasicMaterial>();
onDispose(() => {
  gradient = null;
  toon = null;
  accent = null;
  outlines.clear();
});

/** Three flat light bands — the cel look. */
function toonGradient(): DataTexture {
  if (!gradient) {
    gradient = own(new DataTexture(new Uint8Array([90, 175, 255]), 3, 1, RedFormat));
    gradient.minFilter = gradient.magFilter = NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/**
 * GLSL run right after three's emissive map (`normal`, view space, and `vViewPosition` in scope),
 * the figurine's own light on top of the arena's: an even fill of its own colours, since the
 * pieces have no environment light and every arena's key light stands behind white's pieces
 * (their faces would sit in the darkest band); and a soft sheen at the silhouette, so a black
 * figure still shows its shape on a dark board. Both add the same to every band: the cel steps stay.
 */
export const FIGURINE_GLSL = /* glsl */ `
  float figNV = saturate( dot( normalize( vViewPosition ), normal ) );
  totalEmissiveRadiance += diffuseColor.rgb * FIG_FILL + vec3( FIG_SHEEN ) * pow( 1.0 - figNV, 3.0 );`;

const FIG_FILL = 0.22;
const FIG_SHEEN = 0.2;

export function toonMaterial(): MeshToonMaterial {
  if (!toon) {
    toon = own(new MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() }));
    toon.defines = { FIG_FILL: FIG_FILL.toFixed(3), FIG_SHEEN: FIG_SHEEN.toFixed(3) };
    toon.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${FIGURINE_GLSL}`,
      );
    };
  }
  return toon;
}

/** The inverted hull's material: back faces only, so it shows as a rim round the figure. */
export function outlineMaterial(ink: string): MeshBasicMaterial {
  let m = outlines.get(ink);
  if (!m) {
    m = own(new MeshBasicMaterial({ color: new Color(ink), side: BackSide }));
    outlines.set(ink, m);
  }
  return m;
}

export function accentMaterial(): MeshBasicMaterial {
  accent ??= own(new MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  return accent;
}
