import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from 'three';
import type { Side } from '../../game/coords';
import { onDispose, own } from './dispose';

const textures = new Map<string, CanvasTexture>();
const materials = new Map<string, MeshBasicMaterial>();
onDispose(() => {
  textures.clear();
  materials.clear();
});

const SIZE = 128;
// System CJK serif faces only (no webfont): macOS, then Linux / Android, then Windows.
const FONT = `700 98px 'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', 'SimSun', serif`;

/** The piece's glyph, engraved look, on a transparent 128² canvas. System CJK font, no webfont. */
export function glyphTexture(glyph: string, side: Side): CanvasTexture {
  const key = `${glyph}-${side}`;
  const hit = textures.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Centre the ink itself, not the em box: CJK faces sit their glyphs differently.
  const m = ctx.measureText(glyph);
  const x = SIZE / 2;
  const y = SIZE / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.lineJoin = 'round';
  if (side === 'w') {
    // Gold inlay cut into white jade: a dark bevel under the strokes keeps them legible on white.
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(70, 48, 12, 0.85)';
    ctx.strokeText(glyph, x + 1.5, y + 2);
    ctx.fillStyle = '#b8892e';
    ctx.fillText(glyph, x, y);
  } else {
    // A demonic rune: crimson that bleeds light into the black jade.
    ctx.shadowColor = '#ff3355';
    ctx.shadowBlur = 9;
    ctx.fillStyle = '#ff5a6e';
    ctx.fillText(glyph, x, y);
    ctx.shadowBlur = 0;
    ctx.fillText(glyph, x, y);
  }
  const tex = own(new CanvasTexture(canvas));
  tex.colorSpace = SRGBColorSpace;
  // The base is seen at a slant; anisotropic filtering keeps the strokes sharp (three clamps it).
  tex.anisotropy = 8;
  textures.set(key, tex);
  return tex;
}

/**
 * The decal material for a glyph: unlit, so the glyph reads in any arena's light, and drawn over
 * the base it lies on (polygon offset, no depth write) without z-fighting.
 */
export function glyphMaterial(glyph: string, side: Side): MeshBasicMaterial {
  const key = `${glyph}-${side}`;
  const hit = materials.get(key);
  if (hit) return hit;
  const made = own(
    new MeshBasicMaterial({
      map: glyphTexture(glyph, side),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    }),
  );
  materials.set(key, made);
  return made;
}
