import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../app-context';
import { cardQuery } from '../lib/queries';
import { EMPTY_FILTERS } from '../routes';
import { cn } from '../lib/utils';
import { CardImage } from '../components/CardImage';
import { CollectionToggle } from '../components/CollectionToggle';
import { ErrorPanel } from '../components/ErrorPanel';
import { PricePanel } from '../components/PricePanel';
import { StatPanel } from '../components/StatPanel';
import { HoloCard } from '../holo/HoloCard';
import { listsReverseFoil, type Printing } from '../holo/select';
import type { Card } from '../lib/tcgdex';

/**
 * Which printing is shown is an explicit display choice (see
 * `holo/select.ts`'s `SelectOptions`), never derived from the card — this is
 * the control that supplies it, deep-linked through `?variant=reverse` or
 * `?variant=masterball` (see `routes.ts`). It offers only the printings the
 * card has: the Master Ball one where TCGdex lists it. TCGdex serves exactly
 * one image per card whichever is shown: a reverse printing swaps the *foil*,
 * not the artwork, so toggling only ever changes what `<HoloCard>` renders on
 * top of the same image, never `src`.
 */
function PrintingToggle({
  cardId,
  variant,
  masterBall,
}: {
  cardId: string;
  variant?: Printing;
  /** Whether the card lists a Master Ball printing, and so gets its button. */
  masterBall: boolean;
}) {
  const navigate = useNavigate();
  // No `outline-none`: in Tailwind 4 it sets the `--tw-outline-style` that
  // `outline-2` reads, which left a keyboard-focused button with no ring.
  const base =
    'rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-holo-accent';
  const on = 'border-holo-accent text-holo-accent';
  const off = 'border-holo-line';
  const printings: Array<[Printing | undefined, string]> = [
    [undefined, 'Normal'],
    ['reverse', 'Reverse holo'],
    ...(masterBall ? [['masterball', 'Master Ball'] as [Printing, string]] : []),
  ];

  return (
    <div className="mt-3 flex gap-2" role="group" aria-label="Printing">
      {printings.map(([printing, label]) => (
        <button
          key={label}
          type="button"
          aria-pressed={variant === printing}
          onClick={() =>
            navigate(
              printing ? { view: 'card', cardId, variant: printing } : { view: 'card', cardId },
            )
          }
          className={cn(base, variant === printing ? on : off)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The printing to show: the one the URL asks for, if the card has it. A
 * `?variant=` for a printing the card lacks gets no button below that could
 * undo it, so it is ignored.
 */
function shownPrinting(card: Card, variant: Printing | undefined): Printing | undefined {
  if (card.variants?.reverse !== true) return undefined;
  if (variant === 'masterball') return listsReverseFoil(card, 'masterball') ? variant : undefined;
  return variant;
}

export function CardView({ cardId, variant }: { cardId: string; variant?: Printing }) {
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
          onClick={() => navigate({ view: 'sets' })}
          className="mb-3 text-sm text-holo-muted hover:text-holo-text"
        >
          ← Sets
        </button>
        {isPending ? (
          <div
            className="animate-pulse rounded-xl bg-holo-panel"
            style={{ aspectRatio: '63 / 88' }}
          />
        ) : card ? (
          <HoloCard card={card} variant={shownPrinting(card, variant)} />
        ) : (
          <CardImage name={cardId} quality="high" priority />
        )}
        {/* Most cards have no reverse printing at all, so the control only
            appears for the ones that do — everyone else sees nothing here. */}
        {card?.variants?.reverse === true ? (
          <PrintingToggle
            cardId={cardId}
            variant={shownPrinting(card, variant)}
            masterBall={listsReverseFoil(card, 'masterball')}
          />
        ) : null}
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
        <div className="mt-3">
          <CollectionToggle cardId={cardId} />
        </div>
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
