import { QueryClient, skipToken, type UseQueryOptions } from '@tanstack/react-query';
import type { Filters } from '../routes';
import {
  DEFAULT_PER_PAGE,
  getCard,
  getSet,
  getSets,
  searchCards,
  selectSetCards,
  TcgdexError,
  type Card,
  type CardBrief,
  type Page,
  type SetBrief,
  type SetDetail,
} from './tcgdex';

const MINUTE = 60_000;

/**
 * One client per mount on the client and one per request on the server —
 * never a module-level singleton, or a second visit inherits stale state and
 * two concurrent SSR requests share a cache.
 */
/**
 * Retry, at most twice, only what may pass: no response at all (a network
 * failure or the timeout: no status), a 5xx, a 408 or a 429. A 404 or any other
 * client error fails the same way every time, so asking again only delays
 * the error and spends the free API's requests.
 */
export function retryTransient(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const status = error instanceof TcgdexError ? error.status : undefined;
  return status === undefined || status >= 500 || status === 408 || status === 429;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: retryTransient,
        // A portfolio demo should not hammer a free public API.
        refetchOnWindowFocus: false,
        gcTime: 30 * MINUTE,
      },
    },
  });
}

/** Only the filter fields that reach the API, so the key is stable. */
function filterKey(filters: Filters) {
  return { q: filters.q, type: filters.type, rarity: filters.rarity, page: filters.page };
}

export const queryKeys = {
  sets: ['sets'] as const,
  set: (setId: string) => ['set', setId] as const,
  setCards: (setId: string, filters: Filters, perPage: number) =>
    ['set-cards', setId, filterKey(filters), perPage] as const,
  search: (filters: Filters, perPage: number) => ['search', filterKey(filters), perPage] as const,
  card: (cardId: string) => ['card', cardId] as const,
};

export function setsQuery(): UseQueryOptions<SetBrief[]> {
  return {
    queryKey: queryKeys.sets,
    queryFn: ({ signal }) => getSets({ signal }),
    staleTime: 5 * MINUTE,
  };
}

export function setQuery(setId: string): UseQueryOptions<SetDetail> {
  return {
    queryKey: queryKeys.set(setId),
    queryFn: ({ signal }) => getSet(setId, { signal }),
    staleTime: 5 * MINUTE,
  };
}

/**
 * One page of a set's cards, paged out of `set`, the set document `setQuery`
 * holds: downloaded once, and every page click paginates that copy (reaching
 * for getSet() here re-fetched a 216–331 card payload per page). Until the set
 * has loaded the query waits (`skipToken`), a dependent query, rather than
 * fetching the set itself: that nested the two queries' retries, three tries
 * of the set for each of the page's three, and every new try put the failed
 * set back to pending, so the set page flipped between its error and
 * "Loading…" for 13 s while asking TCGdex ten times.
 */
export function setCardsQuery(
  setId: string,
  filters: Filters,
  perPage: number = DEFAULT_PER_PAGE,
  set?: SetDetail,
): UseQueryOptions<Page<CardBrief>> {
  return {
    queryKey: queryKeys.setCards(setId, filters, perPage),
    queryFn: set
      ? ({ signal }) =>
          selectSetCards(
            set,
            { name: filters.q, types: filters.type, rarity: filters.rarity },
            filters.page,
            perPage,
            { signal },
          )
      : skipToken,
    staleTime: MINUTE,
  };
}

export function searchQuery(
  filters: Filters,
  perPage: number = DEFAULT_PER_PAGE,
): UseQueryOptions<Page<CardBrief>> {
  return {
    queryKey: queryKeys.search(filters, perPage),
    queryFn: ({ signal }) =>
      searchCards(
        {
          name: filters.q,
          types: filters.type,
          rarity: filters.rarity,
          page: filters.page,
          perPage,
        },
        { signal },
      ),
    staleTime: MINUTE,
    // A search with no terms would page the whole 20k catalogue. `enabled` is what
    // stops the *client* from firing that request. `prefetchQuery` (Task 17's SSR
    // prefetch) takes `FetchQueryOptions`, which has no `enabled` field, so this is
    // silently dropped on the server — Task 17 must repeat this same condition as an
    // explicit `if` around the prefetch call. Do not remove this as "redundant".
    enabled: Boolean(filters.q || filters.type || filters.rarity),
  };
}

export function cardQuery(cardId: string): UseQueryOptions<Card> {
  return {
    queryKey: queryKeys.card(cardId),
    queryFn: ({ signal }) => getCard(cardId, { signal }),
    staleTime: MINUTE,
  };
}
