/**
 * The visitor's own marks on the Deck (the spec's "Personal patterns"): the pattern its print layer
 * shows, and the name it engraves. Kept only in this browser (src/persist.ts), never in the URL and
 * never sent anywhere. Three-free on purpose (src/ssr-graph.test.ts).
 */

/** The menu's patterns. From the music picks one of the styles by the collection's seed. */
export type PatternId =
  'music' | 'guilloche' | 'circuit' | 'waves' | 'stickers' | 'graffiti' | 'plain';

/** The patterns that print: every one but From the music (which picks one) and Plain. */
export type PatternStyle = Exclude<PatternId, 'music' | 'plain'>;

/** In the menu's order. */
export const PATTERNS: readonly { readonly id: PatternId; readonly name: string }[] = [
  { id: 'music', name: 'From the music' },
  { id: 'guilloche', name: 'Guilloché' },
  { id: 'circuit', name: 'Circuit' },
  { id: 'waves', name: 'Sound waves' },
  { id: 'stickers', name: 'Sticker bomb' },
  { id: 'graffiti', name: 'Graffiti' },
  { id: 'plain', name: 'Plain' },
];

/** The styles From the music picks among, by the seed modulo their count. */
export const PATTERN_STYLES: readonly PatternStyle[] = [
  'guilloche',
  'circuit',
  'waves',
  'stickers',
  'graffiti',
];

export interface Personal {
  readonly pattern: PatternId;
  /** As the field keeps it (cleanName): it may end in one space while a word is being typed. */
  readonly name: string;
}

export const DEFAULT_PERSONAL: Personal = { pattern: 'music', name: '' };

/** The longest name, in code points. */
export const NAME_MAX = 16;

/** What prints where the visitor gave no name. */
export const NAME_FALLBACK = 'ncam';

const ALLOWED = /[\p{L}\p{M}\p{N} ._&'!-]/u;
const VARIATION = /\p{Variation_Selector}/u;

/**
 * A name as the field keeps it: composed (NFC); only letters with their accents, digits, spaces and
 * `. - _ & ' !`; no leading space and no run of spaces; at most NAME_MAX code points. One trailing
 * space stays, so that the visitor can type the next word.
 */
export function cleanName(raw: string): string {
  const kept = Array.from(raw.normalize('NFC'))
    .filter((char) => ALLOWED.test(char) && !VARIATION.test(char))
    .join('')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /, '');
  return Array.from(kept).slice(0, NAME_MAX).join('');
}

/** The name the Deck prints: the cleaned name without the spaces at its ends, or NAME_FALLBACK. */
export function engraving(name: string): string {
  return cleanName(name).trim() || NAME_FALLBACK;
}

/** The style a pattern prints for a collection's seed: none for Plain, one by seed for the music. */
export function styleFor(pattern: PatternId, seed: number): PatternStyle | null {
  if (pattern === 'plain') return null;
  if (pattern === 'music') return PATTERN_STYLES[(seed >>> 0) % PATTERN_STYLES.length];
  return pattern;
}

const isPattern = (value: unknown): value is PatternId =>
  typeof value === 'string' && PATTERNS.some((pattern) => pattern.id === value);

/** Personal marks from anything (storage): an unknown pattern is From the music, junk no name. */
export function personalFrom(value: unknown): Personal {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_PERSONAL;
  const source: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  return {
    pattern: isPattern(source.pattern) ? source.pattern : DEFAULT_PERSONAL.pattern,
    name: typeof source.name === 'string' ? cleanName(source.name) : '',
  };
}
