import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../app-context';
import { cardQuery } from '../lib/queries';
import { EMPTY_FILTERS } from '../routes';
import { CardImage } from '../components/CardImage';
import { ErrorPanel } from '../components/ErrorPanel';
import { PricePanel } from '../components/PricePanel';
import { StatPanel } from '../components/StatPanel';

export function CardView({ cardId }: { cardId: string }) {
  const navigate = useNavigate();
  const { data: card, error, isPending, refetch } = useQuery(cardQuery(cardId));

  if (error) {
    return (
      <ErrorPanel title="Couldn't load this card" error={error} onRetry={() => void refetch()} />
    );
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div>
        <button
          type="button"
          onClick={() => navigate({ view: 'home' })}
          className="mb-3 text-sm text-holo-muted hover:text-holo-text"
        >
          ← Sets
        </button>
        {isPending ? (
          <div
            className="animate-pulse rounded-xl bg-holo-panel"
            style={{ aspectRatio: '63 / 88' }}
          />
        ) : (
          <CardImage base={card?.image} name={card?.name ?? cardId} quality="high" priority />
        )}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{card?.name ?? cardId}</h1>
        {card ? (
          <button
            type="button"
            onClick={() => navigate({ view: 'set', setId: card.set.id, filters: EMPTY_FILTERS })}
            className="mt-1 text-sm text-holo-muted underline hover:text-holo-text"
          >
            {card.set.name}
          </button>
        ) : null}
        <div className="mt-4">
          {isPending ? (
            <div className="h-72 animate-pulse rounded-xl bg-holo-panel" />
          ) : card ? (
            <StatPanel
              card={card}
              onOpenName={(name) =>
                navigate({ view: 'search', filters: { ...EMPTY_FILTERS, q: name } })
              }
            />
          ) : null}
        </div>
        {card ? <PricePanel card={card} /> : null}
      </div>
    </section>
  );
}
