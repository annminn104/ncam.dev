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

  it('declares exactly the effects no rarity maps to', () => {
    // Asserted against a literal list, not against OVERRIDE_ONLY_EFFECTS
    // itself — comparing the constant to a filter of itself would pass even
    // if it were empty.
    expect([...OVERRIDE_ONLY_EFFECTS].sort()).toEqual([
      'reverse-holo',
      'trainer-gallery-secret-rare',
      'trainer-gallery-v-max',
      'trainer-gallery-v-regular',
    ]);
  });

  it('keeps every override-only effect out of the rarity table', () => {
    const used = new Set(Object.values(EFFECT_BY_RARITY));
    const leaked = OVERRIDE_ONLY_EFFECTS.filter((e) => used.has(e));
    expect(leaked).toEqual([]);
  });

  it('accounts for every effect: each is either mapped or override-only', () => {
    const used = new Set<EffectId>(Object.values(EFFECT_BY_RARITY));
    const declared = new Set<EffectId>([...used, ...OVERRIDE_ONLY_EFFECTS]);
    expect(declared.size).toBe(22);
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

  it('only treats a localId that STARTS with tg/gg as a gallery card', () => {
    // isTrainerGallery is /^[tg]g/i. Without the anchor the pattern also
    // matches 'tg' anywhere in the string, and an ordinary set-prefixed
    // number like stg1 would silently become a gallery card.
    expect(selectHolo(card({ localId: 'stg1', rarity: 'Holo Rare' })).effect).toBe('regular-holo');
  });

  it('routes a TG-numbered Full Art Trainer to trainer-full-art, not the gallery holo', () => {
    // Every 'Full Art Trainer' in TCGdex is TG-numbered, so before
    // galleryEffect() grew this arm the effect was unreachable in practice
    // and the spec's "22 effects" was one short. A full art trainer is a full
    // art first: it keeps its own foil and the whole-card clip rather than
    // dropping to the gallery's borders clip.
    const selection = selectHolo(
      card({
        localId: 'TG23',
        rarity: 'Full Art Trainer',
        category: 'Trainer',
        trainerType: 'Supporter',
      }),
    );
    expect(selection.effect).toBe('trainer-full-art');
    expect(selection.shape).toBe('full');
  });
});

describe('selectHolo — reverse holo override', () => {
  it('does NOT select reverse-holo just because a reverse printing exists — the regression guard', () => {
    // The defect this suite exists to catch: `variants.reverse` means "a
    // reverse printing of this card also exists in TCGdex," not "this card
    // is the reverse printing." With no `reverse` option (the caller not
    // asking to show the reverse side), a Common card carrying
    // variants.reverse: true must still render as a plain basic card — this
    // is the single most important assertion in this file.
    const c = card({ rarity: 'Common', variants: { reverse: true } });
    const selection = selectHolo(c);
    expect(selection.effect).toBe('basic');
    expect(selection.invert).toBe(false);
  });

  it('selects reverse-holo, inverted, only once the caller explicitly asks for the reverse printing', () => {
    const c = card({ rarity: 'Common', variants: { reverse: true } });
    const selection = selectHolo(c, { reverse: true });
    expect(selection.effect).toBe('reverse-holo');
    expect(selection.invert).toBe(true);
  });

  it('reverses a regular-holo card too — the other half of REVERSIBLE', () => {
    // A previous test claimed regular-holo was reachable through REVERSIBLE
    // but only ever exercised the 'basic' half; removing 'regular-holo' from
    // that set left the old test green.
    const c = card({ rarity: 'Holo Rare', variants: { reverse: true } });
    const selection = selectHolo(c, { reverse: true });
    expect(selection.effect).toBe('reverse-holo');
    expect(selection.invert).toBe(true);
  });

  it('never downgrades a chase rarity, even when explicitly asked to reverse it', () => {
    const c = card({ rarity: 'Secret Rare', variants: { reverse: true } });
    const selection = selectHolo(c, { reverse: true });
    expect(selection.effect).toBe('secret-rare');
    expect(selection.invert).toBe(false);
  });

  it('leaves invert false for everything else', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare' })).invert).toBe(false);
  });

  it('gives gallery override precedence over reverse holo, even when explicitly asked to reverse', () => {
    const c = card({ localId: 'TG10', rarity: 'Holo Rare', variants: { reverse: true } });
    const selection = selectHolo(c, { reverse: true });
    expect(selection.effect).toBe('trainer-gallery-holo');
    expect(selection.invert).toBe(false);
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

  it('keeps a gallery trainer on the borders clip — the BORDERS check comes first', () => {
    // clipShape()'s comment and the spec both say the check order is
    // load-bearing, and this card is the case that proves it: it satisfies
    // both the BORDERS rule and the `category === 'Trainer'` rule. Move the
    // BORDERS check below the trainer rule and it silently drops to
    // 'trainer', shrinking the foil to the art window.
    const selection = selectHolo(
      card({ localId: 'TG23', category: 'Trainer', rarity: 'Uncommon' }),
    );
    expect(selection.effect).toBe('trainer-gallery-holo');
    expect(selection.shape).toBe('borders');
  });

  it('gives an evolution pokemon the stepped stage region', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare', stage: 'Stage1' })).shape).toBe('stage');
    expect(selectHolo(card({ rarity: 'Holo Rare', stage: 'Stage2' })).shape).toBe('stage');
  });

  it('gives a basic pokemon the regular region', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare', stage: 'Basic' })).shape).toBe('regular');
  });
});

