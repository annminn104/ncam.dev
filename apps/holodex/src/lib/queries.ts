import { QueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { Filters } from '../routes';
import {
  DEFAULT_PER_PAGE,
  getCard,
  getSet,
  getSetCards,
  getSets,
  searchCards,
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
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
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
  series: ['series'] as const,
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

export function setCardsQuery(
  setId: string,
  filters: Filters,
  perPage: number = DEFAULT_PER_PAGE,
): UseQueryOptions<Page<CardBrief>> {
  return {
    queryKey: queryKeys.setCards(setId, filters, perPage),
    queryFn: ({ signal }) =>
      getSetCards(
        setId,
        { name: filters.q, types: filters.type, rarity: filters.rarity },
        filters.page,
        perPage,
        { signal },
      ),
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
