import type { CardBrief } from '../lib/tcgdex';
import { CardTile } from './CardTile';
import { Skeleton } from './Skeleton';

export function CardGrid({
  cards,
  loading,
  onOpen,
}: {
  cards: CardBrief[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {loading ? (
        <Skeleton count={12} card />
      ) : (
        cards.map((card) => (
          <li key={card.id}>
            <CardTile card={card} onOpen={onOpen} />
          </li>
        ))
      )}
    </ul>
  );
}
