/**
 * The remote's own URL space. The host maps `/projects/holodex/<rest>` onto
 * these paths (see apps/portfolio/src/lib/remote-route.ts), and standalone dev
 * maps `location.pathname` onto them, so this module is the single definition
 * of what a Holodex URL means.
 */

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
  | { view: 'card'; cardId: string; variant?: 'reverse' }
  | { view: 'collection' }
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

/** Anything other than the literal value `reverse` means the normal printing. */
function parseVariant(query: string): 'reverse' | undefined {
  return new URLSearchParams(query).get('variant') === 'reverse' ? 'reverse' : undefined;
}

export function parseRoute(input: string): Route {
  const [rawPath = '', query = ''] = String(input ?? '').split('?');
  const segments = rawPath.split('/').filter(Boolean).map(decodeURIComponent);
  const filters = parseFilters(query);
  const [head, second] = segments;

  if (segments.length === 0) return { view: 'home' };
  if (segments.length === 1 && head === 'search') return { view: 'search', filters };
  if (segments.length === 1 && head === 'collection') return { view: 'collection' };
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
    case 'card':
      return `/card/${encodeURIComponent(route.cardId)}${route.variant === 'reverse' ? '?variant=reverse' : ''}`;
    case 'search':
      return `/search${formatFilters(route.filters)}`;
    case 'set':
      return `/sets/${encodeURIComponent(route.setId)}${formatFilters(route.filters)}`;
    case 'not-found':
      return route.path;
  }
}
