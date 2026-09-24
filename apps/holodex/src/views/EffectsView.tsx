import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../app-context';
import { CardImage } from '../components/CardImage';
import { EFFECT_GALLERY, selectedExample, type EffectExample } from '../holo/effect-gallery';
import { HoloCard } from '../holo/HoloCard';
import type { EffectId } from '../holo/select';
import { CARD_ASPECT } from '../lib/constants';
import { cardQuery } from '../lib/queries';
import type { Card } from '../lib/tcgdex';
import { cn } from '../lib/utils';

/** Counted off the gallery, so the intro cannot disagree with the tiles under it. */
const RARITY_COUNT = EFFECT_GALLERY.reduce((sum, entry) => sum + entry.rarities.length, 0);

/**
 * No `outline-none` here. In Tailwind 4 it sets `--tw-outline-style: none`,
 * and `outline-2` takes its style from that variable, so the two together
 * compute `outline: none` on a keyboard-focused tile: no ring at all, worse
 * than a plain button's default one. Without it the variable keeps its
 * registered `solid`. (A bare `focus-visible:outline` would add nothing:
 * `cn()` drops it in favour of `outline-2`.)
 */
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-holo-accent';

/**
 * Every effect `selectHolo` can return, each on a real card
 * (`holo/effect-gallery.ts`): one page for a GPU smoke pass over all of them,
 * instead of 22 card URLs.
 *
 * Exactly one tile renders a live `HoloCard`; every other tile is plain art.
 * Each `HoloCard` builds its own three.js renderer, with its own WebGL
 * context, and browsers cap live contexts near 16, so a grid of live cards
 * would knock its own earlier canvases out through the `holo.context-lost`
 * path. Picking a tile moves the live card.
 *
 * Cards load client-side through the card page's own `cardQuery`. There is
 * deliberately no SSR prefetch for this diagnostic view.
 */
export function EffectsView({ effect }: { effect?: EffectId }) {
  const navigate = useNavigate();
  const selected = selectedExample(effect);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Effects</h1>
      <p className="mt-1 max-w-3xl text-sm text-holo-muted">
        All {EFFECT_GALLERY.length} holo effects, which of the {RARITY_COUNT} TCGdex rarities
        selects each, and a real card for every one. Only the selected card renders its foil live —
        pick a tile to move it there.
      </p>

      <ul
        aria-label="Holo effects"
        className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {EFFECT_GALLERY.map((entry) => (
          <li key={entry.effect}>
            <EffectTile
              entry={entry}
              selected={entry.effect === selected.effect}
              onSelect={() => navigate({ view: 'effects', effect: entry.effect })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TileProps {
  entry: EffectExample;
  selected: boolean;
  onSelect: () => void;
}

/** Split in two so the query hook is unconditional: a tile with no card has nothing to fetch. */
function EffectTile(props: TileProps) {
  const { entry } = props;
  if (entry.cardId === null) {
    return (
      <TileFrame {...props} caption="No example card">
        <ArtPlaceholder>{entry.note ?? 'No card selects this effect.'}</ArtPlaceholder>
      </TileFrame>
    );
  }
  return <ExampleTile {...props} cardId={entry.cardId} />;
}

function ExampleTile({ cardId, ...props }: TileProps & { cardId: string }) {
  const { entry, selected } = props;
  // One query per tile, so a dead id costs its own tile an error, never the page.
  const { data: card, error, isPending, refetch } = useQuery(cardQuery(cardId));

  if (isPending) {
    return (
      <TileFrame {...props} caption={cardId}>
        <span
          aria-hidden="true"
          className="block animate-pulse rounded-lg bg-holo-panel"
          style={{ aspectRatio: CARD_ASPECT }}
        />
      </TileFrame>
    );
  }

  if (error || !card) {
    return (
      <TileFrame
        {...props}
        caption={cardId}
        after={
          <button
            type="button"
            onClick={() => void refetch()}
            className={cn(
              'mt-2 text-xs text-holo-muted underline hover:text-holo-text',
              FOCUS_RING,
            )}
          >
            Try again
          </button>
        }
      >
        <ArtPlaceholder>
          Couldn't load this card{error instanceof Error ? `: ${error.message}` : '.'}
        </ArtPlaceholder>
      </TileFrame>
    );
  }

  return (
    <TileFrame
      {...props}
      caption={`${card.name} · ${cardId}`}
      status={selected ? staticReason(entry, card) : null}
    >
      {/* Each tile owns its HoloCard, so moving the selection unmounts one
          and mounts the next. (HoloCard gives every rebuild a fresh canvas
          itself — see holoCanvasKey — so this layout is not what keeps the
          foil alive.) The art is decorative: the caption below names the
          card, and the button's name should not say it twice. */}
      {selected ? (
        <HoloCard card={card} reverse={entry.reverse} decorative />
      ) : (
        <CardImage base={card.image} name={card.name} decorative />
      )}
    </TileFrame>
  );
}

/**
 * Why the live tile shows plain art however capable the GPU: HoloCard's own
 * early returns, spelled out so a smoke pass does not read them as a failure.
 */
function staticReason(entry: EffectExample, card: Card): string | null {
  if (!card.image) return 'TCGdex has no image for this card, so there is no art to foil.';
  if (entry.effect === 'basic') return 'basic draws no foil: HoloCard shows the plain art.';
  return null;
}

function TileFrame({
  entry,
  selected,
  onSelect,
  caption,
  status,
  after,
  children,
}: TileProps & {
  caption: string;
  status?: string | null;
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          'block w-full rounded-xl border p-2 text-left transition-colors',
          FOCUS_RING,
          selected
            ? 'border-holo-accent bg-holo-panel'
            : 'border-holo-line hover:border-holo-accent',
        )}
      >
        {children}
        {status ? <span className="mt-2 block text-xs text-holo-accent">{status}</span> : null}
        <span className={cn('mt-2 block font-mono text-sm', selected && 'text-holo-accent')}>
          {entry.effect}
        </span>
        <span className="block truncate text-xs text-holo-muted">{caption}</span>
        <Rarities entry={entry} />
      </button>
      {after}
    </>
  );
}

/** The rarities that select this effect, or how it is reached when none does. */
function Rarities({ entry }: { entry: EffectExample }) {
  if (entry.rarities.length === 0) {
    return (
      <span className="mt-2 block text-[0.7rem] text-holo-accent">
        Override · {entry.override ?? 'no rarity of its own'}
      </span>
    );
  }
  return (
    <span className="mt-2 flex flex-wrap gap-1">
      {entry.rarities.map((rarity) => (
        <span
          key={rarity}
          className="rounded border border-holo-line px-1.5 py-0.5 text-[0.7rem] leading-tight text-holo-muted"
        >
          {rarity}
        </span>
      ))}
    </span>
  );
}

function ArtPlaceholder({ children }: { children: ReactNode }) {
  return (
    <span
      className="grid place-items-center rounded-lg border border-holo-line bg-holo-bg p-3 text-center text-xs text-holo-muted"
      style={{ aspectRatio: CARD_ASPECT }}
    >
      {children}
    </span>
  );
}
