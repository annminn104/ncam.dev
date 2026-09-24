import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../app-context';
import { CardImage } from '../components/CardImage';
import {
  EFFECT_GALLERY,
  ERA_QUALIFIER,
  selectedCard,
  type EffectExample,
} from '../holo/effect-gallery';
import { HoloCard } from '../holo/HoloCard';
import type { EffectId } from '../holo/select';
import { useReducedMotion } from '../holo/use-reduced-motion';
import { CARD_ASPECT } from '../lib/constants';
import { cardImageBase } from '../lib/images';
import { cardQuery } from '../lib/queries';
import type { Card } from '../lib/tcgdex';
import { cn } from '../lib/utils';

/**
 * Counted off the gallery, so the intro cannot disagree with the sections under
 * it. Rarities are counted once each, although an era-split one is in two.
 */
const RARITY_COUNT = new Set(
  EFFECT_GALLERY.flatMap((entry) => entry.rarities.map(({ rarity }) => rarity)),
).size;
const CARD_COUNT = EFFECT_GALLERY.reduce((sum, entry) => sum + entry.cardIds.length, 0);

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
 * Every effect `selectHolo` can return, each in a section of its own on three
 * real cards (`holo/effect-gallery.ts`): one page for a GPU smoke pass over
 * all of them, instead of 90 card URLs.
 *
 * Exactly one card on the whole page renders a live `HoloCard`; the other 89
 * are plain art. Each `HoloCard` builds its own three.js renderer, with its
 * own WebGL context, and browsers cap live contexts near 16, so a page of
 * live cards would knock its own earlier canvases out through the
 * `holo.context-lost` path. Picking a card moves the live one there.
 *
 * The route names the live card (`routes.ts`): `/effects/<effect>` is that
 * section's first, `?card=<id>` another of its three. Both are state inside
 * this one view (`viewKey` stays `effects`), so picking a card remounts
 * nothing and refetches nothing: two tiles swap their art.
 *
 * Cards load client-side through the card page's own `cardQuery`, one query
 * per tile, so a slow or dead card costs its own tile and nothing else. There
 * is deliberately no SSR prefetch for this diagnostic view.
 */
export function EffectsView({ effect, card }: { effect?: EffectId; card?: string }) {
  const navigate = useNavigate();
  const selected = selectedCard(effect, card);
  const liveSection = selected.entry.effect;
  const liveCard = selected.cardId;
  // Only /effects/<effect> names a section to bring into view. Bare /effects
  // opens on the first section's first card, and at the top of the page.
  const named = effect !== undefined;

  const pageRef = useRef<HTMLDivElement>(null);
  /** The card a click on this page asked for, until the route brings it. */
  const clickedRef = useRef<string | null>(null);
  /** False until the effect below first runs: the render a deep link lands on. */
  const settledRef = useRef(false);
  const reducedMotion = useReducedMotion();

  const scrollToSection = useEffectEvent((section: EffectId, instant: boolean) => {
    // Instant on the landing, the way a #fragment lands — which is also
    // before useReducedMotion has read the media query at all — and always
    // under reduced motion. scrollIntoView moves no focus.
    pageRef.current?.querySelector(`[data-section="${section}"]`)?.scrollIntoView({
      block: 'start',
      behavior: instant || reducedMotion ? 'auto' : 'smooth',
    });
  });

  useEffect(() => {
    // A card clicked here is on screen already: scrolling its section to the
    // top would only pull the page out from under the pointer. Card ids are
    // unique across the page (effect-gallery.test.ts), so the id is enough.
    const ownClick = clickedRef.current === liveCard;
    clickedRef.current = null;
    if (named && !ownClick) scrollToSection(liveSection, !settledRef.current);
    settledRef.current = true;
  }, [named, liveSection, liveCard]);

  const select = (section: EffectId, cardId: string) => {
    if (cardId === liveCard) return;
    clickedRef.current = cardId;
    navigate({ view: 'effects', effect: section, card: cardId });
  };

  return (
    <div ref={pageRef}>
      <h1 className="text-2xl font-semibold tracking-tight">Effects</h1>
      <p className="mt-1 max-w-3xl text-sm text-holo-muted">
        All {EFFECT_GALLERY.length} holo effects, which of the {RARITY_COUNT} TCGdex rarities
        selects each, and three real cards for every one: {CARD_COUNT} in all. Only the selected
        card renders its foil live; pick another to move it there.
      </p>

      {EFFECT_GALLERY.map((entry) => (
        <EffectSection
          key={entry.effect}
          entry={entry}
          liveCard={entry.effect === liveSection ? liveCard : null}
          onSelect={(cardId) => select(entry.effect, cardId)}
        />
      ))}
    </div>
  );
}

