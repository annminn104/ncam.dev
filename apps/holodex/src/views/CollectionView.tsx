import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from '../app-context';
import { cardQuery } from '../lib/queries';
import { useCollectionState, type CollectionList } from '../lib/collection';
import { CardGrid } from '../components/CardGrid';

export function CollectionView() {
  const navigate = useNavigate();
  const state = useCollectionState();
  const [list, setList] = useState<CollectionList>('owned');
  const ids = state[list];

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Collection</h1>
      <div className="mt-4 flex gap-2">
        {(['owned', 'wishlist'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setList(value)}
            aria-pressed={list === value}
            className={`rounded-lg border px-3 py-1.5 text-sm ${list === value ? 'border-holo-accent text-holo-accent' : 'border-holo-line text-holo-muted'}`}
          >
            {value === 'owned' ? 'Owned' : 'Wishlist'} ({state[value].length})
          </button>
        ))}
      </div>

      {ids.length === 0 ? (
        <p className="mt-10 text-center text-sm text-holo-muted">
          Nothing here yet. Open a card and mark it {list === 'owned' ? 'owned' : 'wanted'}.
        </p>
      ) : (
        <SavedCards ids={ids} onOpen={(cardId) => navigate({ view: 'card', cardId })} />
      )}

      <p className="mt-6 text-center text-xs text-holo-muted">
        Saved in this browser only — nothing leaves your device.
      </p>
    </section>
  );
}

/**
 * The saved cards, each fetched on its own. One TCGdex could not serve is
 * named, with a way to ask again, rather than silently missing from the grid
 * while the tab's count still includes it.
 */
export function SavedCards({ ids, onOpen }: { ids: string[]; onOpen: (cardId: string) => void }) {
  const results = useQueries({ queries: ids.map((id) => cardQuery(id)) });
  const cards = results.flatMap((result) => (result.data ? [result.data] : []));
  const loading = results.some((result) => result.isPending);

  return (
    <>
      <LoadFailures
        ids={failedIds(ids, results)}
        onRetry={() => {
          for (const result of results) if (result.isError) void result.refetch();
        }}
      />
      <CardGrid cards={cards} loading={loading} onOpen={onOpen} />
    </>
  );
}

/** The saved ids whose card query failed, in their order. */
export function failedIds(
  ids: readonly string[],
  results: ReadonlyArray<{ isError: boolean }>,
): string[] {
  return ids.filter((_, index) => results[index]?.isError);
}

/** The saved cards TCGdex could not serve, named, and a way to ask again; nothing when there are none. */
export function LoadFailures({ ids, onRetry }: { ids: readonly string[]; onRetry: () => void }) {
  if (ids.length === 0) return null;
  return (
    <p className="mt-4 rounded-lg border border-holo-line bg-holo-panel p-3 text-sm text-holo-muted">
      Couldn&apos;t load {ids.length === 1 ? 'one saved card' : `${ids.length} saved cards`} from
      TCGdex: {ids.join(', ')}.{' '}
      <button
        type="button"
        onClick={onRetry}
        className="text-holo-text underline hover:text-holo-accent"
      >
        Try again
      </button>
    </p>
  );
}
