import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../app-context';
import { searchQuery } from '../lib/queries';
import { DEFAULT_PER_PAGE } from '../lib/tcgdex';
import type { Filters } from '../routes';
import { CardGrid } from '../components/CardGrid';
import { ErrorPanel } from '../components/ErrorPanel';
import { FilterBar } from '../components/FilterBar';
import { Pager } from '../components/Pager';

export function SearchView({ filters }: { filters: Filters }) {
  const navigate = useNavigate();
  const go = (next: Filters) => navigate({ view: 'search', filters: next });

  const [draft, setDraft] = useState(filters);
  useEffect(() => setDraft(filters), [filters]);
  useEffect(() => {
    if (draft.q === filters.q) return;
    const id = setTimeout(() => go({ ...filters, q: draft.q, page: 1 }), 300);
    return () => clearTimeout(id);
  }, [draft.q]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = Boolean(filters.q || filters.type || filters.rarity);
  const cards = useQuery(searchQuery(filters, DEFAULT_PER_PAGE));

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <p className="mt-1 text-sm text-holo-muted">Every card in the TCGdex catalogue.</p>

      <FilterBar
        filters={draft}
        onChange={(next) => (next.q === draft.q ? go(next) : setDraft(next))}
      />

      {!active ? (
        <p className="mt-10 text-center text-sm text-holo-muted">
          Type a card name, or pick a type or rarity, to search.
        </p>
      ) : cards.error ? (
        <ErrorPanel
          title="Search failed"
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
              Nothing matched those filters.
            </p>
          ) : null}
          <Pager
            page={filters.page}
            hasNext={cards.data?.hasNext ?? false}
            perPage={DEFAULT_PER_PAGE}
            onChange={(page) => go({ ...filters, page })}
          />
        </>
      )}
    </section>
  );
}
