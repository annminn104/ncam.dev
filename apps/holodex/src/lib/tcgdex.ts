/**
 * Typed client for the public TCGdex REST API.
 *
 * Two API behaviours drive the shape of this module:
 *  - an unknown query param makes the API return `[]` rather than ignoring it,
 *    so params come from a whitelist and never from caller-supplied keys;
 *  - there is no total-count header, so page counts have to be derived
 *    (see `searchCards` and `getSetCards`).
 */

export const API_BASE = 'https://api.tcgdex.net/v2/en';

/** Every request failure surfaces as this, carrying the URL for the log. */
export class TcgdexError extends Error {
  readonly url: string;
  readonly status?: number;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = 'TcgdexError';
    this.url = url;
    this.status = status;
  }
}

export interface Legality {
  standard: boolean;
  expanded: boolean;
}

export interface CardBrief {
  id: string;
  localId: string;
  name: string;
  /** Absent on roughly one brief in five. */
  image?: string;
}

export interface SeriesBrief {
  id: string;
  name: string;
}

export interface SetCardCount {
  total: number;
  official: number;
  holo?: number;
  normal?: number;
  reverse?: number;
  firstEd?: number;
}

export interface SetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: SetCardCount;
}

export interface SetDetail extends SetBrief {
  cards: CardBrief[];
  releaseDate?: string;
  serie: SeriesBrief;
  legal?: Legality;
  abbreviation?: { official?: string; localized?: string };
}

export interface Attack {
  name: string;
  cost?: string[];
  effect?: string;
  damage?: string | number;
}

export interface WeaknessEntry {
  type: string;
  value: string;
}

export interface Variants {
  normal?: boolean;
  reverse?: boolean;
  holo?: boolean;
  firstEdition?: boolean;
  wPromo?: boolean;
}

export interface PriceBlock {
  unit?: string;
  updated?: string;
  avg?: number;
  low?: number;
  trend?: number;
  avg1?: number;
  avg7?: number;
  avg30?: number;
}

export interface VariantDetail {
  type: string;
  size?: string;
  variantId?: string;
  pricing?: { cardmarket?: PriceBlock; tcgplayer?: PriceBlock };
}

export interface Card extends CardBrief {
  category: string;
  set: SetBrief;
  illustrator?: string;
  rarity?: string;
  variants?: Variants;
  variants_detailed?: VariantDetail[];
  dexId?: number[];
  hp?: number;
  types?: string[];
  evolveFrom?: string;
  description?: string;
  stage?: string;
  attacks?: Attack[];
  weaknesses?: WeaknessEntry[];
  retreat?: number;
  regulationMark?: string;
  legal?: Legality;
  updated?: string;
}

export interface CardQuery {
  name?: string;
  types?: string;
  rarity?: string;
  setId?: string;
  /** 1-based. */
  page?: number;
  perPage?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  hasNext: boolean;
  /** Only known when the whole list was materialised (set views). */
  total?: number;
  /** True when a set query hit the request cap and may be incomplete. */
  truncated?: boolean;
}

export interface RequestOpts {
  signal?: AbortSignal;
  base?: string;
}

export const DEFAULT_PER_PAGE = 24;

/** Whitelist: query key on `CardQuery` → the param name the API expects. */
const CARD_FILTERS: ReadonlyArray<[keyof CardQuery, string]> = [
  ['name', 'name'],
  ['types', 'types'],
  ['rarity', 'rarity'],
  ['setId', 'set.id'],
];

function positive(value: number | undefined, fallback: number): number {
  const n = Math.trunc(value ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Build a `/cards` URL. `perPage` is used verbatim — callers add any probe. */
export function buildCardUrl(q: CardQuery, base: string = API_BASE): string {
  const url = new URL(`${base}/cards`);
  for (const [key, param] of CARD_FILTERS) {
    const value = q[key];
    if (typeof value === 'string' && value.trim() !== '') url.searchParams.set(param, value.trim());
  }
  url.searchParams.set('pagination:page', String(positive(q.page, 1)));
  url.searchParams.set('pagination:itemsPerPage', String(positive(q.perPage, DEFAULT_PER_PAGE)));
  return url.toString();
}

async function fetchJson<T>(url: string, opts: RequestOpts = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: opts.signal ?? AbortSignal.timeout(10_000),
      headers: { accept: 'application/json' },
    });
  } catch (cause) {
    throw new TcgdexError(
      `Could not reach TCGdex: ${cause instanceof Error ? cause.message : String(cause)}`,
      url,
    );
  }
  if (!response.ok)
    throw new TcgdexError(`TCGdex responded ${response.status}`, url, response.status);
  try {
    return (await response.json()) as T;
  } catch {
    throw new TcgdexError('TCGdex returned a malformed body', url, response.status);
  }
}

async function fetchArray<T>(url: string, opts: RequestOpts): Promise<T[]> {
  const body = await fetchJson<unknown>(url, opts);
  if (!Array.isArray(body)) throw new TcgdexError('Expected a JSON array', url);
  return body as T[];
}

export function getSeries(opts: RequestOpts = {}): Promise<SeriesBrief[]> {
  return fetchArray<SeriesBrief>(`${opts.base ?? API_BASE}/series`, opts);
}

export function getSets(opts: RequestOpts = {}): Promise<SetBrief[]> {
  return fetchArray<SetBrief>(`${opts.base ?? API_BASE}/sets`, opts);
}

export async function getSet(setId: string, opts: RequestOpts = {}): Promise<SetDetail> {
  const url = `${opts.base ?? API_BASE}/sets/${encodeURIComponent(setId)}`;
  const set = await fetchJson<SetDetail>(url, opts);
  if (!set || typeof set.id !== 'string') throw new TcgdexError('Expected a set object', url);
  return { ...set, cards: Array.isArray(set.cards) ? set.cards : [] };
}

export async function getCard(cardId: string, opts: RequestOpts = {}): Promise<Card> {
  const url = `${opts.base ?? API_BASE}/cards/${encodeURIComponent(cardId)}`;
  const card = await fetchJson<Card>(url, opts);
  if (!card || typeof card.id !== 'string') throw new TcgdexError('Expected a card object', url);
  return card;
}
