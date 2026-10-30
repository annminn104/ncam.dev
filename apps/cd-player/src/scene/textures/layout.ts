/** The pure geometry of the printed textures (src/scene/textures/paint.ts draws with it). */
export interface Crop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** The part of an `iw` × `ih` image that covers a `bw` × `bh` box, centred. */
export function coverCrop(iw: number, ih: number, bw: number, bh: number): Crop {
  const scale = Math.max(bw / iw, bh / ih);
  const sw = bw / scale;
  const sh = bh / scale;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

/**
 * Glyphs of the given widths along a circle of `radius` (px), centred on `centre` (radians,
 * 0 = up), reading clockwise; `tracking` adds space between glyphs.
 */
export function arcLayout(
  chars: readonly string[],
  widths: readonly number[],
  radius: number,
  centre = 0,
  tracking = 0,
): { char: string; angle: number }[] {
  const total = widths.reduce((sum, width) => sum + width + tracking, -tracking);
  let s = -total / 2;
  return chars.map((char, index) => {
    const mid = s + widths[index] / 2;
    s += widths[index] + tracking;
    return { char, angle: centre + mid / radius };
  });
}

/** `text`, or as much of it as fits `max` with an ellipsis. */
export function fitText(measure: (text: string) => number, text: string, max: number): string {
  if (measure(text) <= max) return text;
  let end = text.length;
  while (end > 0 && measure(`${text.slice(0, end).trimEnd()}…`) > max) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
}

/** Seven-segment digits: the lit segments (a top, then clockwise, g the middle) for each character. */
export const SEGMENTS: Readonly<Record<string, string>> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

/** Each segment's rectangle `[x, y, w, h]` in a `w` × `h` digit cell with strokes `t` thick. */
export function segmentRects(x: number, y: number, w: number, h: number, t: number) {
  const half = h / 2;
  const tall = half - 1.5 * t;
  return {
    a: [x + t, y, w - 2 * t, t],
    b: [x + w - t, y + t, t, tall],
    c: [x + w - t, y + half + 0.5 * t, t, tall],
    d: [x + t, y + h - t, w - 2 * t, t],
    e: [x, y + half + 0.5 * t, t, tall],
    f: [x, y + t, t, tall],
    g: [x + t, y + half - t / 2, w - 2 * t, t],
  } as Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g', [number, number, number, number]>;
}

/** The display: the track number and the elapsed time, dashes before the first play. */
export function lcdDigits(trackNo: number, positionMs: number): { track: string; time: string } {
  if (trackNo <= 0) return { track: '--', time: '-:--' };
  const total = Math.max(0, Math.floor(positionMs / 1000));
  const minutes = Math.min(99, Math.floor(total / 60));
  const seconds = minutes === 99 ? 0 : total % 60;
  return {
    track: String(trackNo % 100).padStart(2, '0'),
    time: `${minutes}:${String(seconds).padStart(2, '0')}`,
  };
}

/**
 * `text` over at most `maxLines` lines of `max` width, broken at spaces; what does not fit the
 * last line ends in an ellipsis, as does any single word wider than a line.
 */
export function wrapLines(
  measure: (text: string) => number,
  text: string,
  max: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || maxLines < 1) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`;
    if (measure(next) <= max) {
      line = next;
    } else if (lines.length < maxLines - 1) {
      lines.push(line);
      line = words[i];
    } else {
      line = [line, ...words.slice(i)].join(' ');
      break;
    }
  }
  lines.push(line);
  return lines.map((each) => fitText(measure, each, max));
}

/** The luggage tag's three ruled lines (px from the top of an `h` px tag): under each name line. */
export function tagRules(h: number): number[] {
  return [0.33, 0.45, 0.57].map((share) => h * share);
}

/**
 * The brushed plate's strokes: `count` faint horizontal lines at deterministic heights and
 * alphas (xorshift on `seed`), so the plate repaints identically.
 */
export function brushLines(h: number, count: number, seed: number): { y: number; alpha: number }[] {
  let s = seed >>> 0 || 1;
  const random = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const out: { y: number; alpha: number }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ y: Math.floor(random() * h), alpha: 0.04 + random() * 0.08 });
  }
  return out;
}
