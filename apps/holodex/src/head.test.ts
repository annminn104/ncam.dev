import { afterAll, describe, expect, it } from 'vitest';
import { routeHead } from './head';
import { EFFECT_GALLERY } from './holo/effect-gallery';
import { createQueryClient, queryKeys } from './lib/queries';
import type { Card, SetBrief, SetDetail } from './lib/tcgdex';
import { parseRoute } from './routes';

const BASE_SET: SetDetail = {
  id: 'base1',
  name: 'Base Set',
  cardCount: { total: 102, official: 102 },
  releaseDate: '1999-01-09',
  serie: { id: 'base', name: 'Base' },
  cards: [],
};

const CHARIZARD: Card = {
  id: 'base1-4',
  localId: '4',
  name: 'Charizard',
  category: 'Pokemon',
  rarity: 'Rare Holo',
  illustrator: 'Mitsuhiro Arita',
  set: { id: 'base1', name: 'Base Set', cardCount: { total: 102, official: 102 } },
};

const SETS: SetBrief[] = [
  { id: 'base1', name: 'Base Set', cardCount: { total: 102, official: 102 } },
  { id: 'swsh3', name: 'Darkness Ablaze', cardCount: { total: 201, official: 189 } },
];

// Seeded under the views' own keys, as the SSR prefetch leaves them.
const client = createQueryClient();
client.setQueryData(queryKeys.sets, SETS);
client.setQueryData(queryKeys.set('base1'), BASE_SET);
client.setQueryData(queryKeys.card('base1-4'), CHARIZARD);

const head = (route: string, from = client) => routeHead(parseRoute(route), from);

afterAll(() => {
  // Drops the queries, and with them the gc timers they scheduled.
  client.clear();
});

describe('routeHead', () => {
  it('names a card page after the card, its set and its number', () => {
    expect(head('/card/base1-4')).toEqual({
      title: 'Charizard — Base Set #4',
      description:
        'Charizard, card 4 of Base Set (Rare Holo), illustrated by Mitsuhiro Arita. Its stats, and the card rendered in WebGL with the foil its rarity calls for.',
    });
  });

  it('names a set page after the set, and counts its cards', () => {
    expect(head('/sets/base1')).toEqual({
      title: 'Base Set card list',
      description:
        'Base Set, a Base set of 102 cards released 1999-01-09. Filter its cards by type and rarity, and open any card for its stats and holo foil.',
    });
  });

  it('keeps the set page head through filters and pages, as the canonical does', () => {
    // The host's canonical drops the query string, so the title follows it.
    expect(head('/sets/base1?type=Fire&page=2')).toEqual(head('/sets/base1'));
    expect(head('/card/base1-4?variant=reverse')).toEqual(head('/card/base1-4'));
  });

  it('counts the sets when the list loaded, and still describes the page when not', () => {
    expect(head('/sets')?.description).toMatch(/^All 2 Pokémon TCG sets on TCGdex/);
    const empty = createQueryClient();
    expect(head('/sets', empty)).toEqual({
      title: 'Pokémon TCG sets',
      description: expect.stringMatching(/^Every Pokémon TCG set on TCGdex/),
    });
    empty.clear();
  });

  it('sends no head for a set or card whose data did not load', () => {
    // The host then keeps its own title, rather than index a page named after
    // an id TCGdex may not even know.
    const empty = createQueryClient();
    expect(head('/sets/base1', empty)).toBeUndefined();
    expect(head('/card/base1-4', empty)).toBeUndefined();
    expect(head('/sets/nope')).toBeUndefined();
    empty.clear();
  });

  it('names the effects page and each of its sections', () => {
    const [first] = EFFECT_GALLERY;
    expect(head('/')?.title).toBe('Holo foil effects');
    expect(head('/effects')).toEqual(head('/'));
    expect(head('/')?.description).toContain(`All ${EFFECT_GALLERY.length} holo foil effects`);
    expect(head(`/effects/${first.effect}`)?.title).toBe(`${first.effect} — holo foil effect`);
    expect(head(`/effects/${first.effect}?card=${first.cardIds[1]}`)).toEqual(
      head(`/effects/${first.effect}`),
    );
  });

  it('only mentions rarities for a section that has some', () => {
    for (const entry of EFFECT_GALLERY) {
      const description = head(`/effects/${entry.effect}`)?.description ?? '';
      expect(description.includes('rarities')).toBe(entry.rarities.length > 0);
    }
  });

  it('gives every page its own title, never with the host’s branding in it', () => {
    const routes = [
      '/',
      `/effects/${EFFECT_GALLERY[1].effect}`,
      '/sets',
      '/sets/base1',
      '/card/base1-4',
      '/search?q=pikachu',
      '/collection',
      '/no/such/page',
    ];
    const titles = routes.map((route) => head(route)?.title);
    expect(titles.every((title) => typeof title === 'string' && title.length > 0)).toBe(true);
    expect(new Set(titles).size).toBe(routes.length);
    for (const title of titles) expect(title).not.toMatch(/holodex|ncam/i);
  });
});