function EffectSection({
  entry,
  liveCard,
  onSelect,
}: {
  entry: EffectExample;
  /** The live card, when it is one of this section's; otherwise null. */
  liveCard: string | null;
  onSelect: (cardId: string) => void;
}) {
  return (
    // scroll-mt keeps the heading clear of the Shell's sticky header when
    // navigation scrolls this section into view.
    <section
      data-section={entry.effect}
      className="mt-6 scroll-mt-20 border-t border-holo-line pt-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6"
    >
      <div>
        <h2 className="font-mono text-base font-semibold">{entry.effect}</h2>
        <Rarities entry={entry} />
      </div>
      <ul
        aria-label={`${entry.effect} cards`}
        className="mt-4 grid grid-cols-3 gap-2 sm:gap-4 lg:mt-0"
      >
        {entry.cardIds.map((cardId) => (
          <li key={cardId}>
            <ExampleTile
              entry={entry}
              cardId={cardId}
              selected={cardId === liveCard}
              onSelect={() => onSelect(cardId)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TileProps {
  entry: EffectExample;
  cardId: string;
  selected: boolean;
  onSelect: () => void;
}

function ExampleTile({ entry, cardId, selected, onSelect }: TileProps) {
  // One query per tile, so a slow or dead card costs its own tile an error,
  // never its section or the page.
  const { data: card, error, isPending, refetch } = useQuery(cardQuery(cardId));
  const frame = { cardId, selected, onSelect };

  if (isPending) {
    return (
      <TileFrame {...frame}>
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
        {...frame}
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
    <TileFrame {...frame} name={card.name} status={selected ? staticReason(entry, card) : null}>
      {/* Each tile owns its HoloCard, so moving the selection unmounts one
          and mounts the next: one live renderer on the page, ever. (HoloCard
          gives every rebuild a fresh canvas itself — see holoCanvasKey — so
          this layout is not what keeps the foil alive.) The art is
          decorative: the caption below names the card, and the button's name
          should not say it twice. */}
      {selected ? (
        <HoloCard card={card} reverse={entry.reverse} decorative />
      ) : (
        <CardImage base={cardImageBase(card)} name={card.name} decorative />
      )}
    </TileFrame>
  );
}

/**
 * Why the live tile shows plain art however capable the GPU: HoloCard's own
 * early returns, spelled out so a smoke pass does not read them as a failure.
 * The art is judged by the base HoloCard itself draws from, cardImageBase —
 * not `card.image`, which a subset-set card never has although its art exists.
 */
function staticReason(entry: EffectExample, card: Card): string | null {
  if (!cardImageBase(card)) return 'TCGdex has no image for this card, so there is no art to foil.';
  if (entry.effect === 'basic') return 'basic draws no foil: HoloCard shows the plain art.';
  return null;
}

function TileFrame({
  cardId,
  name,
  selected,
  onSelect,
  status,
  after,
  children,
}: Omit<TileProps, 'entry'> & {
  /** The card's name, once it has loaded. */
  name?: string;
  status?: string | null;
  after?: ReactNode;
  children: ReactNode;
}) {
  const statusId = useId();
  return (
    <>
      <button
        type="button"
        aria-pressed={selected}
        aria-describedby={status ? statusId : undefined}
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
        {/* Every tile on the page is one height, across all 29 sections —
            separate grids, so a row's stretch cannot do it. The art is a
            fixed 63/88, and the caption under it a fixed height: the name
            clamped to two lines and always two lines tall, even for
            "Pikachu" or while loading, then the id on one. The clamp is
            visual only: the button's accessible name keeps the whole name,
            and `title` shows it on hover. */}
        <span
          title={name}
          className={cn('mt-2 line-clamp-2 h-10 text-sm leading-5', selected && 'text-holo-accent')}
        >
          {name}
        </span>
        <span className="block truncate font-mono text-xs text-holo-muted">{cardId}</span>
      </button>
      {/* Outside the button, so the live tile is no taller than the rest. */}
      {status ? (
        <p id={statusId} className="mt-2 text-xs text-holo-accent">
          {status}
        </p>
      ) : null}
      {after}
    </>
  );
}

/**
 * The rarities that select this effect, or how it is reached when none does. A
 * rarity whose effect depends on the era says which arm this is: it has a chip
 * in two sections, each qualified, and the one here is only true of that era.
 * The chip's text is one string, the rarity and its qualifier together.
 */
function Rarities({ entry }: { entry: EffectExample }) {
  if (entry.rarities.length === 0) {
    return (
      <p className="mt-2 text-[0.7rem] text-holo-accent">
        Override · {entry.override ?? 'no rarity of its own'}
      </p>
    );
  }
  return (
    <p className="mt-2 flex flex-wrap gap-1">
      {entry.rarities.map(({ rarity, era }) => (
        <span
          key={`${rarity}|${era ?? ''}`}
          data-rarity={rarity}
          data-era={era}
          className="rounded border border-holo-line px-1.5 py-0.5 text-[0.7rem] leading-tight text-holo-muted"
        >
          {era ? `${rarity} · ${ERA_QUALIFIER[era]}` : rarity}
        </span>
      ))}
    </p>
  );
}

/** overflow-hidden pins it to its aspect ratio: a long error message is clipped, never a taller tile. */
function ArtPlaceholder({ children }: { children: ReactNode }) {
  return (
    <span
      className="grid place-items-center overflow-hidden rounded-lg border border-holo-line bg-holo-bg p-3 text-center text-xs text-holo-muted"
      style={{ aspectRatio: CARD_ASPECT }}
    >
      {children}
    </span>
  );
}
