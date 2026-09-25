/**
 * The remote's own URL space. The host maps `/projects/holodex/<rest>` onto
 * these paths (see apps/portfolio/src/lib/remote-route.ts), and standalone dev
 * maps `location.pathname` onto them, so this module is the single definition
 * of what a Holodex URL means.
 */

import { isGalleryEffect, isSectionCard } from './holo/effect-gallery';
import type { EffectId, Printing } from './holo/select';

export interface Filters {
  q: string;
  type: string;
  rarity: string;
  /** 1-based. */
  page: number;
}

export const EMPTY_FILTERS: Filters = { q: '', type: '', rarity: '', page: 1 };

export type Route =
  | { view: 'home' }
  | { view: 'set'; setId: string; filters: Filters }
  | { view: 'search'; filters: Filters }
  | { view: 'card'; cardId: string; variant?: Printing }
  | { view: 'collection' }
  /**
   * `/effects`, `/effects/<effect>` or `/effects/<effect>?card=<cardId>`: the
   * section, and which of its three cards is live. `card` is only ever set
   * alongside `effect`, and only to one of that section's own cards.
   */
  | { view: 'effects'; effect?: EffectId; card?: string }
  | { view: 'not-found'; path: string };

function parseFilters(query: string): Filters {
  const params = new URLSearchParams(query);
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    q: params.get('q') ?? '',
    type: params.get('type') ?? '',
    rarity: params.get('rarity') ?? '',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Anything other than the literal `reverse` or `masterball` means the normal printing. */
function parseVariant(query: string): Printing | undefined {
  const variant = new URLSearchParams(query).get('variant');
  return variant === 'reverse' || variant === 'masterball' ? variant : undefined;
}

export function parseRoute(input: string): Route {
  const [rawPath = '', query = ''] = String(input ?? '').split('?');
  const segments = rawPath.split('/').filter(Boolean).map(decodeURIComponent);
  const filters = parseFilters(query);
  const [head, second] = segments;

  if (segments.length === 0) return { view: 'home' };
  if (segments.length === 1 && head === 'search') return { view: 'search', filters };
  if (segments.length === 1 && head === 'collection') return { view: 'collection' };
  if (segments.length === 1 && head === 'effects') return { view: 'effects' };
  if (segments.length === 2 && head === 'effects' && second) {
    // An id that names no section is not a 404: the page exists, it just
    // opens on its default card. So does a card the section does not show,
    // which opens that section on its first card.
    if (!isGalleryEffect(second)) return { view: 'effects' };
    const card = new URLSearchParams(query).get('card');
    return card !== null && isSectionCard(second, card)
      ? { view: 'effects', effect: second, card }
      : { view: 'effects', effect: second };
  }
  if (segments.length === 2 && head === 'sets' && second) {
    return { view: 'set', setId: second, filters };
  }
  if (segments.length === 2 && head === 'card' && second) {
    const variant = parseVariant(query);
    return variant ? { view: 'card', cardId: second, variant } : { view: 'card', cardId: second };
  }
  return { view: 'not-found', path: `/${segments.join('/')}` };
}

/**
 * Identity of the *view*, not of the whole route.
 *
 * `App` keys its error boundary on this. Keying on the full route string
 * instead remounted the whole subtree on every debounced commit: the search
 * box became a new DOM node and focus dropped to `<body>` mid-word, and
 * `useMounted()` reset, blanking the owned counter and CollectionToggle for a
 * frame. Filters, pages and query strings therefore do not appear here — only
 * what makes one view genuinely a different view, so a broken one still gets a
 * fresh boundary instead of stranding the whole app on an error panel.
 */
export function viewKey(route: Route): string {
  switch (route.view) {
    case 'home':
    case 'search':
    case 'collection':
    case 'effects':
      // For effects, the section and the live card are state inside one
      // view, like a filter: keying on either would remount the whole page on
      // every pick — refetching every card query gone stale — and drop focus
      // off the card just clicked.
      return route.view;
    case 'set':
      return `set:${route.setId}`;
    case 'card':
      return `card:${route.cardId}`;
    case 'not-found':
      return `not-found:${route.path}`;
  }
}

function formatFilters(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.type) params.set('type', filters.type);
  if (filters.rarity) params.set('rarity', filters.rarity);
  if (filters.page > 1) params.set('page', String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function formatRoute(route: Route): string {
  switch (route.view) {
    case 'home':
      return '/';
    case 'collection':
      return '/collection';
    case 'effects':
      if (!route.effect) return '/effects';
      return `/effects/${encodeURIComponent(route.effect)}${route.card ? `?card=${encodeURIComponent(route.card)}` : ''}`;
    case 'card':
      return `/card/${encodeURIComponent(route.cardId)}${route.variant ? `?variant=${route.variant}` : ''}`;
    case 'search':
      return `/search${formatFilters(route.filters)}`;
    case 'set':
      return `/sets/${encodeURIComponent(route.setId)}${formatFilters(route.filters)}`;
    case 'not-found':
      return route.path;
  }
}
