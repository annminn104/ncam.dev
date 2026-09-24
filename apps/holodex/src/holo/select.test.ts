import { describe, expect, it } from 'vitest';
import { CARD_RARITIES } from '../lib/constants';
import type { Card } from '../lib/tcgdex';
import { CAPTURED_CARDS } from './effect-gallery.fixture';
import {
  EFFECT_BY_RARITY,
  MODERN_EFFECT_BY_RARITY,
  OVERRIDE_ONLY_EFFECTS,
  eraOf,
  selectHolo,
  type EffectId,
} from './select';

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

/*
 * Real cards for the era rule's edges, captured verbatim from
 * `GET https://api.tcgdex.net/v2/en/cards/{id}` on 2026-09-24 and trimmed as
 * effect-gallery.fixture.ts trims its own: Ho-Oh and Charizard from the two
 * Mega sets whose ids do not start with `me`, and Accelgor, a Rare from
 * before Scarlet & Violet.
 */
const THIRTIETH_RARE: Card = {
  id: '30th-012',
  localId: '012',
  name: 'Ho-Oh',
  image: 'https://assets.tcgdex.net/en/me/30th/012',
  category: 'Pokemon',
  set: { id: '30th', name: '30th Celebration', cardCount: { total: 158, official: 128 } },
  rarity: 'Rare',
  stage: 'Basic',
  variants: { firstEdition: false, holo: false, normal: true, reverse: false, wPromo: false },
};
const THIRTIETH_CLASSIC: Card = {
  id: '30th-c-001',
  localId: '001',
  name: 'Charizard',
  category: 'Pokemon',
  set: { id: '30th-c', name: '30th Classic Collection', cardCount: { total: 30, official: 0 } },
  rarity: 'None',
  stage: 'Stage2',
  variants: { firstEdition: false, holo: false, normal: true, reverse: false, wPromo: false },
};
const OLDER_RARE: Card = {
  id: 'swsh3-10',
  localId: '10',
  name: 'Accelgor',
  image: 'https://assets.tcgdex.net/en/swsh/swsh3/10',
  category: 'Pokemon',
  set: { id: 'swsh3', name: 'Darkness Ablaze', cardCount: { total: 201, official: 189 } },
  rarity: 'Rare',
  stage: 'Stage1',
  variants: { firstEdition: false, holo: false, normal: true, reverse: true, wPromo: false },
};

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
      'masterball-holo',
      'poke-ball-holo',
      'reverse-holo',
      'trainer-gallery-holo',
      'trainer-gallery-secret-rare',
      'trainer-gallery-v-max',
      'trainer-gallery-v-regular',
    ]);
  });

  it('keeps every override-only effect out of both rarity tables', () => {
    const used = new Set([
      ...Object.values(EFFECT_BY_RARITY),
      ...Object.values(MODERN_EFFECT_BY_RARITY),
    ]);
    const leaked = OVERRIDE_ONLY_EFFECTS.filter((e) => used.has(e));
    expect(leaked).toEqual([]);
  });

  it('accounts for every effect: each is either mapped or override-only', () => {
    const used = new Set<EffectId>([
      ...Object.values(EFFECT_BY_RARITY),
      ...Object.values(MODERN_EFFECT_BY_RARITY),
    ]);
    const declared = new Set<EffectId>([...used, ...OVERRIDE_ONLY_EFFECTS]);
    expect(declared.size).toBe(30);
  });

  it('splits by era only rarities the API returns, each into two different effects', () => {
    // A split whose arms agree would put two chips for one rarity in the same
    // section of the effects page, and select nothing different.
    const splits = Object.entries(MODERN_EFFECT_BY_RARITY);
    expect(splits.length).toBeGreaterThan(0);
    for (const [rarity, modern] of splits) {
      expect(CARD_RARITIES as readonly string[], rarity).toContain(rarity);
      expect(modern, rarity).not.toBe(EFFECT_BY_RARITY[rarity]);
    }
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
    expect(selectHolo(card({ rarity: 'Special illustration rare' })).effect).toBe(
      'ex-special-illustration-rare',
    );
    expect(selectHolo(card({ rarity: 'Hyper rare' })).effect).toBe('hyper-rare');
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
  it('selects ex-regular for a Double rare Pokemon card, clipped to the art window', () => {
    const selection = selectHolo(card({ rarity: 'Double rare', stage: 'Basic' }));
    expect(selection.effect).toBe('ex-regular');
    // The whole point of the fix: this must NOT be 'full' (that's what made
    // the foil cover the entire card, indistinguishable from a real full art).
    // The reference confines ex-regular's foil with a per-card mask and no
    // clip-path, so without the mask the art-window clip is all that does.
    expect(selection.shape).toBe('regular');
  });

  it('gives a Double rare Stage1/Stage2 card the stepped stage region', () => {
    expect(selectHolo(card({ rarity: 'Double rare', stage: 'Stage1' })).shape).toBe('stage');
    expect(selectHolo(card({ rarity: 'Double rare', stage: 'Stage2' })).shape).toBe('stage');
  });

  it('still gives Ultra Rare the full-art treatment — the other ex tier', () => {
    // Regression guard: Double rare and Ultra Rare are both "ex" cards but
    // must stay on opposite sides of FULL_ART. If a future edit collapses
    // them back together, this goes red. The ex Ultra Rare is a Scarlet &
    // Violet (or Mega) card: before them, Ultra Rare was the V/GX full art.
    const selection = selectHolo(card({ id: 'sv03.5-182', localId: '182', rarity: 'Ultra Rare' }));
    expect(selection.effect).toBe('ex-full-art');
    expect(selection.shape).toBe('full');
  });
});

