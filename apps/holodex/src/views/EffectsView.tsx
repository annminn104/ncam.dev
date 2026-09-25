import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CardImage } from '../components/CardImage';
import {
  EFFECT_GALLERY,
  ERA_QUALIFIER,
  liveSelection,
  selectedCard,
  type EffectExample,
  type GalleryPick,
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
 * How long the pointer rests on a tile before its card goes live: long enough
 * that sweeping across the grid builds and tears down no WebGL context for
 * every tile it passes.
 */
const HOVER_DWELL_MS = 150;

/** Why basic's section is plain art whichever card is live: HoloCard draws no scene for it. */
const BASIC_NOTE = 'basic draws no foil: HoloCard shows the plain art.';

/**
 * Every effect `selectHolo` can return, each in a section of its own on three
 * real cards (`holo/effect-gallery.ts`): the default page, and one page for a
 * GPU smoke pass over all of them, instead of 90 card URLs.
 *
 * Exactly one card on the whole page renders a live `HoloCard`; the other 89
 * are plain art. Each `HoloCard` builds its own three.js renderer, with its
 * own WebGL context, and browsers cap live contexts near 16, so a page of
 * live cards would knock its own earlier canvases out through the
 * `holo.context-lost` path. Hovering a card (or focusing or tapping it, as a
 * touch screen has no hover) moves the live one there.
 *
 * The route names the card live on arrival (`routes.ts`): `/effects/<effect>`
 * is that section's first, `?card=<id>` another of its three. A card picked
 * on the page changes no URL (`liveSelection`): hovering would push a history
 * entry for every tile, and in the host every navigation resets the window's
 * scroll (TanStack Router's `resetScroll`), which jumped the page to its top
 * on each pick. Either way nothing remounts and nothing refetches: two tiles
 * swap their art.
 *
 * Cards load client-side through the card page's own `cardQuery`, one query
 * per tile, so a slow or dead card costs its own tile and nothing else. There
 * is deliberately no SSR prefetch: the page renders its skeletons, and each
 * tile fetches its card.
 */
export function EffectsView({ effect, card }: { effect?: EffectId; card?: string }) {
  const [pick, setPick] = useState<GalleryPick | null>(null);
  const selected = liveSelection(effect, card, pick);
  const liveSection = selected.entry.effect;
  const liveCard = selected.cardId;
  // What the route itself names. Only /effects/<effect> names a section to
  // bring into view; the root opens on the first section's first card, at the
  // top of the page. A pick is on screen already, and scrolls nothing.
  const routed = selectedCard(effect, card);
  const named = effect !== undefined;

  const pageRef = useRef<HTMLDivElement>(null);
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
    if (named) scrollToSection(routed.entry.effect, !settledRef.current);
    settledRef.current = true;
  }, [named, routed.entry.effect, routed.cardId]);

  const select = (section: EffectId, cardId: string) => {
    if (cardId === liveCard) return;
    setPick({ under: { effect, card }, effect: section, cardId });
  };

  return (
    <div ref={pageRef}>
      <h1 className="text-2xl font-semibold tracking-tight">Effects</h1>
      <p className="mt-1 max-w-3xl text-sm text-holo-muted">
        All {EFFECT_GALLERY.length} holo effects, which of the {RARITY_COUNT} TCGdex rarities
        selects each, and three real cards for every one: {CARD_COUNT} in all. One card at a time
        renders its foil live; hover another, or tap it, to move the foil there.
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
        {entry.effect === 'basic' ? (
          <p className="mt-3 rounded-lg border border-holo-line bg-holo-panel px-3 py-2 text-xs leading-5 text-holo-muted">
            {BASIC_NOTE}
          </p>
        ) : null}
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
    <TileFrame {...frame} name={card.name} status={selected ? staticReason(card) : null}>
      {/* Each tile owns its HoloCard, so moving the selection unmounts one
          and mounts the next: one live renderer on the page, ever. (HoloCard
          gives every rebuild a fresh canvas itself — see holoCanvasKey — so
          this layout is not what keeps the foil alive.) The art is
          decorative: the caption below names the card, and the button's name
          should not say it twice. */}
      {selected ? (
        <HoloCard card={card} variant={entry.variant} decorative />
      ) : (
        <CardImage base={cardImageBase(card)} name={card.name} decorative />
      )}
    </TileFrame>
  );
}

/**
 * Why the live tile shows plain art however capable the GPU, spelled out so a
 * smoke pass does not read it as a failure. The art is judged by the base
 * HoloCard itself draws from, cardImageBase — not `card.image`, which a
 * subset-set card never has although its art exists. (basic, which never
 * draws a foil, says so once, in its section's note: BASIC_NOTE.)
 */
function staticReason(card: Card): string | null {
  if (!cardImageBase(card)) return 'TCGdex has no image for this card, so there is no art to foil.';
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
  /** The pending hover: the card goes live once the pointer has rested HOVER_DWELL_MS. */
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelDwell = () => {
    if (dwellRef.current === null) return;
    clearTimeout(dwellRef.current);
    dwellRef.current = null;
  };
  // A tile leaving the page takes its pending hover with it.
  useEffect(() => {
    const dwell = dwellRef;
    return () => {
      if (dwell.current !== null) clearTimeout(dwell.current);
    };
  }, []);
  return (
    <>
      <button
        type="button"
        aria-pressed={selected}
        aria-describedby={status ? statusId : undefined}
        onPointerEnter={(event) => {
          // A touch has no hover: its tap is a click, which selects at once.
          if (event.pointerType === 'touch') return;
          cancelDwell();
          dwellRef.current = setTimeout(() => {
            dwellRef.current = null;
            onSelect();
          }, HOVER_DWELL_MS);
        }}
        onPointerLeave={cancelDwell}
        // The keyboard's hover: a tile tabbed to goes live. Only a visible
        // focus, so a window regaining focus does not bring back a card the
        // pointer has since moved on from.
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) onSelect();
        }}
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
        {/* Every tile on the page is one height, across all 30 sections —
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
