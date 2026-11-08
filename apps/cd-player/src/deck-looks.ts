import type { FrameSwatch, LightSwatch } from './clear-looks';
import data from './deck-looks.json';

/**
 * The Deck's colours, part by part: its body's finish, and the one light its LED ring, its LCD
 * and its keys' backlights share. Every colour is in src/deck-looks.json, which the shell (the
 * picker, the accent), the scene (the recolour) and art/blender/scripts/deck.py (the Cycles
 * stills) read. The body's finishes are the Clear's frame's; four lights are the Clear's. Three-free
 * on purpose (src/ssr-graph.test.ts).
 */
export type DeckPart = 'body' | 'light';

/** In the picker's order. */
export const DECK_PARTS: readonly DeckPart[] = ['body', 'light'];

/** What the picker calls each part's row. */
export const DECK_PART_NAMES: Readonly<Record<DeckPart, string>> = { body: 'Body', light: 'Light' };

export interface DeckSwatches {
  body: readonly FrameSwatch[];
  light: readonly LightSwatch[];
}

export const DECK_SWATCHES: DeckSwatches = data;

/** A swatch id per part. */
export type DeckLook = Readonly<Record<DeckPart, string>>;

export const DEFAULT_DECK_LOOK: DeckLook = { body: 'black', light: 'ice' };

type SwatchOf<P extends DeckPart> = DeckSwatches[P][number];

const has = (part: DeckPart, id: unknown): id is string =>
  typeof id === 'string' && DECK_SWATCHES[part].some((swatch) => swatch.id === id);

/** The swatch `look` picks for `part`; an id that part does not have is its default's. */
export function deckSwatch<P extends DeckPart>(look: DeckLook, part: P): SwatchOf<P> {
  const list = DECK_SWATCHES[part] as readonly SwatchOf<P>[];
  const id = has(part, look[part]) ? look[part] : DEFAULT_DECK_LOOK[part];
  return list.find((swatch) => swatch.id === id) as SwatchOf<P>;
}

/** A look from anything (storage): each part keeps its id when it has it, else its default. */
export function deckLookFrom(value: unknown): DeckLook {
  const source: Record<string, unknown> =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value))
      : {};
  const look = {} as Record<DeckPart, string>;
  for (const part of DECK_PARTS) {
    look[part] = has(part, source[part]) ? (source[part] as string) : DEFAULT_DECK_LOOK[part];
  }
  return look;
}
