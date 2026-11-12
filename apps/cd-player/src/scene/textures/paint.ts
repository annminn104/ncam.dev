import {
  CanvasTexture,
  SRGBColorSpace,
  type MeshBasicMaterial,
  type MeshPhysicalMaterial,
} from 'three';
import type { TrackView } from '../../bridge';
import { clearSwatch } from '../../clear-looks';
import type { Look } from '../../looks';
import type { Status } from '../../playback/sequencer';
import { DECK_SCREEN, playedBars, screenTimes, WAVE_BARS, waveHeights } from './deck-screen';
import {
  arcLayout,
  brushLines,
  coverCrop,
  fitText,
  lcdDigits,
  SEGMENTS,
  segmentRects,
  tagRules,
  wrapLines,
} from './layout';

const DISPLAY = "'Fraunces Variable', Georgia, serif";
const UI = "'Manrope Variable', Arial, sans-serif";
const BLUSH = '#e296a4';
const CREAM = '#f7eef0';
const INK = '#2a1f24';
export const LCD_ON = '#9eeeff';
const LCD_GHOST = 'rgba(158, 238, 255, 0.08)';

// The three faces the prints draw with. Canvas text never asks the page for a font, so loadFaces
// has them loaded before a print uses them; a face is picked by family, weight and style, so the
// size it is loaded at does not matter.
const title = (px: number) => `italic 500 ${px}px ${DISPLAY}`;
const semibold = (px: number) => `600 ${px}px ${UI}`;
const bold = (px: number) => `700 ${px}px ${UI}`;
const FACES = [title(16), semibold(16), bold(16)];

/** How long a print waits for the page's fonts: past it, it goes out in the fallback faces. */
export const FACES_WAIT_MS = 1000;

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

