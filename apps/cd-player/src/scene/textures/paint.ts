import { CanvasTexture, SRGBColorSpace } from 'three';
import type { TrackView } from '../../bridge';
import type { Status } from '../../playback/sequencer';
import { arcLayout, coverCrop, fitText, lcdDigits, SEGMENTS, segmentRects } from './layout';

const DISPLAY = "'Fraunces Variable', Georgia, serif";
const UI = "'Manrope Variable', Arial, sans-serif";
const BLUSH = '#e296a4';
const CREAM = '#f7eef0';
const INK = '#2a1f24';
const LCD_ON = '#9eeeff';
const LCD_GHOST = 'rgba(158, 238, 255, 0.08)';

// The three faces the prints draw with. Canvas text never asks the page for a font, so loadFaces
// has them loaded before a print uses them; a face is picked by family, weight and style, so the
// size it is loaded at does not matter.
const title = (px: number) => `italic 500 ${px}px ${DISPLAY}`;
const semibold = (px: number) => `600 ${px}px ${UI}`;
const bold = (px: number) => `700 ${px}px ${UI}`;
const FACES = [title(16), semibold(16), bold(16)];

/**
 * Loads the faces the prints draw with, for the characters of `text` (by default the Latin
 * subset, as the page's fonts come in subsets): one the page has not used yet would otherwise print
 * in Georgia or Arial. Settles whether they load or not, and where there is no font loading.
 */
export async function loadFaces(text?: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    FACES.map((face) => document.fonts.load(face, text || undefined).catch(() => [])),
  );
}

export function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** The canvas's top row is the print's top: glTF UVs, so flipY stays off (as GLTFLoader's maps). */
export function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 8;
  return texture;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');
  return ctx;
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number): void {
  const crop = coverCrop(image.naturalWidth, image.naturalHeight, w, h);
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
}

function blushGradient(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, CREAM);
  gradient.addColorStop(1, BLUSH);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/** `text`, or as much of it as fits `max` px in the font the context has now. */
function fitted(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  return fitText((s) => ctx.measureText(s).width, text, max);
}

