import { describe, expect, it } from 'vitest';
import { CARD_RARITIES } from '../lib/constants';
import type { Card } from '../lib/tcgdex';
import { EFFECT_BY_RARITY, OVERRIDE_ONLY_EFFECTS, selectHolo, type EffectId } from './select';

/** Minimal card; every test overrides only what it cares about. */
function card(patch: Partial<Card> = {}): Card {
  return {
    id: 'swsh3-1',
    localId: '1',
    name: 'Test',
    category: 'Pokemon',
    set: { id: 'swsh3', name: 'Darkness Ablaze', cardCount: { total: 201, official: 189 } },
    ...patch,
  } as Card;
}

describe('EFFECT_BY_RARITY', () => {
  it('maps every rarity the API returns', () => {
    const unmapped = CARD_RARITIES.filter((r) => !(r in EFFECT_BY_RARITY));
    expect(unmapped).toEqual([]);
  });

  it('has no entry for a rarity the API does not list', () => {
    const stray = Object.keys(EFFECT_BY_RARITY).filter(
      (r) => !(CARD_RARITIES as readonly string[]).includes(r),
    );
    expect(stray).toEqual([]);
  });

  it('leaves exactly the override-only effects out of the table', () => {
    const used = new Set(Object.values(EFFECT_BY_RARITY));
    const absent = OVERRIDE_ONLY_EFFECTS.filter((e) => !used.has(e));
    expect(absent.sort()).toEqual(
      [
        'reverse-holo',
        'trainer-gallery-holo',
        'trainer-gallery-secret-rare',
        'trainer-gallery-v-max',
        'trainer-gallery-v-regular',
      ]
        .filter((e) => OVERRIDE_ONLY_EFFECTS.includes(e as EffectId))
        .sort(),
    );
  });
});

describe('selectHolo — rarity table', () => {
  it('gives everyday rarities the basic effect', () => {
    expect(selectHolo(card({ rarity: 'Common' })).effect).toBe('basic');
    expect(selectHolo(card({ rarity: 'Uncommon' })).effect).toBe('basic');
    expect(selectHolo(card({ rarity: 'Rare' })).effect).toBe('basic');
  });

  it('distinguishes the two holo spellings onto the same effect', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare' })).effect).toBe('regular-holo');
    expect(selectHolo(card({ rarity: 'Rare Holo' })).effect).toBe('regular-holo');
  });

  it('maps the V family to its own effects', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare V' })).effect).toBe('v-regular');
    expect(selectHolo(card({ rarity: 'Holo Rare VMAX' })).effect).toBe('v-max');
    expect(selectHolo(card({ rarity: 'Holo Rare VSTAR' })).effect).toBe('v-star');
  });

  it('maps the chase rarities', () => {
    expect(selectHolo(card({ rarity: 'Secret Rare' })).effect).toBe('secret-rare');
    expect(selectHolo(card({ rarity: 'Special illustration rare' })).effect).toBe('secret-rare');
    expect(selectHolo(card({ rarity: 'Hyper rare' })).effect).toBe('rainbow-holo');
    expect(selectHolo(card({ rarity: 'Radiant Rare' })).effect).toBe('radiant-holo');
    expect(selectHolo(card({ rarity: 'Amazing Rare' })).effect).toBe('amazing-rare');
    expect(selectHolo(card({ rarity: 'Pikachu Rare' })).effect).toBe('swsh-pikachu');
  });

  it('falls back to basic for an unknown rarity', () => {
    expect(selectHolo(card({ rarity: 'Brand New Rarity 2027' })).effect).toBe('basic');
    expect(selectHolo(card({})).effect).toBe('basic');
  });
});

describe('selectHolo — trainer gallery override', () => {
  it('detects a gallery card from its localId and routes the V family', () => {
    expect(selectHolo(card({ localId: 'TG01', rarity: 'Holo Rare V' })).effect).toBe(
      'trainer-gallery-v-regular',
    );
    expect(selectHolo(card({ localId: 'tg12', rarity: 'Holo Rare VMAX' })).effect).toBe(
      'trainer-gallery-v-max',
    );
    expect(selectHolo(card({ localId: 'GG05', rarity: 'Secret Rare' })).effect).toBe(
      'trainer-gallery-secret-rare',
    );
    expect(selectHolo(card({ localId: 'TG20', rarity: 'Holo Rare' })).effect).toBe(
      'trainer-gallery-holo',
    );
  });

  it('does not treat an ordinary numeric localId as a gallery card', () => {
    expect(selectHolo(card({ localId: '136', rarity: 'Holo Rare' })).effect).toBe('regular-holo');
  });
});

describe('selectHolo — reverse holo override', () => {
  it('turns a basic or regular-holo card with a reverse printing into reverse-holo', () => {
    const c = card({ rarity: 'Common', variants: { reverse: true } });
    expect(selectHolo(c).effect).toBe('reverse-holo');
    expect(selectHolo(c).invert).toBe(true);
  });

  it('never downgrades a chase rarity that also has a reverse printing', () => {
    const c = card({ rarity: 'Secret Rare', variants: { reverse: true } });
    expect(selectHolo(c).effect).toBe('secret-rare');
    expect(selectHolo(c).invert).toBe(false);
  });

  it('leaves invert false for everything else', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare' })).invert).toBe(false);
  });
});

describe('selectHolo — clip shape', () => {
  it('clips radiant and gallery cards to the borders', () => {
    expect(selectHolo(card({ rarity: 'Radiant Rare' })).shape).toBe('borders');
    expect(selectHolo(card({ localId: 'TG20', rarity: 'Holo Rare' })).shape).toBe('borders');
  });

  it('gives a full art trainer the whole card', () => {
    expect(
      selectHolo(
        card({ rarity: 'Full Art Trainer', category: 'Trainer', trainerType: 'Supporter' }),
      ).shape,
    ).toBe('full');
  });

  it('gives the full-art family the whole card', () => {
    expect(selectHolo(card({ rarity: 'Secret Rare' })).shape).toBe('full');
    expect(selectHolo(card({ rarity: 'Holo Rare VMAX' })).shape).toBe('full');
  });

  it('gives an ordinary trainer the trainer region', () => {
    expect(selectHolo(card({ category: 'Trainer', rarity: 'Uncommon' })).shape).toBe('trainer');
  });

  it('gives an evolution pokemon the stepped stage region', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare', stage: 'Stage1' })).shape).toBe('stage');
    expect(selectHolo(card({ rarity: 'Holo Rare', stage: 'Stage2' })).shape).toBe('stage');
  });

  it('gives a basic pokemon the regular region', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare', stage: 'Basic' })).shape).toBe('regular');
  });
});
