import { type BufferGeometry, CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { onDispose, own } from '../../dispose';
import { FACE_SPAN, faceCap } from './rig';
import type { FaceStyle, Frame, Palette } from './types';

// The chibi faces: decals painted on a canvas (browser only) and laid on the front of the head
// (rig.ts's faceCap). Everything is drawn in degrees on the head — x round it, toward the owner's
// right, y down it, (0, 0) the front of the head's equator — so an eye drawn round stays round
// once the canvas is stretched over the cap's 110° × 80°.

const SIZE = 256;

interface Pair<T> {
  open: T;
  closed: T;
}

const textures = new Map<string, Pair<CanvasTexture>>();
const materials = new Map<string, Pair<MeshBasicMaterial>>();
onDispose(() => {
  textures.clear();
  materials.clear();
});

const keyOf = (style: FaceStyle, p: Palette) => `${style}|${p.eyes}|${p.skin}|${p.ink}|${p.glow}`;

// ── Colour helpers (sRGB, as the canvas paints) ──────────────────────────────────────────────

/** '#rrggbb' or '#rgb' as 0–255 channels. */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `a` mixed toward `b` by `t`, as a CSS colour with alpha `alpha`. */
function mix(a: string, b: string, t: number, alpha = 1): string {
  const x = rgb(a);
  const y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

const BLACK = '#000000';
const WHITE = '#ffffff';

function canvas(): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  g.setTransform(SIZE / FACE_SPAN.x, 0, 0, SIZE / FACE_SPAN.y, SIZE / 2, SIZE / 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  return { c, g };
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

// ── Anime ─────────────────────────────────────────────────────────────────────────────────

/** Eye centres (degrees): 0.42 of the canvas apart, at 0.55 of its height; half-size of an eye. */
const EYE = { x: 0.21 * FACE_SPAN.x, y: 0.05 * FACE_SPAN.y, w: 9.2, h: 11.6 };

/**
 * One big anime eye at (x, y); `m` is +1 for the eye on the owner's right (its outer corner toward
 * +x). Sclera, an iris dark under the lid and bright below, the pupil, the heavy upper lash line
 * with its flick, and two highlights that both face the same light (upper left).
 */
function animeEye(g: CanvasRenderingContext2D, x: number, y: number, m: 1 | -1, p: Palette) {
  const { w, h } = EYE;
  // Sclera, a little narrower at the top, where the lash line covers it; a fine ink line under it.
  g.fillStyle = WHITE;
  ellipse(g, x, y + 0.6, w * 0.98, h * 0.94);
  g.fill();
  g.strokeStyle = mix(p.ink, p.skin, 0.3, 0.7);
  g.lineWidth = 0.55;
  g.beginPath();
  g.ellipse(x, y + 0.6, w * 0.98, h * 0.94, 0, 0.15, Math.PI - 0.15);
  g.stroke();
  // Iris: a radial gradient from the eye colour, lit low in the eye, to a darker shade at its rim,
  // the upper lid's shadow across its top.
  const ix = x + m * 0.4;
  const iy = y + 1.1;
  const rx = w * 0.8;
  const ry = h * 0.9;
  const iris = g.createRadialGradient(ix, iy + ry * 0.4, 0, ix, iy + ry * 0.1, ry * 1.05);
  iris.addColorStop(0, mix(p.eyes, WHITE, 0.4));
  iris.addColorStop(0.42, p.eyes);
  iris.addColorStop(1, mix(p.eyes, BLACK, 0.6));
  g.fillStyle = iris;
  ellipse(g, ix, iy, rx, ry);
  g.fill();
  g.save();
  g.clip();
  const lid = g.createLinearGradient(0, iy - ry, 0, iy + ry * 0.1);
  lid.addColorStop(0, mix(p.eyes, BLACK, 0.78, 0.95));
  lid.addColorStop(1, mix(p.eyes, BLACK, 0.78, 0));
  g.fillStyle = lid;
  g.fillRect(ix - rx, iy - ry, rx * 2, ry * 1.1);
  g.restore();
  g.lineWidth = 0.9;
  g.strokeStyle = mix(p.eyes, BLACK, 0.65);
  ellipse(g, ix, iy, rx, ry);
  g.stroke();
  // Pupil, and the soft glow of light low in the iris.
  g.fillStyle = mix(p.eyes, BLACK, 0.82);
  ellipse(g, ix, y + 0.2, w * 0.34, h * 0.42);
  g.fill();
  g.fillStyle = mix(p.eyes, WHITE, 0.6, 0.7);
  ellipse(g, ix, y + h * 0.62, w * 0.46, h * 0.18);
  g.fill();
  // The upper lash line: a heavy crescent over the eye, thickest at its outer corner, flicked up.
  g.fillStyle = p.ink;
  g.beginPath();
  g.moveTo(x - m * w * 1.06, y - h * 0.3);
  g.quadraticCurveTo(x - m * w * 0.25, y - h * 1.32, x + m * w * 1.12, y - h * 0.66);
  g.lineTo(x + m * w * 1.46, y - h * 0.86);
  g.lineTo(x + m * w * 1.08, y - h * 0.38);
  g.quadraticCurveTo(x - m * w * 0.1, y - h * 1.02, x - m * w * 0.96, y - h * 0.2);
  g.closePath();
  g.fill();
  // A short lower lash at the outer corner.
  g.strokeStyle = mix(p.ink, p.skin, 0.25);
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(x + m * w * 0.25, y + h * 1.0);
  g.quadraticCurveTo(x + m * w * 0.8, y + h * 0.92, x + m * w * 0.98, y + h * 0.62);
  g.stroke();
  // Highlights: a big one up left, a small one down right (the same in both eyes).
  g.fillStyle = WHITE;
  ellipse(g, x - w * 0.3, y - h * 0.3, w * 0.3, h * 0.26);
  g.fill();
  ellipse(g, x + w * 0.32, y + h * 0.42, w * 0.13, h * 0.1);
  g.fill();
}

/** Closed: the lash line drawn down into a smile-curve, its outer flick kept. */
function closedEye(g: CanvasRenderingContext2D, x: number, y: number, m: 1 | -1, p: Palette) {
  const { w, h } = EYE;
  g.strokeStyle = p.ink;
  g.lineWidth = 2.1;
  g.beginPath();
  g.moveTo(x - m * w * 1.0, y + h * 0.05);
  g.quadraticCurveTo(x + m * w * 0.05, y + h * 0.62, x + m * w * 1.1, y);
  g.lineTo(x + m * w * 1.36, y - h * 0.2);
  g.stroke();
}

function animeFace(g: CanvasRenderingContext2D, p: Palette, closed: boolean) {
  // Blush under the eyes, soft.
  g.fillStyle = mix(p.skin, '#ff4f6e', 0.75, 0.25);
  for (const m of [-1, 1]) {
    ellipse(g, m * 29, 17, 6.5, 2.8);
    g.fill();
  }
  // Brows, thin, high under the fringe.
  g.strokeStyle = mix(p.ink, p.skin, 0.2, 0.85);
  g.lineWidth = 0.9;
  for (const m of [-1, 1] as const) {
    g.beginPath();
    g.moveTo(m * 15.5, -11.5);
    g.quadraticCurveTo(m * 21, -14.2, m * 27.5, -12.6);
    g.stroke();
  }
  for (const m of [-1, 1] as const) {
    if (closed) closedEye(g, m * EYE.x, EYE.y, m, p);
    else animeEye(g, m * EYE.x, EYE.y, m, p);
  }
  // A small smile.
  g.strokeStyle = mix(p.ink, '#b0485a', 0.45);
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(-2.8, 24.5);
  g.quadraticCurveTo(0, 27.6, 2.8, 24.5);
  g.stroke();
}

// ── Skull ─────────────────────────────────────────────────────────────────────────────────

/** A skull on bone (`skin`): deep sockets slanting in to a scowl, embers for pupils, teeth. */
function skullFace(g: CanvasRenderingContext2D, p: Palette, closed: boolean) {
  const hollow = mix(p.ink, BLACK, 0.5);
  g.fillStyle = hollow;
  for (const m of [-1, 1] as const) {
    g.beginPath();
    g.moveTo(m * 8, -2);
    g.quadraticCurveTo(m * 18, -8, m * 30, -9.5);
    g.quadraticCurveTo(m * 34, 2, m * 28, 12);
    g.quadraticCurveTo(m * 18, 16, m * 10, 11);
    g.quadraticCurveTo(m * 6, 5, m * 8, -2);
    g.fill();
    // A crack running up from the socket's outer corner.
    g.strokeStyle = mix(p.skin, p.ink, 0.6);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(m * 27, -9);
    g.lineTo(m * 25, -16);
    g.lineTo(m * 28, -22);
    g.stroke();
  }
  // Ember pupils: a hot core in a glow that fades into the socket.
  for (const m of [-1, 1] as const) {
    const cx = m * 19;
    const cy = 3;
    const r = closed ? 3.2 : 6.5;
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, mix(p.glow, WHITE, 0.6, closed ? 0.6 : 1));
    glow.addColorStop(0.35, mix(p.glow, WHITE, 0, closed ? 0.5 : 0.95));
    glow.addColorStop(1, mix(p.glow, BLACK, 0.3, 0));
    g.fillStyle = glow;
    ellipse(g, cx, cy, r, r * 1.1);
    g.fill();
  }
  // The nose's hollow.
  g.fillStyle = hollow;
  g.beginPath();
  g.moveTo(0, 13);
  g.lineTo(-3.4, 21);
  g.lineTo(0, 19.6);
  g.lineTo(3.4, 21);
  g.closePath();
  g.fill();
  // Teeth: a jaw line crossed by the gaps between them.
  g.strokeStyle = hollow;
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(-12, 29.5);
  g.quadraticCurveTo(0, 31.5, 12, 29.5);
  g.stroke();
  g.lineWidth = 0.8;
  for (const x of [-10, -6, -2, 2, 6, 10]) {
    g.beginPath();
    g.moveTo(x, 27);
    g.lineTo(x * 1.02, 33.5);
    g.stroke();
  }
}

// ── Visor ─────────────────────────────────────────────────────────────────────────────────

/** A helm's front: the eye slit with a faint line of light in it, the breathing slot below. */
function visorFace(g: CanvasRenderingContext2D, p: Palette) {
  const slot = mix(p.ink, BLACK, 0.4);
  g.fillStyle = slot;
  g.beginPath();
  g.moveTo(-38, -3.5);
  g.lineTo(38, -3.5);
  g.lineTo(36, 4);
  g.lineTo(-36, 4);
  g.closePath();
  g.fill();
  g.shadowColor = p.glow;
  g.shadowBlur = 6;
  g.fillStyle = mix(p.glow, WHITE, 0.3, 0.75);
  g.fillRect(-30, -0.2, 60, 1.4);
  g.shadowBlur = 0;
  g.fillStyle = slot;
  g.fillRect(-1.3, 9, 2.6, 15);
  for (const x of [-6, 6]) {
    for (const y of [12, 17, 22]) {
      ellipse(g, x, y, 1.1, 1.1);
      g.fill();
    }
  }
}

function paintFace(style: FaceStyle, p: Palette, closed: boolean): CanvasTexture {
  const { c, g } = canvas();
  if (style === 'anime') animeFace(g, p, closed);
  else if (style === 'skull') skullFace(g, p, closed);
  else visorFace(g, p);
  const tex = own(new CanvasTexture(c));
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The face's two textures: eyes open, and closed for a blink (a visor has the one). Cached. */
export function faceTextures(style: FaceStyle, palette: Palette): Pair<CanvasTexture> {
  const key = keyOf(style, palette);
  let hit = textures.get(key);
  if (!hit) {
    const open = paintFace(style, palette, false);
    hit = { open, closed: style === 'visor' ? open : paintFace(style, palette, true) };
    textures.set(key, hit);
  }
  return hit;
}

/**
 * Unlit decal materials over the head's skin: the eyes read in any arena's light (as the base's
 * glyph does), drawn after the opaque figure without writing depth, a nudge of polygon offset
 * keeping them in front of the head they lie on. Cached.
 */
export function faceMaterials(style: FaceStyle, palette: Palette): Pair<MeshBasicMaterial> {
  const key = keyOf(style, palette);
  let hit = materials.get(key);
  if (!hit) {
    const t = faceTextures(style, palette);
    const make = (map: CanvasTexture) =>
      own(
        new MeshBasicMaterial({
          map,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -2,
          toneMapped: false,
        }),
      );
    const open = make(t.open);
    hit = { open, closed: t.closed === t.open ? open : make(t.closed) };
    materials.set(key, hit);
  }
  return hit;
}

/** The face's cap on the head's front, at its place in piece space. A new geometry: the caller owns it. */
export function faceGeometry(frame: Frame): BufferGeometry {
  return faceCap(frame);
}
