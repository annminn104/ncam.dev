import type { FrameSwatch, LightSwatch } from './clear-looks';
import data from './luxe-looks.json';

/**
 * Luxe's colours, part by part: the body's finish (the plinth, the platter's side and the
 * stand), the metal (its bands, frame, feet, keys, tonearm, platter rim and the stand's rails),
 * and the light (the LED ring and the play key's icons). Every colour is in src/luxe-looks.json,
 * which the shell (the picker, the accent), the scene (the recolour) and
 * art/blender/scripts/luxe.py (the Cycles stills) read. The lights are the Deck's. Three-free on
 * purpose (src/ssr-graph.test.ts).
 */
export type LuxePart = 'body' | 'metal' | 'light';

/** In the picker's order. */
export const LUXE_PARTS: readonly LuxePart[] = ['body', 'metal', 'light'];

/** What the picker calls each part's row. */
export const LUXE_PART_NAMES: Readonly<Record<LuxePart, string>> = {
  body: 'Body',
  metal: 'Metal',
  light: 'Light',
};

/** A body's finish: a frame's, and the lacquer's coat over it (three's clearcoat, 0 … 1). */
export interface LuxeBodySwatch extends FrameSwatch {
  coat: number;
}

export interface LuxeSwatches {
  body: readonly LuxeBodySwatch[];
  metal: readonly FrameSwatch[];
  light: readonly LightSwatch[];
}

export const LUXE_SWATCHES: LuxeSwatches = data;

/** A swatch id per part. */
export type LuxeLook = Readonly<Record<LuxePart, string>>;

export const DEFAULT_LUXE_LOOK: LuxeLook = { body: 'pink', metal: 'gold', light: 'pink' };

type SwatchOf<P extends LuxePart> = LuxeSwatches[P][number];

const has = (part: LuxePart, id: unknown): id is string =>
  typeof id === 'string' && LUXE_SWATCHES[part].some((swatch) => swatch.id === id);

/** The swatch `look` picks for `part`; an id that part does not have is its default's. */
export function luxeSwatch<P extends LuxePart>(look: LuxeLook, part: P): SwatchOf<P> {
  const list = LUXE_SWATCHES[part] as readonly SwatchOf<P>[];
  const id = has(part, look[part]) ? look[part] : DEFAULT_LUXE_LOOK[part];
  return list.find((swatch) => swatch.id === id) as SwatchOf<P>;
}

/** A look from anything (storage): each part keeps its id when it has it, else its default. */
export function luxeLookFrom(value: unknown): LuxeLook {
  const source: Record<string, unknown> =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value))
      : {};
  const look = {} as Record<LuxePart, string>;
  for (const part of LUXE_PARTS) {
    look[part] = has(part, source[part]) ? (source[part] as string) : DEFAULT_LUXE_LOOK[part];
  }
  return look;
}
