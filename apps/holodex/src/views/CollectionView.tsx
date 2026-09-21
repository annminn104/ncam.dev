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

  const results = useQueries({ queries: ids.map((id) => cardQuery(id)) });
  const cards = results.flatMap((result) => (result.data ? [result.data] : []));
  const loading = results.some((result) => result.isPending);

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
        <CardGrid
          cards={cards}
          loading={loading}
          onOpen={(cardId) => navigate({ view: 'card', cardId })}
        />
      )}

      <p className="mt-6 text-center text-xs text-holo-muted">
        Saved in this browser only — nothing leaves your device.
      </p>
    </section>
  );
}
