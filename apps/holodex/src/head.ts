import type { QueryClient } from '@tanstack/react-query';
import type { SsrHead } from '@ncam/mf-remote';
import { EFFECT_GALLERY } from './holo/effect-gallery';
import { cardQuery, setQuery, setsQuery } from './lib/queries';
import type { Card, SetBrief, SetDetail } from './lib/tcgdex';
import type { Route } from './routes';

/**
 * What the page at `route` is, for the host's `<head>` (`SsrHead` in
 * packages/mf-remote/src/contract.ts): a title of its own, so no two Holodex
 * URLs share the project's, and a description. The host adds its own
 * branding, so a title here never says "Holodex".
 *
 * Read off the cache the SSR prefetch just filled, through the same query
 * factories the views use, so a set or card page is named after the set or
 * card itself. A set or card whose data did not load gets no head at all: the
 * host then keeps its project title rather than index a page named after an
 * id TCGdex may not even know. Pure: no fetch, no DOM.
 */
export function routeHead(route: Route, client: QueryClient): SsrHead | undefined {
  switch (route.view) {
    case 'sets': {
      const sets = client.getQueryData<SetBrief[]>(setsQuery().queryKey);
      return {
        title: 'Pokémon TCG sets',
        description: `${sets ? `All ${sets.length} Pokémon TCG sets` : 'Every Pokémon TCG set'} on TCGdex, A to Z: open one for its full card list, filtered by type and rarity.`,
      };
    }
    case 'set': {
      const set = client.getQueryData<SetDetail>(setQuery(route.setId).queryKey);
      if (!set?.name) return undefined;
      const series = set.serie?.name ? `, a ${set.serie.name} set` : '';
      const count = set.cardCount?.official ? ` of ${set.cardCount.official} cards` : '';
      const released = set.releaseDate ? ` released ${set.releaseDate}` : '';
      return {
        title: `${set.name} card list`,
        description: `${set.name}${series}${count}${released}. Filter its cards by type and rarity, and open any card for its stats and holo foil.`,
      };
    }
    case 'card': {
      const card = client.getQueryData<Card>(cardQuery(route.cardId).queryKey);
      if (!card?.name) return undefined;
      const set = card.set?.name;
      const rarity = card.rarity ? ` (${card.rarity})` : '';
      const illustrator = card.illustrator ? `, illustrated by ${card.illustrator}` : '';
      return {
        title: set ? `${card.name} — ${set} #${card.localId}` : card.name,
        description: `${card.name}${set ? `, card ${card.localId} of ${set}` : ''}${rarity}${illustrator}. Its stats, and the card rendered in WebGL with the foil its rarity calls for.`,
      };
    }
    case 'search':
      // Every query shares this: the host's canonical drops the query string.
      return {
        title: 'Search Pokémon TCG cards',
        description:
          'Search every Pokémon TCG card on TCGdex by name, and narrow the results by type and rarity.',
      };
    case 'collection':
      return {
        title: 'Your collection',
        description:
          'The Pokémon TCG cards you own and the ones on your wishlist, kept in this browser: mark them from any card page.',
      };
    case 'effects': {
      const entry = EFFECT_GALLERY.find((candidate) => candidate.effect === route.effect);
      if (!entry) {
        return {
          title: 'Holo foil effects',
          description: `All ${EFFECT_GALLERY.length} holo foil effects Holodex draws in WebGL, the TCGdex rarities that select each, and three real cards for every one.`,
        };
      }
      return {
        title: `${entry.effect} — holo foil effect`,
        description: `How Holodex draws the ${entry.effect} foil in WebGL${entry.rarities.length > 0 ? ', which card rarities call for it,' : ''} and three real cards that show it.`,
      };
    }
    case 'not-found':
      return { title: 'Page not found' };
  }
}