/** The disc's label: the artist's photo, a darkened rim and the title and artist printed round it. */
export function paintDisc(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  view: TrackView | null,
): void {
  const ctx = context(canvas);
  const size = canvas.width;
  const r = size / 2;
  ctx.clearRect(0, 0, size, size);
  if (image) {
    cover(ctx, image, size, size);
  } else {
    const gradient = ctx.createRadialGradient(r, r, r * 0.3, r, r, r);
    gradient.addColorStop(0, CREAM);
    gradient.addColorStop(1, BLUSH);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    for (let ring = r * 0.42; ring < r * 0.98; ring += r * 0.035) {
      ctx.beginPath();
      ctx.arc(r, r, ring, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = title(Math.round(size * 0.09));
    ctx.fillText('ncam', r, r * 0.6);
    ctx.font = bold(Math.round(size * 0.026));
    ctx.fillText('CD·01  ·  COMPACT DISC', r, r * 1.45);
  }
  const rim = ctx.createRadialGradient(r, r, r * 0.72, r, r, r);
  rim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rim.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);
  const text = (
    view ? `${view.title}  ·  ${view.artists}` : 'ncam  ·  CD player  ·  side A'
  ).toUpperCase();
  const radius = r * 0.9;
  ctx.font = bold(Math.round(size * 0.027));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...fitted(ctx, text, Math.PI * radius * 0.8)];
  const widths = chars.map((char) => ctx.measureText(char).width);
  for (const { char, angle } of arcLayout(chars, widths, radius, 0, size * 0.003)) {
    ctx.save();
    ctx.translate(r + Math.sin(angle) * radius, r - Math.cos(angle) * radius);
    ctx.rotate(angle);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
}

/** The booklet behind the case's lid: the album art, or the page's own cover before any art. */
export function paintBooklet(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  view: TrackView | null,
): void {
  const ctx = context(canvas);
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  if (image) {
    cover(ctx, image, w, h);
    return;
  }
  blushGradient(ctx, w, h);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = title(Math.round(w * 0.11));
  ctx.fillText(fitted(ctx, view?.title ?? 'Your playlist', w * 0.84), w * 0.08, h * 0.82);
  ctx.font = semibold(Math.round(w * 0.032));
  ctx.fillText(
    fitted(ctx, view?.artists ?? 'Paste a Spotify link to make this page yours', w * 0.84),
    w * 0.08,
    h * 0.9,
  );
}

export function paintPolaroid(canvas: HTMLCanvasElement, image: HTMLImageElement | null): void {
  const ctx = context(canvas);
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  if (image) cover(ctx, image, w, h);
  else blushGradient(ctx, w, h);
}

/** The "NOW SPINNING" card in the lid: the collection's name. */
export function paintCard(
  canvas: HTMLCanvasElement,
  collection: { name: string; subtitle: string } | null,
): void {
  const ctx = context(canvas);
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#faf7f2';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#8f878c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = bold(Math.round(h * 0.13));
  ctx.fillText('N O W   S P I N N I N G', w / 2, h * 0.24);
  ctx.fillStyle = INK;
  ctx.font = title(Math.round(h * 0.36));
  ctx.fillText(fitted(ctx, collection?.name ?? 'Your playlist', w * 0.92), w / 2, h * 0.6);
  if (collection?.subtitle) {
    ctx.fillStyle = '#8f878c';
    ctx.font = semibold(Math.round(h * 0.12));
    ctx.fillText(fitted(ctx, collection.subtitle, w * 0.92), w / 2, h * 0.87);
  }
}

function drawDigits(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const t = Math.max(2, w * 0.16);
  let cx = x;
  for (const char of text) {
    if (char === ':') {
      ctx.fillStyle = color;
      ctx.fillRect(cx + w * 0.1, y + h * 0.28, t, t);
      ctx.fillRect(cx + w * 0.1, y + h * 0.66, t, t);
      cx += w * 0.45;
      continue;
    }
    const rects = segmentRects(cx, y, w, h, t);
    ctx.fillStyle = color;
    for (const segment of SEGMENTS[char] ?? '') {
      const [rx, ry, rw, rh] = rects[segment as keyof typeof rects];
      ctx.fillRect(rx, ry, rw, rh);
    }
    cx += w * 1.3;
  }
}

/** The deck's display: unlit "88 8:88" ghosts under the lit digits, as on a real LCD. */
export function paintLcd(
  canvas: HTMLCanvasElement,
  trackNo: number,
  positionMs: number,
  status: Status,
): void {
  const ctx = context(canvas);
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#05080a';
  ctx.fillRect(0, 0, w, h);
  const { track, time } = lcdDigits(trackNo, positionMs);
  const digitH = h * 0.5;
  const digitW = digitH * 0.52;
  const y = h * 0.34;
  drawDigits(ctx, '88', w * 0.07, y, digitW, digitH, LCD_GHOST);
  // The ghost grows a digit for a track past ten minutes, so the lit ones stay on their cells.
  drawDigits(
    ctx,
    time.length > 4 ? '88:88' : '8:88',
    w * 0.46,
    y,
    digitW * 0.8,
    digitH * 0.8,
    LCD_GHOST,
  );
  ctx.shadowColor = LCD_ON;
  ctx.shadowBlur = 8;
  drawDigits(ctx, track, w * 0.07, y, digitW, digitH, LCD_ON);
  drawDigits(ctx, time, w * 0.46, y, digitW * 0.8, digitH * 0.8, LCD_ON);
  ctx.shadowBlur = 0;
  ctx.fillStyle = LCD_ON;
  ctx.font = bold(Math.round(h * 0.13));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const label = status === 'playing' ? 'CD   ▶ PLAY' : status === 'paused' ? 'CD   ❚❚ PAUSE' : 'CD';
  ctx.fillText(label, w * 0.07, h * 0.08);
}
