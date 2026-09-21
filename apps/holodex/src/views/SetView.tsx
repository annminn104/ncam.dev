import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../app-context';
import { setCardsQuery, setQuery } from '../lib/queries';
import { DEFAULT_PER_PAGE } from '../lib/tcgdex';
import type { Filters } from '../routes';
import { CardGrid } from '../components/CardGrid';
import { ErrorPanel } from '../components/ErrorPanel';
import { FilterBar } from '../components/FilterBar';
import { Pager } from '../components/Pager';

export function SetView({ setId, filters }: { setId: string; filters: Filters }) {
  const navigate = useNavigate();
  const go = (next: Filters) => navigate({ view: 'set', setId, filters: next });

  // Debounce the name box so typing does not create a history entry per key.
  const [draft, setDraft] = useState(filters);
  useEffect(() => setDraft(filters), [filters]);
  useEffect(() => {
    if (draft.q === filters.q) return;
    const id = setTimeout(() => go({ ...filters, q: draft.q, page: 1 }), 300);
    return () => clearTimeout(id);
  }, [draft.q]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useQuery(setQuery(setId));
  const cards = useQuery(setCardsQuery(setId, filters, DEFAULT_PER_PAGE));

  if (set.error) {
    return (
      <ErrorPanel
        title="Couldn't load this set"
        error={set.error}
        onRetry={() => void set.refetch()}
      />
    );
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => navigate({ view: 'home' })}
        className="text-sm text-holo-muted hover:text-holo-text"
      >
        ← All sets
      </button>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{set.data?.name ?? setId}</h1>
      <p className="mt-1 text-sm text-holo-muted">
        {set.data
          ? `${set.data.cardCount.official} cards · released ${set.data.releaseDate ?? 'unknown'}`
          : 'Loading…'}
      </p>

      <FilterBar
        filters={draft}
        onChange={(next) => (next.q === draft.q ? go(next) : setDraft(next))}
      />

      {cards.data?.truncated ? (
        <p className="mt-3 rounded-lg border border-holo-line bg-holo-panel p-3 text-xs text-holo-muted">
          This filter matched more cards than one request can return. Showing the first{' '}
          {cards.data.total} — narrow the filter to see the rest.
        </p>
      ) : null}

      {cards.error ? (
        <ErrorPanel
          title="Couldn't load these cards"
          error={cards.error}
          onRetry={() => void cards.refetch()}
        />
      ) : (
        <>
          <CardGrid
            cards={cards.data?.items ?? []}
            loading={cards.isPending}
            onOpen={(cardId) => navigate({ view: 'card', cardId })}
          />
          {!cards.isPending && (cards.data?.items.length ?? 0) === 0 ? (
            <p className="mt-8 text-center text-sm text-holo-muted">
              No card in this set matches those filters.
            </p>
          ) : null}
          <Pager
            page={filters.page}
            hasNext={cards.data?.hasNext ?? false}
            total={cards.data?.total}
            perPage={DEFAULT_PER_PAGE}
            onChange={(page) => go({ ...filters, page })}
          />
        </>
      )}
    </section>
  );
}
