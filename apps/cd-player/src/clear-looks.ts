import data from './clear-looks.json';

/**
 * The Clear model's colours, part by part. Every colour is in src/clear-looks.json, which the
 * shell (the picker, the accent), the scene (the recolour) and art/blender/scripts/clear.py (the
 * Cycles stills) read. Three-free on purpose (src/ssr-graph.test.ts).
 */
export type ClearPart = 'shell' | 'frame' | 'board' | 'light';

/** In the picker's order. */
export const CLEAR_PARTS: readonly ClearPart[] = ['shell', 'frame', 'board', 'light'];

/** What the picker calls each part's row. */
export const PART_NAMES: Readonly<Record<ClearPart, string>> = {
  shell: 'Shell',
  frame: 'Frame',
  board: 'Board',
  light: 'Light',
};

export interface ShellSwatch {
  id: string;
  name: string;
  /** The clear shell's tint, sRGB hex: the transmission's colour. */
  tint: string;
}
export interface FrameSwatch {
  id: string;
  name: string;
  colour: string;
  metalness: number;
  roughness: number;
}
export interface BoardSwatch {
  id: string;
  name: string;
  /** The solder mask's colour, sRGB hex. */
  colour: string;
}
export interface LightSwatch {
  id: string;
  name: string;
  /** The LEDs' own colour, sRGB hex, drawn outside the tone mapping. */
  glow: string;
  /** The page's accent pair while this light is on. */
  accent: string;
  onAccent: string;
}
export interface ClearSwatches {
  shell: readonly ShellSwatch[];
  frame: readonly FrameSwatch[];
  board: readonly BoardSwatch[];
  light: readonly LightSwatch[];
}

export const CLEAR_SWATCHES: ClearSwatches = data;

/** A swatch id per part. */
export type ClearLook = Readonly<Record<ClearPart, string>>;

export const DEFAULT_CLEAR_LOOK: ClearLook = {
  shell: 'clear',
  frame: 'silver',
  board: 'green',
  light: 'ice',
};

type SwatchOf<P extends ClearPart> = ClearSwatches[P][number];

const has = (part: ClearPart, id: unknown): id is string =>
  typeof id === 'string' && CLEAR_SWATCHES[part].some((swatch) => swatch.id === id);

/** The swatch `look` picks for `part`; an id that part does not have is its default's. */
export function clearSwatch<P extends ClearPart>(look: ClearLook, part: P): SwatchOf<P> {
  const list = CLEAR_SWATCHES[part] as readonly SwatchOf<P>[];
  const id = has(part, look[part]) ? look[part] : DEFAULT_CLEAR_LOOK[part];
  return list.find((swatch) => swatch.id === id) as SwatchOf<P>;
}

/** A look from anything (storage): each part keeps its id when it has it, else its default. */
export function clearLookFrom(value: unknown): ClearLook {
  const source: Record<string, unknown> =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value))
      : {};
  const look = {} as Record<ClearPart, string>;
  for (const part of CLEAR_PARTS) {
    look[part] = has(part, source[part]) ? (source[part] as string) : DEFAULT_CLEAR_LOOK[part];
  }
  return look;
}