describe('selectHolo — promo subtype foils', () => {
  it('gives an older Promo card with a subtype suffix the v-regular holo treatment', () => {
    expect(selectHolo(card({ rarity: 'Promo', suffix: 'V' })).effect).toBe('v-regular');
    expect(selectHolo(card({ rarity: 'Promo', suffix: 'ex' })).effect).toBe('v-regular');
  });

  it('gives a Scarlet & Violet or Mega Promo with a suffix the standard-layout ex instead', () => {
    // An svp promo ex is the Double rare's layout, so ex-regular, clipped to
    // the art window like it rather than foiled edge to edge.
    const promo = card({ id: 'svp-004', localId: '004', rarity: 'Promo', suffix: 'ex' });
    expect(selectHolo(promo).effect).toBe('ex-regular');
    expect(selectHolo({ ...promo, stage: 'Basic' }).shape).toBe('regular');
    // No suffix, no foil, in this era too.
    expect(selectHolo({ ...promo, suffix: undefined }).effect).toBe('basic');
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

describe('eraOf — Scarlet & Violet and Mega against everything older', () => {
  // A card's set is its id less `-${localId}`, so a brief is enough.
  const era = (id: string, localId: string) => eraOf({ id, localId });

  it('calls the Scarlet & Violet and Mega sets modern, promos included', () => {
    expect(era('sv03.5-026', '026')).toBe('modern');
    expect(era('sv10.5w-173', '173')).toBe('modern');
    expect(era('svp-004', '004')).toBe('modern');
    expect(era('me05-120', '120')).toBe('modern');
    expect(era('me04-122', '122')).toBe('modern');
  });

  it('calls every other set older, the ones that merely end in sv included', () => {
    // The Shiny Vault and McDonald's collections end in `sv`.
    expect(era('swsh4.5sv-SV105', 'SV105')).toBe('older');
    expect(era('2023sv-1', '1')).toBe('older');
    expect(era('2024sv-1', '1')).toBe('older');
    expect(era('swsh3-10', '10')).toBe('older');
    expect(era('sm9-1', '1')).toBe('older');
    expect(era('A1-003', '003')).toBe('older');
  });

  it('only calls a set modern when its id STARTS with sv or me', () => {
    // No TCGdex set has `sv` or `me` then a digit anywhere but at the start of
    // its id, and nothing follows the `sv` of swsh4.5sv or 2023sv, so every
    // real control above passes without the patterns' `^` too. These
    // trainer-kit-style ids are made up, to hold the anchor itself.
    expect(era('tk-sv1-1', '1')).toBe('older');
    expect(era('tk-me1-1', '1')).toBe('older');
  });

  it('counts 30th Celebration and 30th Classic Collection as Mega, though neither id starts with me', () => {
    expect(eraOf(THIRTIETH_RARE)).toBe('modern');
    expect(eraOf(THIRTIETH_CLASSIC)).toBe('modern');
  });
});

describe('selectHolo — the era splits, both arms of each', () => {
  it('selects sv-rare-holo for a Scarlet & Violet or Mega Rare, and basic for an older one', () => {
    // The reference promotes an SV `Rare` to `Rare Holo` and draws it with
    // pokemon-cards-151's own regular holo. 30th Celebration's Rares are Mega
    // by set, so they take that arm too.
    expect(selectHolo(CAPTURED_CARDS['sv03.5-026']).effect).toBe('sv-rare-holo');
    expect(selectHolo(CAPTURED_CARDS['me01-034']).effect).toBe('sv-rare-holo');
    expect(selectHolo(THIRTIETH_RARE).effect).toBe('sv-rare-holo');
    expect(selectHolo(OLDER_RARE).effect).toBe('basic');
  });

  it('keeps pokemon-cards-css’s regular holo for the older holo rares', () => {
    for (const id of ['hgss4-1', 'dp7-96', 'hgss3-83']) {
      expect(selectHolo(CAPTURED_CARDS[id]).effect, id).toBe('regular-holo');
    }
  });

  it('gives a Scarlet & Violet Ultra Rare the full-art ex, and an older one the full-art V or GX', () => {
    const modern = selectHolo(CAPTURED_CARDS['sv03.5-182']);
    const older = selectHolo(CAPTURED_CARDS['sm9-1']);
    expect([modern.effect, modern.shape]).toEqual(['ex-full-art', 'full']);
    expect([older.effect, older.shape]).toEqual(['v-full-art', 'full']);
  });
});

describe('selectHolo — the Scarlet & Violet and Pocket rows, in every era', () => {
  // From simeydotme/pokemon-cards-151's selectors, with Pocket's rarities
  // beside the looks they share. None changes with the era, so each is held
  // on an older card and a Scarlet & Violet one alike.
  it.each<[string, EffectId]>([
    ['Double rare', 'ex-regular'],
    ['Illustration rare', 'illustration-rare'],
    ['Special illustration rare', 'ex-special-illustration-rare'],
    ['Hyper rare', 'hyper-rare'],
    ['Mega Hyper Rare', 'hyper-rare'],
    ['ACE SPEC Rare', 'rainbow-holo'],
    ['Four Diamond', 'ex-regular'],
    ['One Star', 'illustration-rare'],
    ['Two Star', 'ex-full-art'],
    ['Crown', 'hyper-rare'],
    ['Three Diamond', 'sv-rare-holo'],
    ['Two Shiny', 'shiny-v'],
    // Deliberately unmoved: without it rainbow-alt keeps only the two
    // Futuristic Rare cards TCGdex has.
    ['Three Star', 'rainbow-alt'],
  ])('maps %s to %s', (rarity, effect) => {
    expect(selectHolo(card({ rarity })).effect).toBe(effect);
    expect(selectHolo(card({ id: 'sv03.5-026', localId: '026', rarity })).effect).toBe(effect);
  });
});

describe('selectHolo — clip shape of the Scarlet & Violet effects', () => {
  it('foils the whole card for the full-art ex, the special illustration rare and the gold tier', () => {
    // Their reference CSS confines them with a per-card mask and no
    // clip-path; with no mask to drop in, the foil covers the card.
    expect(selectHolo(CAPTURED_CARDS['sv03.5-182']).shape).toBe('full');
    expect(selectHolo(CAPTURED_CARDS['sv03.5-198']).shape).toBe('full');
    expect(selectHolo(CAPTURED_CARDS['sv03.5-205']).shape).toBe('full');
    // A Hyper rare trainer as well: FULL_ART comes before the trainer rule.
    expect(selectHolo(CAPTURED_CARDS['sv03.5-206']).shape).toBe('full');
  });

  it('clips illustration-rare to the border, as its clip-path does', () => {
    expect(selectHolo(CAPTURED_CARDS['sv03.5-166']).shape).toBe('borders');
    expect(selectHolo(card({ rarity: 'One Star', stage: 'Stage1' })).shape).toBe('borders');
  });
});

describe('selectHolo — 151 reverse holos', () => {
  /** A 151 Common numbered `localId`, TCGdex-padded, shown reversed. */
  const reversed = (localId: string) =>
    selectHolo(card({ id: `sv03.5-${localId}`, localId, rarity: 'Common' }), { reverse: true });

  it('gives exactly the reference’s eight card numbers the Master Ball pattern', () => {
    for (const n of ['001', '004', '007', '025', '133', '144', '146', '161']) {
      expect(reversed(n), n).toEqual({ effect: 'masterball-holo', shape: 'regular', invert: true });
    }
  });

  it('gives every other 151 reverse the Poké Ball pattern, and the same one every time', () => {
    // Neighbours of the Master Ball numbers, so an off-by-one shows. The
    // reference promotes a random fifth of these to Master Ball; a card here
    // must render the same on every call.
    for (const n of ['002', '005', '008', '024', '026', '132', '134', '145', '147', '160', '162']) {
      for (let call = 0; call < 3; call += 1) {
        expect(reversed(n), n).toEqual({
          effect: 'poke-ball-holo',
          shape: 'regular',
          invert: true,
        });
      }
    }
  });

  it('clips both patterns to the card’s own region, inverted, as reverse-holo does', () => {
    expect(selectHolo(CAPTURED_CARDS['sv03.5-002'], { reverse: true })).toEqual({
      effect: 'poke-ball-holo',
      shape: 'stage',
      invert: true,
    });
    expect(selectHolo(CAPTURED_CARDS['sv03.5-001'], { reverse: true })).toEqual({
      effect: 'masterball-holo',
      shape: 'regular',
      invert: true,
    });
  });

  it('reverses a 151 Rare too, since a Scarlet & Violet Rare is regular-holo first', () => {
    expect(selectHolo(CAPTURED_CARDS['sv03.5-026'], { reverse: true }).effect).toBe(
      'poke-ball-holo',
    );
  });

  it('shows no pattern unless the reverse printing is asked for, Master Ball numbers included', () => {
    // The reference forces its eight numbers to reverse whatever was asked;
    // here reverse stays the caller's choice. Both of these have a reverse
    // printing in TCGdex (variants.reverse), which must not be enough.
    expect(selectHolo(CAPTURED_CARDS['sv03.5-001'])).toEqual({
      effect: 'basic',
      shape: 'regular',
      invert: false,
    });
    expect(selectHolo(CAPTURED_CARDS['sv03.5-002']).effect).toBe('basic');
  });

  it('never replaces a 151 chase rarity with a pattern', () => {
    expect(selectHolo(CAPTURED_CARDS['sv03.5-166'], { reverse: true }).effect).toBe(
      'illustration-rare',
    );
    expect(selectHolo(CAPTURED_CARDS['sv03.5-003'], { reverse: true }).effect).toBe('ex-regular');
  });

  it('leaves every other set on reverse-holo, other Scarlet & Violet and Mega sets included', () => {
    // Prismatic Evolutions (sv08.5) printed Poké Ball reverses too, but the
    // reference has none for it, so neither do we.
    for (const id of ['sv08.5-001', 'sv01-001', 'me01-001', 'swsh3-3']) {
      const localId = id.slice(id.lastIndexOf('-') + 1);
      expect(selectHolo(card({ id, localId, rarity: 'Common' }), { reverse: true }), id).toEqual({
        effect: 'reverse-holo',
        shape: 'regular',
        invert: true,
      });
    }
  });
});
