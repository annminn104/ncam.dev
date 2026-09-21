import { Star, StarOff, Check, Plus } from 'lucide-react';
import { collectionStore, useCollectionState } from '../lib/collection';
import { useMounted } from '../lib/use-mounted';
import { cn } from '../lib/utils';

export function CollectionToggle({ cardId }: { cardId: string }) {
  const state = useCollectionState();
  // Storage is empty on the server, so reserve the space but render nothing
  // until mounted — that is what keeps the SSR markup and the first client
  // render identical. Call the hook before any early return.
  const mounted = useMounted();
  if (!mounted) return <div className="h-9" aria-hidden="true" />;

  const owned = state.owned.includes(cardId);
  const wished = state.wishlist.includes(cardId);
  const base = 'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm';

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={owned}
        onClick={() => collectionStore.toggle('owned', cardId)}
        className={cn(base, owned ? 'border-holo-accent text-holo-accent' : 'border-holo-line')}
      >
        {owned ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Plus aria-hidden="true" className="h-4 w-4" />
        )}
        {owned ? 'Owned' : 'Mark owned'}
      </button>
      <button
        type="button"
        aria-pressed={wished}
        onClick={() => collectionStore.toggle('wishlist', cardId)}
        className={cn(base, wished ? 'border-holo-accent text-holo-accent' : 'border-holo-line')}
      >
        {wished ? (
          <Star aria-hidden="true" className="h-4 w-4" />
        ) : (
          <StarOff aria-hidden="true" className="h-4 w-4" />
        )}
        {wished ? 'On wishlist' : 'Add to wishlist'}
      </button>
    </div>
  );
}
