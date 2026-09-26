import { describe, expect, it } from 'vitest';
import { cardImageBase, imageUrl, imageUrls, setImageUrls } from './images';

const BASE = 'https://assets.tcgdex.net/en/swsh/swsh3/136';

describe('imageUrl', () => {
  it('appends the quality and format as a path suffix', () => {
    expect(imageUrl(BASE, 'low')).toBe(`${BASE}/low.webp`);
    expect(imageUrl(BASE, 'high')).toBe(`${BASE}/high.webp`);
  });

  it('supports png for the few consumers that need it', () => {
    expect(imageUrl(BASE, 'high', 'png')).toBe(`${BASE}/high.png`);
  });

  it('returns null when the card has no image (about 20% of briefs)', () => {
    expect(imageUrl(undefined, 'low')).toBeNull();
    expect(imageUrl(null, 'low')).toBeNull();
    expect(imageUrl('', 'low')).toBeNull();
  });

  it('does not double the slash when the base has a trailing one', () => {
    expect(imageUrl(`${BASE}/`, 'low')).toBe(`${BASE}/low.webp`);
  });
});

describe('imageUrls', () => {
  it('tries a card’s art as WebP, then as PNG', () => {
    expect(imageUrls(BASE, 'low')).toEqual([`${BASE}/low.webp`, `${BASE}/low.png`]);
    expect(imageUrls(BASE, 'high')).toEqual([`${BASE}/high.webp`, `${BASE}/high.png`]);
  });

  it('has nothing to try for a card without an image', () => {
    expect(imageUrls(undefined, 'low')).toEqual([]);
    expect(imageUrls(null, 'high')).toEqual([]);
  });
});

describe('setImageUrls', () => {
  const LOGO = 'https://assets.tcgdex.net/en/xy/xy3/logo';
  const SYMBOL = 'https://assets.tcgdex.net/univ/xy/xy3/symbol';

  it('tries the logo as WebP, then as the PNG basep, hgss3 and xy3 only have, then the symbol', () => {
    // Checked 2026-09-25 across all 157 set logos: those three 404 as .webp.
    expect(setImageUrls({ logo: LOGO, symbol: SYMBOL })).toEqual([
      `${LOGO}.webp`,
      `${LOGO}.png`,
      `${SYMBOL}.webp`,
      `${SYMBOL}.png`,
    ]);
  });

  it('goes straight to the symbol for a set without a logo, and has nothing for one without either', () => {
    expect(setImageUrls({ symbol: SYMBOL })).toEqual([`${SYMBOL}.webp`, `${SYMBOL}.png`]);
    expect(setImageUrls({})).toEqual([]);
  });
});

describe('cardImageBase', () => {
  it.each([
    ['a main-set card', { id: 'swsh3-136', localId: '136', image: BASE }],
    // Were the API ever to link subset art itself, its answer would win.
    [
      'a subset-set card, which the rule would otherwise rewrite',
      {
        id: 'swsh12tg-TG23',
        localId: 'TG23',
        image: 'https://assets.tcgdex.net/en/swsh/swsh12tg/TG23',
      },
    ],
  ])('returns the image the API links, unchanged: %s', (_, card) => {
    expect(cardImageBase(card)).toBe(card.image);
  });

  // A real card from each of the six subset sets, which the API serves with no
  // image. All 312 of their cards resolve at exactly this path.
  it.each([
    ['swsh4.5sv-SV106', 'SV106', 'https://assets.tcgdex.net/en/swsh/swsh4.5/SV106'], // Rillaboom VMAX
    ['swsh9tg-TG01', 'TG01', 'https://assets.tcgdex.net/en/swsh/swsh9/TG01'], // Flareon
    ['swsh10tg-TG01', 'TG01', 'https://assets.tcgdex.net/en/swsh/swsh10/TG01'], // Abomasnow
    ['swsh11tg-TG01', 'TG01', 'https://assets.tcgdex.net/en/swsh/swsh11/TG01'], // Parasect
    ['swsh12tg-TG23', 'TG23', 'https://assets.tcgdex.net/en/swsh/swsh12/TG23'], // Friends in Galar
    ['swsh12.5gg-GG35', 'GG35', 'https://assets.tcgdex.net/en/swsh/swsh12.5/GG35'], // Leafeon VSTAR
  ])('recovers %s from its parent set', (id, localId, expected) => {
    expect(cardImageBase({ id, localId })).toBe(expected);
  });

  // Real cards the rule must not reach, given with no image.
  it.each([
    ['sv03.5-003', '003'], // Venusaur ex: Scarlet & Violet ids start with sv
    ['sv04.5-212', '212'], // Forretress ex
    ['sv10.5b-171', '171'], // Victini
    ['swsh12-100', '100'], // Palossand: a parent set is not a subset
    ['swsh4.5-1', '1'], // Yanma
    ['2023sv-1', '1'], // Sprigatito, McDonald's Collection 2023: ends in sv, and has no image
  ])('leaves %s imageless', (id, localId) => {
    expect(cardImageBase({ id, localId })).toBeUndefined();
  });

  it('leaves cel25cc imageless, because its parent path serves a different card', () => {
    // en/swsh/cel25/1 answers 200 with Ho-Oh. cel25cc-CC001 is Blastoise.
    expect(cardImageBase({ id: 'cel25cc-CC001', localId: 'CC001' })).toBeUndefined();
  });

  // Synthetic: no TCGdex set has these shapes today. One per edge of the rule,
  // each modelled on a real id, so that no edge can loosen unnoticed.
  it.each([
    ['something before swsh, like 2022swsh (the ^ anchor)', '2022swsh12tg-TG01', 'TG01'],
    ['something after the subset suffix, like 30th-c (the $ anchor)', 'swsh12tg-c-TG01', 'TG01'],
    ['a vault outside swsh, beside sm115 (the swsh prefix)', 'sm115sv-SV1', 'SV1'],
  ])('rejects %s', (_, id, localId) => {
    expect(cardImageBase({ id, localId })).toBeUndefined();
  });

  it('strips the whole localId off the id, even one containing a hyphen', () => {
    // Synthetic: no localId has a hyphen today (0 of 23,736 cards), but set ids
    // do (P-A, 30th-c), so the set id is what remains once `-${localId}` comes
    // off the end, never a split on '-'.
    expect(cardImageBase({ id: 'swsh12tg-TG-23', localId: 'TG-23' })).toBe(
      'https://assets.tcgdex.net/en/swsh/swsh12/TG-23',
    );
  });

  it('derives nothing from an id that does not end in its localId', () => {
    expect(cardImageBase({ id: 'swsh12tg-TG23', localId: 'TG24' })).toBeUndefined();
  });
});