/** Puts a print on its material: a material that gains a map needs its shader made again. */
export function setMap(
  material: MeshPhysicalMaterial | MeshBasicMaterial,
  texture: CanvasTexture,
): void {
  material.map = texture;
  material.needsUpdate = true;
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

/** The luggage tag on the handle: the collection's name on a cream card, ruled like a real tag. */
export function paintTag(
  canvas: HTMLCanvasElement,
  collection: { name: string; subtitle: string } | null,
): void {
  const ctx = context(canvas);
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#f6efe6';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8f878c';
  ctx.font = bold(Math.round(h * 0.034));
  ctx.fillText('N A M E', w * 0.08, h * 0.12);
  ctx.fillStyle = 'rgba(42, 31, 36, 0.14)';
  for (const y of tagRules(h)) ctx.fillRect(w * 0.08, y, w * 0.84, Math.max(1, h * 0.003));
  ctx.fillStyle = INK;
  ctx.font = title(Math.round(h * 0.085));
  const lines = wrapLines(
    (s) => ctx.measureText(s).width,
    collection?.name ?? 'Your playlist',
    w * 0.84,
    3,
  );
  lines.forEach((line, i) => ctx.fillText(line, w * 0.08, h * (0.31 + i * 0.12)));
  if (collection?.subtitle) {
    ctx.fillStyle = '#8f878c';
    ctx.font = semibold(Math.round(h * 0.04));
    ctx.fillText(fitted(ctx, collection.subtitle, w * 0.84), w * 0.08, h * 0.76);
  }
  ctx.fillStyle = '#8f878c';
  ctx.font = bold(Math.round(h * 0.03));
  ctx.fillText('ncam · CD player', w * 0.08, h * 0.93);
}

/**
 * The brushed-metal plate in the lid: "NOW SPINNING" and the collection's name, read as engraved
 * (a light edge under a dark cut) on a steel gradient with fine horizontal strokes.
 */
export function paintCard(
  canvas: HTMLCanvasElement,
  collection: { name: string; subtitle: string } | null,
): void {
  const ctx = context(canvas);
  const { width: w, height: h } = canvas;
  const steel = ctx.createLinearGradient(0, 0, 0, h);
  steel.addColorStop(0, '#d9d7d9');
  steel.addColorStop(0.5, '#efeeef');
  steel.addColorStop(1, '#cfccd0');
  ctx.fillStyle = steel;
  ctx.fillRect(0, 0, w, h);
  for (const { y, alpha } of brushLines(h, 90, 11)) {
    ctx.fillStyle = `rgba(90, 86, 92, ${alpha})`;
    ctx.fillRect(0, y, w, 1);
  }
  const engrave = (text: string, x: number, y: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText(text, x, y + Math.max(1, h * 0.008));
    ctx.fillStyle = '#2a2528';
    ctx.fillText(text, x, y);
  };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = bold(Math.round(h * 0.13));
  engrave('N O W   S P I N N I N G', w / 2, h * 0.24);
  ctx.font = title(Math.round(h * 0.36));
  engrave(fitted(ctx, collection?.name ?? 'Your playlist', w * 0.92), w / 2, h * 0.6);
  if (collection?.subtitle) {
    ctx.font = semibold(Math.round(h * 0.12));
    engrave(fitted(ctx, collection.subtitle, w * 0.92), w / 2, h * 0.87);
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

/** The display's lit colour for a look: the suitcase's cyan, or the Clear model's light. */
export function lcdColour(look: Look): string {
  return look.model === 'suitcase' ? LCD_ON : clearSwatch(look.clear, 'light').glow;
}

/** The deck's display: unlit "88 8:88" ghosts under the lit digits, as on a real LCD. */
export function paintLcd(
  canvas: HTMLCanvasElement,
  trackNo: number,
  positionMs: number,
  status: Status,
  colour: string = LCD_ON,
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
  ctx.shadowColor = colour;
  ctx.shadowBlur = 8;
  drawDigits(ctx, track, w * 0.07, y, digitW, digitH, colour);
  drawDigits(ctx, time, w * 0.46, y, digitW * 0.8, digitH * 0.8, colour);
  ctx.shadowBlur = 0;
  ctx.fillStyle = colour;
  ctx.font = bold(Math.round(h * 0.13));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const label = status === 'playing' ? 'CD   ▶ PLAY' : status === 'paused' ? 'CD   ❚❚ PAUSE' : 'CD';
  ctx.fillText(label, w * 0.07, h * 0.08);
}

/** The deck's LED ring: its segments round the jog. */
export const JOG_RING_SEGMENTS = 48;
/** A dim segment's share of the glow. */
export const JOG_RING_DIM = 0.12;

/** How many of the ring's segments `targetMs` of `durationMs` lights: none without a duration. */
export function jogRingLit(targetMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  const lit = Math.round((JOG_RING_SEGMENTS * targetMs) / durationMs);
  return Math.min(JOG_RING_SEGMENTS, Math.max(0, lit));
}

/**
 * The ring's strip. Its u runs clockwise round the ring from twelve o'clock
 * (art/blender/scripts/deck.py unwraps it so), so segment k fills the k-th 48th of the width, less
 * a gap of 18 % of a cell. The first `lit` segments are the glow, the rest the glow at
 * JOG_RING_DIM, the gaps black.
 */
export function paintJogRing(canvas: HTMLCanvasElement, lit: number, colour: string): void {
  const ctx = context(canvas);
  const { width: w, height: h } = canvas;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  const cell = w / JOG_RING_SEGMENTS;
  const gap = cell * 0.18;
  ctx.fillStyle = colour;
  for (let k = 0; k < JOG_RING_SEGMENTS; k++) {
    ctx.globalAlpha = k < lit ? 1 : JOG_RING_DIM;
    ctx.fillRect(k * cell + gap / 2, 0, cell - gap, h);
  }
  ctx.globalAlpha = 1;
}

/** What the deck's screen shows: the view's track, and the time the displays show (the jog's target). */
export interface DeckScreenView {
  trackNo: number;
  title: string;
  artists: string;
  id: string | null;
  targetMs: number;
  durationMs: number;
  status: Status;
}

/**
 * The deck's big screen, laid out for DECK_SCREEN's 768 × 432 and scaled to the canvas: a top bar
 * (track, ▶ or ‖, the name, the times), the title and the artists, and the waveform with its played
 * part and a playhead along the bottom.
 */
export function paintDeckScreen(
  canvas: HTMLCanvasElement,
  screen: DeckScreenView,
  colour: string,
): void {
  const ctx = context(canvas);
  const { width: w, height: h } = canvas;
  const k = w / DECK_SCREEN.width;
  const margin = 24 * k;
  const hasTrack = screen.trackNo > 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 6 * k;
  // The top bar.
  const barY = 26 * k;
  ctx.font = bold(Math.round(30 * k));
  ctx.textAlign = 'left';
  const track = hasTrack ? String(screen.trackNo % 100).padStart(2, '0') : '--';
  ctx.fillText(track, margin, barY);
  const trackW = ctx.measureText(track).width;
  ctx.fillText(screen.status === 'playing' ? '▶' : '‖', margin + trackW + 14 * k, barY);
  const { elapsed, remaining } = screenTimes(screen.targetMs, screen.durationMs);
  ctx.font = bold(Math.round(26 * k));
  ctx.textAlign = 'right';
  ctx.fillText(remaining, w - margin, barY);
  const remainingW = ctx.measureText(remaining).width;
  ctx.fillText('/', w - margin - remainingW - 10 * k, barY);
  ctx.fillText(elapsed, w - margin - remainingW - 28 * k, barY);
  ctx.font = semibold(Math.round(18 * k));
  ctx.textAlign = 'center';
  ctx.fillText('ncam', w / 2, barY);
  // The title and the artists.
  ctx.textAlign = 'left';
  ctx.font = title(Math.round(56 * k));
  const name = hasTrack ? screen.title : 'No disc';
  ctx.fillText(fitted(ctx, name, w - 2 * margin), margin, 118 * k);
  ctx.globalAlpha = 0.7;
  ctx.font = semibold(Math.round(30 * k));
  ctx.fillText(fitted(ctx, screen.artists, w - 2 * margin), margin, 178 * k);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  // The waveform: the bottom 150 px.
  const heights = screen.id ? waveHeights(screen.id) : new Array<number>(WAVE_BARS).fill(0.18);
  const played = playedBars(screen.targetMs, screen.durationMs);
  const waveH = 150 * k;
  const cell = w / heights.length;
  heights.forEach((height, i) => {
    ctx.globalAlpha = i < played ? 1 : 0.25;
    const barH = waveH * height;
    ctx.fillRect(i * cell + cell * 0.15, h - barH, cell * 0.7, barH);
  });
  ctx.globalAlpha = 1;
  if (screen.durationMs > 0) {
    const x = Math.min(w, Math.max(0, (w * screen.targetMs) / screen.durationMs));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - k, h - waveH, 2 * k, waveH);
  }
}