describe('selectHolo — Double rare is the standard-layout ex, not a full art', () => {
  it('selects v-regular for a Double rare Pokemon card, clipped to the art window', () => {
    const selection = selectHolo(card({ rarity: 'Double rare', stage: 'Basic' }));
    expect(selection.effect).toBe('v-regular');
    // The whole point of the fix: this must NOT be 'full' (that's what made
    // the foil cover the entire card, indistinguishable from a real full art).
    expect(selection.shape).toBe('regular');
  });

  it('gives a Double rare Stage1/Stage2 card the stepped stage region', () => {
    expect(selectHolo(card({ rarity: 'Double rare', stage: 'Stage1' })).shape).toBe('stage');
    expect(selectHolo(card({ rarity: 'Double rare', stage: 'Stage2' })).shape).toBe('stage');
  });

  it('still gives Ultra Rare the full-art treatment — the other ex tier', () => {
    // Regression guard: Double rare and Ultra Rare are both "ex" cards but
    // must stay on opposite sides of FULL_ART. If a future edit collapses
    // them back together, this goes red.
    const selection = selectHolo(card({ rarity: 'Ultra Rare' }));
    expect(selection.effect).toBe('v-full-art');
    expect(selection.shape).toBe('full');
  });
});

describe('selectHolo — promo subtype foils', () => {
  it('gives a Promo card with a subtype suffix the v-regular holo treatment', () => {
    expect(selectHolo(card({ rarity: 'Promo', suffix: 'V' })).effect).toBe('v-regular');
    expect(selectHolo(card({ rarity: 'Promo', suffix: 'ex' })).effect).toBe('v-regular');
  });

  it('leaves a plain Promo card with no suffix unfoiled', () => {
    expect(selectHolo(card({ rarity: 'Promo' })).effect).toBe('basic');
    expect(selectHolo(card({ rarity: 'Promo', suffix: '' })).effect).toBe('basic');
  });

  it('upgrades only Promo cards — a suffix on any other rarity changes nothing', () => {
    // The guard is `rarity === 'Promo' && suffix`. No test gave a non-Promo
    // card a suffix, so deleting the rarity half left the suite green while
    // every Common/Uncommon reprint carrying a subtype started rendering as
    // a V holo.
    expect(selectHolo(card({ rarity: 'Common', suffix: 'V' })).effect).toBe('basic');
    expect(selectHolo(card({ rarity: 'Uncommon', suffix: 'ex' })).effect).toBe('basic');
  });
});
