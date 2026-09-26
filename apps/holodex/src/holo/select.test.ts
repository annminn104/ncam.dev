import { describe, expect, it } from 'vitest';
import { CARD_RARITIES } from '../lib/constants';
import type { Card } from '../lib/tcgdex';
import { CAPTURED_CARDS } from './effect-gallery.fixture';
import {
  EFFECT_BY_RARITY,
  MODERN_EFFECT_BY_RARITY,
  DEFAULT_GLOW,
  DEFAULT_FOIL_BRIGHTNESS,
  OVERRIDE_ONLY_EFFECTS,
  eraOf,
  foilBrightnessOf,
  glowOf,
  layoutOf,
  selectHolo,
  type EffectId,
  type HoloSelection,
} from './select';
import { hsl } from './effects/css';
import { coversPoint, type CardLayout } from './regions';

/** What a selection shows: its effect, where it is confined, and whether that is inverted. */
const shown = ({ effect, shape, invert }: HoloSelection) => ({ effect, shape, invert });

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
    // art first: it keeps its own foil and its full-art frame rather than
    // dropping to the gallery's borders clip.
    const selection = selectHolo(
      card({
        localId: 'TG23',
        rarity: 'Full Art Trainer',
        category: 'Trainer',
        trainerType: 'Supporter',
      }),
    );
    expect([selection.effect, selection.shape, selection.layout]).toEqual([
      'trainer-full-art',
      'trainer',
      'swsh-ultra',
    ]);
  });

  it('routes a Trainer Gallery Ultra Rare Supporter to trainer-full-art too', () => {
    // TCGdex files swsh10tg's Piers and swsh11tg's Kabu as Ultra Rare; the
    // reference draws them, rare ultra Supporters, with trainer-full-art.css.
    const piers = selectHolo(
      card({
        id: 'swsh10tg-TG28',
        localId: 'TG28',
        name: 'Piers',
        category: 'Trainer',
        trainerType: 'Supporter',
        rarity: 'Ultra Rare',
      }),
    );
    expect(piers.effect).toBe('trainer-full-art');
    const kabu = selectHolo(
      card({
        id: 'swsh11tg-TG26',
        localId: 'TG26',
        name: 'Kabu',
        category: 'Trainer',
        trainerType: 'Supporter',
        rarity: 'Ultra Rare',
      }),
    );
    expect([kabu.effect, kabu.shape, kabu.layout]).toEqual([
      'trainer-full-art',
      'trainer',
      'swsh-ultra',
    ]);
    // The Galarian Gallery's are too, on a frame of their own: its ten masks
    // foil the TRAINER header the others leave out, and cut the rule box alone.
    const cynthia = selectHolo(
      card({
        id: 'swsh12.5gg-GG60',
        localId: 'GG60',
        name: 'Cynthia’s Ambition',
        category: 'Trainer',
        trainerType: 'Supporter',
        rarity: 'Ultra Rare',
      }),
    );
    expect([cynthia.effect, cynthia.shape, cynthia.layout]).toEqual([
      'trainer-full-art',
      'trainer',
      'swsh-galarian-trainer',
    ]);
    // A gallery Pokémon Ultra Rare is no Supporter: it takes its V family's
    // gallery look (below).
    const starmie = selectHolo(
      card({
        id: 'swsh10tg-TG13',
        localId: 'TG13',
        name: 'Starmie V',
        rarity: 'Ultra Rare',
        stage: 'Basic',
      }),
    );
    expect(starmie.effect).toBe('trainer-gallery-v-regular');
  });

  it('routes a gallery Ultra Rare V, VMAX or VSTAR as the reference draws it', () => {
    // TCGdex files the V family of three Trainer Galleries and the Galarian
    // Gallery as Ultra Rare (swsh12tg's alone as Holo Rare V and VMAX), where
    // pokemontcg.io, which the reference reads, files them Rare Holo V, VMAX
    // and VSTAR: a gallery V takes v-full-art.css under
    // trainer-gallery-v-regular.css's glare, a gallery VMAX rainbow-alt.css
    // under trainer-gallery-v-max.css's, and a gallery VSTAR v-star.css,
    // which has no gallery variant. These are real cards (2026-09-26). A V
    // and a VMAX take their frames (below); the VSTAR, the whole card.
    for (const [id, name, stage, effect, shape] of [
      ['swsh10tg-TG13', 'Starmie V', 'Basic', 'trainer-gallery-v-regular', 'regular'],
      ['swsh12.5gg-GG36', 'Entei V', 'Basic', 'trainer-gallery-v-regular', 'regular'],
      ['swsh9tg-TG17', 'Mimikyu VMAX', 'VMAX', 'trainer-gallery-v-max', 'regular'],
      ['swsh12.5gg-GG42', 'Zeraora VMAX', 'VMAX', 'trainer-gallery-v-max', 'regular'],
      ['swsh12.5gg-GG35', 'Leafeon VSTAR', 'VSTAR', 'v-star', 'full'],
    ] as const) {
      const localId = id.slice(id.lastIndexOf('-') + 1);
      const s = selectHolo(card({ id, localId, name, rarity: 'Ultra Rare', stage }));
      expect([s.effect, s.shape], id).toEqual([effect, shape]);
    }
  });

  it('frames a gallery V by its number, whatever its rarity, less the bars its masks leave out', () => {
    // All 38 gallery V's masks (2026-09-26) leave out the weakness bar and
    // the V rule box, and a Trainer Gallery V's its black border besides,
    // where the Galarian Gallery's silver border takes foil.
    const kricketune = selectHolo(CAPTURED_CARDS['swsh12tg-TG12']);
    const mimikyu = selectHolo(CAPTURED_CARDS['swsh9tg-TG16']);
    const entei = selectHolo(
      card({
        id: 'swsh12.5gg-GG36',
        localId: 'GG36',
        name: 'Entei V',
        rarity: 'Ultra Rare',
        stage: 'Basic',
      }),
    );
    for (const [s, layout] of [
      [kricketune, 'swsh-gallery-v'],
      [mimikyu, 'swsh-gallery-v'],
      [entei, 'swsh-ultra-v'],
    ] as const) {
      expect([s.effect, s.shape, s.layout]).toEqual([
        'trainer-gallery-v-regular',
        'regular',
        layout,
      ]);
    }
  });

  it('frames a gallery VMAX by its number, whatever its rarity, less its header and its bars', () => {
    // All 18 gallery VMAX's masks (2026-09-26) leave out the header's silver
    // panels, the weakness bar and the VMAX rule box; a Trainer Gallery's
    // border and a Galarian Gallery's alike take foil.
    const blaziken = selectHolo(CAPTURED_CARDS['swsh12tg-TG15']);
    const mimikyu = selectHolo(CAPTURED_CARDS['swsh9tg-TG17']);
    const zeraora = selectHolo(
      card({
        id: 'swsh12.5gg-GG42',
        localId: 'GG42',
        name: 'Zeraora VMAX',
        rarity: 'Ultra Rare',
        stage: 'VMAX',
      }),
    );
    for (const s of [blaziken, mimikyu, zeraora]) {
      expect([s.effect, s.shape, s.layout]).toEqual([
        'trainer-gallery-v-max',
        'regular',
        'swsh-gallery-vmax',
      ]);
    }
  });

  it('keeps a gallery VSTAR of any rarity on v-star, and any other gallery Ultra Rare on v-full-art', () => {
    // No gallery stylesheet names a VSTAR, nor a rare ultra, which
    // v-full-art.css draws in a gallery or out of one.
    const vstar = selectHolo(
      card({ localId: 'GG40', name: 'Test VSTAR', rarity: 'Holo Rare VSTAR', stage: 'VSTAR' }),
    );
    expect(vstar.effect).toBe('v-star');
    const other = selectHolo(
      card({ localId: 'TG40', name: 'Test', rarity: 'Ultra Rare', stage: 'Basic' }),
    );
    expect(other.effect).toBe('v-full-art');
  });
});

describe('selectHolo — reverse holo override', () => {
  it('does NOT select reverse-holo just because a reverse printing exists — the regression guard', () => {
    // The defect this suite exists to catch: `variants.reverse` means "a
    // reverse printing of this card also exists in TCGdex," not "this card
    // is the reverse printing." With no `variant` option (the caller not
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
    const selection = selectHolo(c, { variant: 'reverse' });
    expect(selection.effect).toBe('reverse-holo');
    expect(selection.invert).toBe(true);
  });

  it('reverses a regular-holo card too — the other half of REVERSIBLE', () => {
    // A previous test claimed regular-holo was reachable through REVERSIBLE
    // but only ever exercised the 'basic' half; removing 'regular-holo' from
    // that set left the old test green.
    const c = card({ rarity: 'Holo Rare', variants: { reverse: true } });
    const selection = selectHolo(c, { variant: 'reverse' });
    expect(selection.effect).toBe('reverse-holo');
    expect(selection.invert).toBe(true);
  });

  it('never downgrades a chase rarity, even when explicitly asked to reverse it', () => {
    const c = card({ rarity: 'Secret Rare', variants: { reverse: true } });
    const selection = selectHolo(c, { variant: 'reverse' });
    expect(selection.effect).toBe('secret-rare');
    expect(selection.invert).toBe(false);
  });

  it('leaves invert false for everything else', () => {
    expect(selectHolo(card({ rarity: 'Holo Rare' })).invert).toBe(false);
  });

  it('gives gallery override precedence over reverse holo, even when explicitly asked to reverse', () => {
    const c = card({ localId: 'TG10', rarity: 'Holo Rare', variants: { reverse: true } });
    const selection = selectHolo(c, { variant: 'reverse' });
    expect(selection.effect).toBe('trainer-gallery-holo');
    expect(selection.invert).toBe(false);
  });
});

describe('selectHolo — clip shape', () => {
  it('clips radiant to the borders, and a gallery holo to its frame inside them', () => {
    expect(selectHolo(card({ rarity: 'Radiant Rare' })).shape).toBe('borders');
    const gallery = selectHolo(card({ localId: 'TG20', rarity: 'Holo Rare' }));
    expect([gallery.effect, gallery.shape, gallery.layout]).toEqual([
      'trainer-gallery-holo',
      'regular',
      'swsh-gallery-holo',
    ]);
  });

  it('frames a gallery holo by its stage: the tab, or the picture and band, and the weakness bar', () => {
    // All 80 gallery holos' masks (2026-09-26) leave out the border, which
    // their CSS's --clip-borders cuts too, and the weakness bar; a Basic's
    // its BASIC tab, an evolution's its picture and "evolves from" band.
    const pikachu = selectHolo(
      card({
        id: 'swsh11tg-TG05',
        localId: 'TG05',
        name: 'Pikachu',
        rarity: 'Rare',
        stage: 'Basic',
      }),
    );
    expect([pikachu.shape, pikachu.layout]).toEqual(['regular', 'swsh-gallery-holo']);
    for (const id of ['swsh10tg-TG01', 'swsh11tg-TG03', 'swsh12tg-TG05']) {
      const s = selectHolo(CAPTURED_CARDS[id]);
      expect([s.effect, s.shape, s.layout], id).toEqual([
        'trainer-gallery-holo',
        'stage',
        'swsh-gallery-holo',
      ]);
    }
  });

  it('gives a full art trainer its full-art frame: the whole card but its header and rule box', () => {
    const s = selectHolo(
      card({ rarity: 'Full Art Trainer', category: 'Trainer', trainerType: 'Supporter' }),
    );
    expect([s.shape, s.layout]).toEqual(['trainer', 'swsh-ultra']);
    const covers = (x: number, y: number) =>
      coversPoint(s.shape, x, y, s.invert, s.layout, s.border);
    expect(covers(0.5, 0.5)).toBe(true);
    expect(covers(0.01, 0.5)).toBe(true);
    expect(covers(0.5, 0.045)).toBe(false);
    expect(covers(0.6, 0.92)).toBe(false);
  });

  it('gives the full-art family the whole card', () => {
    expect(selectHolo(card({ rarity: 'Secret Rare' })).shape).toBe('full');
    expect(selectHolo(card({ rarity: 'Holo Rare VMAX' })).shape).toBe('full');
  });

  it('clips each ported legacy shine where its CSS clips it', () => {
    // shiny-rare.css: --clip, and --clip-stage on an evolution
    expect(selectHolo(card({ rarity: 'Shiny rare', stage: 'Basic' })).shape).toBe('regular');
    expect(selectHolo(card({ rarity: 'Shiny rare', stage: 'Stage1' })).shape).toBe('stage');
    // a gallery V takes v-full-art.css's rules, which clip nothing, but its
    // masks leave its bars out: the art window of its frame (layoutOf)
    const galleryV = selectHolo(card({ localId: 'TG12', rarity: 'Holo Rare V' }));
    expect([galleryV.effect, galleryV.shape]).toEqual(['trainer-gallery-v-regular', 'regular']);
    // v-regular.css clips a V nowhere, on the unmasked path
    const v = selectHolo(card({ rarity: 'Holo Rare V', stage: 'Basic' }));
    expect([v.effect, v.shape]).toEqual(['v-regular', 'full']);
    // amazing-rare.css's unmasked rule: --clip, even on an evolution
    const amazing = selectHolo(card({ rarity: 'Amazing Rare', stage: 'Stage1' }));
    expect([amazing.effect, amazing.shape]).toEqual(['amazing-rare', 'regular']);
    // a gallery VMAX takes rainbow-alt.css's rules, which clip nothing, but
    // its masks leave its header and bars out, as a gallery V's do its bars
    const galleryVmax = selectHolo(card({ localId: 'TG15', rarity: 'Holo Rare VMAX' }));
    expect([galleryVmax.effect, galleryVmax.shape]).toEqual(['trainer-gallery-v-max', 'regular']);
    // and a gallery secret rare takes its own, which clip nothing either
    const gallerySecret = selectHolo(card({ localId: 'TG29', rarity: 'Secret Rare' }));
    expect([gallerySecret.effect, gallerySecret.shape]).toEqual([
      'trainer-gallery-secret-rare',
      'full',
    ]);
  });

  it('gives cosmos-holo the whole card, though its CSS keeps to the card’s own region', () => {
    // the owner's call: a Black White Rare is foiled over the whole card
    expect(selectHolo(CAPTURED_CARDS['sv10.5b-171']).shape).toBe('full');
    const classic = selectHolo(card({ rarity: 'Classic Collection', stage: 'Stage1' }));
    expect([classic.effect, classic.shape]).toEqual(['cosmos-holo', 'full']);
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

  it('hands on the card’s frame, which places the art window of both', () => {
    const dusknoir = selectHolo(
      card({ id: 'dp1-2', localId: '2', rarity: 'Rare Holo', stage: 'Stage2' }),
    );
    expect([dusknoir.shape, dusknoir.layout]).toEqual(['stage', 'dp']);
    expect(selectHolo(card({ rarity: 'Holo Rare', stage: 'Basic' })).layout).toBe('swsh');
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

  it('foils a Scarlet & Violet, Mega or Pocket holo rare’s border too, and nothing else’s', () => {
    // The reference's masks of 151's Rares let the foil through the border.
    for (const patch of [
      { id: 'sv03.5-015', localId: '015', rarity: 'Rare', stage: 'Stage2' },
      { id: 'me01-002', localId: '002', rarity: 'Rare', stage: 'Stage1' },
      { id: 'A1-003', localId: '003', rarity: 'Three Diamond', stage: 'Stage2' },
    ]) {
      const selection = selectHolo(card(patch));
      expect([selection.effect, selection.border], patch.id).toEqual(['sv-rare-holo', true]);
    }
    // Its reverse printing is a reverse foil, bordered as reverse foils are.
    const reverse = selectHolo(card({ id: 'sv01-004', localId: '004', rarity: 'Rare' }), {
      variant: 'reverse',
    });
    expect([reverse.effect, reverse.border]).toEqual(['reverse-holo', false]);
    // The older regular holo, and an ex, keep their regions as they were.
    expect(selectHolo(card({ rarity: 'Holo Rare' })).border).toBe(false);
    expect(selectHolo(card({ id: 'sv01-019', localId: '019', rarity: 'Double rare' })).border).toBe(
      false,
    );
  });

  it('foils an ex but its art, as its reference’s mask does, on its own frame', () => {
    const spidops = selectHolo(
      card({
        id: 'sv01-019',
        localId: '019',
        name: 'Spidops ex',
        rarity: 'Double rare',
        stage: 'Stage1',
      }),
    );
    expect([spidops.effect, spidops.shape, spidops.layout, spidops.invert]).toEqual([
      'ex-regular',
      'stage',
      'modern-ex',
      true,
    ]);
    // Pocket's ex is Four Diamond, the same effect and frame.
    const venusaur = selectHolo(
      card({
        id: 'A1-004',
        localId: '004',
        name: 'Venusaur ex',
        rarity: 'Four Diamond',
        stage: 'Stage2',
      }),
    );
    expect([venusaur.effect, venusaur.layout, venusaur.invert]).toEqual([
      'ex-regular',
      'modern-ex',
      true,
    ]);
    // The inversion is ex-regular's alone: a Rare of the same set is not inverted.
    expect(selectHolo(card({ id: 'sv01-004', localId: '004', rarity: 'Rare' })).invert).toBe(false);
  });

  it('gives a Double rare Stage1/Stage2 card the stepped stage region', () => {
    expect(selectHolo(card({ rarity: 'Double rare', stage: 'Stage1' })).shape).toBe('stage');
    expect(selectHolo(card({ rarity: 'Double rare', stage: 'Stage2' })).shape).toBe('stage');
  });

  it('still gives Ultra Rare the full-art treatment — the other ex tier', () => {
    // Regression guard: Double rare and Ultra Rare are both "ex" cards but
    // must stay on opposite sides of the art: a Double rare foils the card
    // but its illustration, an Ultra Rare the whole card, illustration first.
    // If a future edit collapses them back together, this goes red. The ex
    // Ultra Rare is a Scarlet & Violet (or Mega) card: before them, Ultra
    // Rare was the V/GX full art.
    const covers = (rarity: string) => {
      const s = selectHolo(
        card({ id: 'sv03.5-182', localId: '182', name: 'Venusaur ex', rarity, stage: 'Stage2' }),
      );
      return [s.effect, coversPoint(s.shape, 0.5, 0.3, s.invert, s.layout, s.border)];
    };
    expect(covers('Ultra Rare')).toEqual(['ex-full-art', true]);
    expect(covers('Double rare')).toEqual(['ex-regular', false]);
  });
});

describe('selectHolo — an Ultra Rare Supporter is a full art trainer', () => {
  const supporter = (id: string, localId: string, rarity = 'Ultra Rare') =>
    selectHolo(
      card({ id, localId, name: 'Test', category: 'Trainer', trainerType: 'Supporter', rarity }),
    );

  it('takes trainer-full-art before Scarlet & Violet, in every older frame', () => {
    // Marnie's full art; a Sun & Moon one (sm12's Lillie) and an XY one.
    for (const [id, localId, layout] of [
      ['swsh1-200', '200', 'swsh-ultra'],
      ['sm12-234', '234', 'full-card'],
      ['xy7-95', '95', 'full-card'],
    ] as const) {
      const s = supporter(id, localId);
      expect([s.effect, s.shape, s.layout], id).toEqual(['trainer-full-art', 'trainer', layout]);
    }
  });

  it('keeps a Scarlet & Violet or Mega one on the full-art ex, whose CSS draws Supporters too', () => {
    expect(supporter('sv03.5-194', '194').effect).toBe('ex-full-art');
    expect(supporter('me01-165', '165').effect).toBe('ex-full-art');
  });

  it('leaves every other Ultra Rare where it was', () => {
    // A Pokémon, and a trainer that is no Supporter.
    const v = selectHolo(
      card({ id: 'swsh3-183', localId: '183', name: 'Scizor V', rarity: 'Ultra Rare' }),
    );
    expect(v.effect).toBe('v-full-art');
    const item = selectHolo(
      card({
        id: 'sm12-230',
        localId: '230',
        category: 'Trainer',
        trainerType: 'Item',
        rarity: 'Ultra Rare',
      }),
    );
    expect(item.effect).toBe('v-full-art');
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

/**
 * Every set of all 21 TCGdex series (GET /series/{id}, 2026-09-25), by the
 * frame its cards are printed in: each series' sets in its own frame, and the
 * trainer kits, POP Series and McDonald's collections, which TCGdex files in
 * series of their own, in their era's.
 */
const SETS_BY_LAYOUT: Partial<Record<CardLayout, string[]>> = {
  wotc: [
    ...['base1', 'base2', 'basep', 'wp', 'base3', 'base4', 'base5', 'gym1', 'gym2', 'neo1'],
    ...['neo2', 'si1', 'neo3', 'neo4', 'lc'],
  ],
  'e-card': ['ecard1', 'ecard2', 'ecard3'],
  ex: [
    ...['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex5.5', 'ex6', 'ex7', 'ex8', 'ex9', 'exu', 'ex10'],
    ...['ex11', 'ex12', 'ex13', 'ex14', 'ex15', 'ex16', 'np', 'pop1', 'pop2', 'pop3', 'pop4'],
    ...['pop5', 'tk-ex-latio', 'tk-ex-latia', 'tk-ex-p', 'tk-ex-m'],
  ],
  dp: [
    ...['pop6', 'pop7', 'pop8', 'pop9', 'tk-dp-m', 'tk-dp-l', 'dp1', 'dpp', 'dp2', 'dp3', 'dp4'],
    ...['dp5', 'dp6', 'dp7', 'pl1', 'pl2', 'pl3', 'pl4'],
  ],
  hgss: ['tk-hs-g', 'tk-hs-r', 'hgss1', 'hgssp', 'hgss2', 'hgss3', 'hgss4', 'col1'],
  'bw-xy': [
    ...['tk-bw-z', 'tk-bw-e', 'tk-xy-sy', 'tk-xy-n', 'tk-xy-w', 'tk-xy-b', 'tk-xy-latia'],
    ...['tk-xy-latio', 'tk-xy-su', 'tk-xy-p', 'bw1', 'bwp', 'bw2', 'bw3', 'bw4', 'bw5', 'bw6'],
    ...['dv1', 'bw7', 'bw8', 'bw9', 'bw10', 'bw11', 'rc', '2011bw', '2012bw', '2014xy', '2015xy'],
    ...['2016xy', 'xyp', 'xy0', 'xya', 'xy1', 'xy2', 'xy3', 'xy4', 'xy5', 'dc1', 'xy6', 'xy7'],
    ...['xy8', 'xy9', 'g1', 'xy10', 'xy11', 'xy12'],
  ],
  sm: [
    ...['tk-sm-l', 'tk-sm-r', '2017sm', '2018sm', '2019sm', 'smp', 'sm1', 'sm2', 'sm3', 'sm3.5'],
    ...['sm4', 'sm5', 'sm6', 'sm7', 'sm7.5', 'sm8', 'sm9', 'det1', 'sm10', 'sm11', 'sm115', 'sma'],
    ...['sm12'],
  ],
  swsh: [
    ...['2021swsh', '2022swsh', 'swshp', 'swsh1', 'swsh2', 'swsh3', 'fut2020', 'swsh3.5', 'swsh4'],
    ...['swsh4.5sv', 'swsh4.5', 'swsh5', 'swsh6', 'swsh7', 'cel25', 'cel25cc', 'swsh8', 'swsh9'],
    ...['swsh9tg', 'swsh10tg', 'swsh10', 'swsh10.5', 'swsh11tg', 'swsh11', 'swsh12tg', 'swsh12'],
    ...['swsh12.5gg', 'swsh12.5'],
  ],
  // Scarlet & Violet and Mega, one frame, with 30th Celebration and the SV
  // McDonald's collections.
  sv: [
    ...['2023sv', '2024sv', 'svp', 'sv01', 'sv02', 'sv03', 'sv03.5', 'sv04', 'sv04.5', 'sv05'],
    ...['sv06', 'sv06.5', 'sv07', 'sv08', 'sv08.5', 'sv09', 'sv10', 'sv10.5w', 'sv10.5b', 'mep'],
    ...['me01', 'me02', 'me02.5', 'me03', 'me04', 'me05', '30th'],
  ],
  pocket: [
    ...['A1', 'P-A', 'A1a', 'A2', 'A2a', 'A2b', 'A3', 'A3a', 'A3b', 'A4', 'A4a', 'B1', 'B1a'],
    ...['B2', 'B2a'],
  ],
  // Pokémon Rumble's own frame; the energies and mfb, which draw no foil;
  // 30th-c's reprints in their old frames, which draw none either; and the
  // four sets with no card art at all.
  other: ['miscp', 'jumbo', 'sp', 'bog', 'ru1', 'sve', 'mfb', 'mee', '30th-c'],
};

describe('layoutOf — the frame a card is printed in', () => {
  // A card's set is its id less `-${localId}`, as for eraOf.
  const layout = (set: string, patch: Partial<Card> = {}) =>
    layoutOf({ id: `${set}-1`, localId: '1', name: 'Test', rarity: 'Holo Rare', ...patch });

  it('puts every TCGdex set in its frame', () => {
    const wrong: string[] = [];
    for (const [expected, sets] of Object.entries(SETS_BY_LAYOUT)) {
      for (const set of sets) {
        if (layout(set) !== expected) wrong.push(`${set}: ${layout(set)}, not ${expected}`);
      }
    }
    expect(wrong).toEqual([]);
    const all = Object.values(SETS_BY_LAYOUT).flat();
    expect(all).toHaveLength(220);
    expect(new Set(all).size).toBe(220);
  });

  it('gives a LV.X, a Prime and a LEGEND their own frames, whatever the set', () => {
    expect(layout('pl4', { rarity: 'Rare Holo LV.X', name: 'Arceus LV.X' })).toBe('lv-x');
    expect(layout('hgss3', { rarity: 'Rare PRIME', name: 'Espeon' })).toBe('prime');
    expect(layout('hgss3', { rarity: 'LEGEND', name: 'Kyogre & Groudon LEGEND' })).toBe('legend');
  });

  it('frames Platinum’s SP Pokémon by their owner’s title, and an SP LV.X as a LV.X', () => {
    for (const name of ['Absol G', 'Luxray GL', 'Mr. Mime E4', 'Drifblim FB', 'Garchomp C']) {
      expect(layout('pl2', { name })).toBe('dp-sp');
    }
    expect(layout('dpp', { name: 'Garchomp C' })).toBe('dp-sp');
    expect(layout('pl1', { name: 'Ampharos' })).toBe('dp');
    expect(layout('pl1', { name: 'Dialga G LV.X', rarity: 'Rare Holo LV.X' })).toBe('lv-x');
  });

  it('reads an SP title only in the Platinum sets and the DP promos', () => {
    // Diamond & Pearl proper has an Unown C and an Unown G.
    expect(layout('dp1', { name: 'Unown C' })).toBe('dp');
    expect(layout('dp4', { name: 'Unown G' })).toBe('dp');
  });

  it('leaves a card whose id does not end in its number to other', () => {
    expect(layoutOf({ id: 'dp1', localId: '2', name: 'Test', rarity: 'Holo Rare' })).toBe('other');
  });

  it('frames a Scarlet & Violet, Mega or Pocket ex by its name, suffix or none', () => {
    // TCGdex gives me02's Mega Charizard X ex and Oricorio ex no suffix.
    for (const [set, name] of [
      ['sv01', 'Spidops ex'],
      ['sv06', 'Teal Mask Ogerpon ex'],
      ['me02', 'Mega Charizard X ex'],
      ['me02', 'Oricorio ex'],
      ['A1', 'Venusaur ex'],
      ['svp', 'Paldean Wooper ex'],
    ]) {
      expect(layout(set, { name, rarity: 'Double rare' }), name).toBe('modern-ex');
    }
    expect(layout('sv01', { name: 'Pineco' })).toBe('sv');
    // An EX of the older frames keeps its set's: the name rule is modern only.
    expect(layout('xy1', { name: 'Venusaur EX' })).toBe('bw-xy');
    expect(layout('ex1', { name: 'Blaziken ex' })).toBe('ex');
  });

  it('frames a gallery V by its number, a Trainer Gallery’s in its black border', () => {
    const gallery = (id: string, name: string, rarity: string) =>
      layoutOf({ id, localId: id.slice(id.lastIndexOf('-') + 1), name, rarity });
    // Either rarity TCGdex files a Trainer Gallery V as.
    expect(gallery('swsh9tg-TG16', 'Mimikyu V', 'Ultra Rare')).toBe('swsh-gallery-v');
    expect(gallery('swsh12tg-TG12', 'Kricketune V', 'Holo Rare V')).toBe('swsh-gallery-v');
    // The Galarian Gallery's silver border takes foil, as a full-art V's does.
    expect(gallery('swsh12.5gg-GG36', 'Entei V', 'Ultra Rare')).toBe('swsh-ultra-v');
    // A gallery VMAX has its own, in either gallery and either rarity.
    expect(gallery('swsh9tg-TG17', 'Mimikyu VMAX', 'Ultra Rare')).toBe('swsh-gallery-vmax');
    expect(gallery('swsh12tg-TG15', 'Blaziken VMAX', 'Holo Rare VMAX')).toBe('swsh-gallery-vmax');
    expect(gallery('swsh12.5gg-GG42', 'Zeraora VMAX', 'Ultra Rare')).toBe('swsh-gallery-vmax');
    // A gallery VSTAR keeps its rarity's.
    expect(gallery('swsh12.5gg-GG35', 'Leafeon VSTAR', 'Ultra Rare')).toBe('swsh-ultra');
  });

  it('frames a Galarian Gallery trainer apart from a Trainer Gallery one', () => {
    const trainer = (id: string, name: string, rarity: string) =>
      layoutOf({
        id,
        localId: id.slice(id.lastIndexOf('-') + 1),
        name,
        rarity,
        category: 'Trainer',
      });
    expect(trainer('swsh12.5gg-GG60', 'Cynthia’s Ambition', 'Ultra Rare')).toBe(
      'swsh-galarian-trainer',
    );
    expect(trainer('swsh11tg-TG26', 'Kabu', 'Ultra Rare')).toBe('swsh-ultra');
    expect(trainer('swsh12tg-TG26', 'Professor Burnet', 'Full Art Trainer')).toBe('swsh-ultra');
    // Without its category a card keeps its rarity's frame.
    expect(
      layoutOf({ id: 'swsh12.5gg-GG60', localId: 'GG60', name: 'Test', rarity: 'Ultra Rare' }),
    ).toBe('swsh-ultra');
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
    expect([modern.effect, modern.shape, modern.layout]).toEqual([
      'ex-full-art',
      'stage',
      'sv-ultra-ex',
    ]);
    // The older one, a Sun & Moon GX with no mask to cut it by, takes the
    // whole card.
    expect([older.effect, older.shape, older.layout]).toEqual([
      'v-full-art',
      'regular',
      'full-card',
    ]);
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
  it('foils an Ultra Rare’s whole card but its rule box and pre-evolution picture', () => {
    // 151's sixteen masks leave both out; a box can follow each.
    const venusaur = selectHolo(CAPTURED_CARDS['sv03.5-182']);
    expect([venusaur.effect, venusaur.shape, venusaur.layout]).toEqual([
      'ex-full-art',
      'stage',
      'sv-ultra-ex',
    ]);
    const megaVenusaur = selectHolo(
      card({
        id: 'me01-155',
        localId: '155',
        name: 'Mega Venusaur ex',
        rarity: 'Ultra Rare',
        stage: 'Stage2',
      }),
    );
    expect([megaVenusaur.shape, megaVenusaur.layout]).toEqual(['stage', 'sv-ultra-ex']);
    const bill = selectHolo(
      card({
        id: 'sv03.5-194',
        localId: '194',
        name: 'Bill’s Transfer',
        category: 'Trainer',
        trainerType: 'Supporter',
        rarity: 'Ultra Rare',
      }),
    );
    expect([bill.effect, bill.shape, bill.layout]).toEqual(['ex-full-art', 'trainer', 'sv-ultra']);
    // An energy has no rule box: its region is the whole card.
    const ignition = selectHolo(
      card({
        id: 'me02-124',
        localId: '124',
        name: 'Ignition Energy',
        category: 'Energy',
        rarity: 'Ultra Rare',
      }),
    );
    expect([ignition.shape, ignition.layout]).toEqual(['regular', 'sv-ultra']);
  });

  it('foils a Sword & Shield Ultra Rare’s whole card but its dark bars, by what it is', () => {
    // The older reference's masks leave out a V's weakness bar and V rule
    // box, and a Supporter's TRAINER header and rule box.
    const scizor = selectHolo(
      card({
        id: 'swsh3-183',
        localId: '183',
        name: 'Scizor V',
        rarity: 'Ultra Rare',
        stage: 'Basic',
      }),
    );
    expect([scizor.effect, scizor.shape, scizor.layout]).toEqual([
      'v-full-art',
      'regular',
      'swsh-ultra-v',
    ]);
    const marnie = selectHolo(
      card({
        id: 'swsh1-200',
        localId: '200',
        name: 'Marnie',
        category: 'Trainer',
        trainerType: 'Supporter',
        rarity: 'Ultra Rare',
      }),
    );
    // An Ultra Rare Supporter is a full art trainer, on the same frame.
    expect([marnie.effect, marnie.shape, marnie.layout]).toEqual([
      'trainer-full-art',
      'trainer',
      'swsh-ultra',
    ]);
    // A VSTAR, with no mask to cut it by, keeps the whole card: it is no V here.
    const arceus = selectHolo(
      card({
        id: 'swsh9-166',
        localId: '166',
        name: 'Arceus VSTAR',
        rarity: 'Ultra Rare',
        stage: 'VSTAR',
      }),
    );
    expect([arceus.shape, arceus.layout]).toEqual(['regular', 'swsh-ultra']);
    // An older Ultra Rare, an XY EX, has no masks at all: the whole card.
    const venusaur = selectHolo(
      card({
        id: 'xy1-1',
        localId: '1',
        name: 'Venusaur EX',
        rarity: 'Ultra Rare',
        stage: 'Basic',
      }),
    );
    expect([venusaur.effect, venusaur.layout]).toEqual(['v-full-art', 'full-card']);
    // A V of another rarity keeps its own frame: the V rule is the Ultra Rare's.
    expect(
      layoutOf({ id: 'swsh3-19', localId: '19', name: 'Charizard V', rarity: 'Holo Rare V' }),
    ).toBe('swsh');
  });

  it('foils a Pocket Two Star’s whole card, with no mask to cut it by', () => {
    const charizard = selectHolo(
      card({
        id: 'A1-253',
        localId: '253',
        name: 'Charizard ex',
        rarity: 'Two Star',
        stage: 'Stage2',
      }),
    );
    expect([charizard.effect, charizard.shape, charizard.layout]).toEqual([
      'ex-full-art',
      'stage',
      'full-card',
    ]);
  });

  it('foils a Hyper rare’s whole gold card but its silver rule box', () => {
    // 151's masks leave the rule box out, on its ex and on its trainer.
    const mew = selectHolo(CAPTURED_CARDS['sv03.5-205']);
    expect([mew.effect, mew.shape, mew.layout]).toEqual(['hyper-rare', 'regular', 'sv-hyper-ex']);
    const sw = selectHolo(CAPTURED_CARDS['sv03.5-206']);
    expect([sw.effect, sw.shape, sw.layout]).toEqual(['hyper-rare', 'trainer', 'sv-hyper']);
    // An energy has no rule box: its region is the whole card.
    const energy = selectHolo(
      card({
        id: 'sv03.5-207',
        localId: '207',
        name: 'Basic Psychic Energy',
        category: 'Energy',
        rarity: 'Hyper rare',
      }),
    );
    expect([energy.shape, energy.layout]).toEqual(['regular', 'sv-hyper']);
  });

  it('foils a Mega Hyper Rare’s and a Crown’s whole card, rule box and all', () => {
    // A Mega's rule box is gold, and neither has a mask to measure against.
    const mega = selectHolo(
      card({
        id: 'me02-130',
        localId: '130',
        name: 'Mega Charizard X ex',
        rarity: 'Mega Hyper Rare',
        stage: 'Stage2',
      }),
    );
    expect([mega.effect, mega.shape, mega.layout]).toEqual(['hyper-rare', 'stage', 'full-card']);
    const crown = selectHolo(
      card({ id: 'A2b-111', localId: '111', category: 'Trainer', rarity: 'Crown' }),
    );
    expect([crown.effect, crown.shape, crown.layout]).toEqual([
      'hyper-rare',
      'trainer',
      'full-card',
    ]);
  });

  it('foils a special illustration rare’s whole card but an evolution’s pre-evolution picture', () => {
    // Its reference has no clip-path either, but all seven of 151's masks
    // leave that picture out, and a box can follow it.
    const venusaur = selectHolo(CAPTURED_CARDS['sv03.5-198']);
    expect([venusaur.effect, venusaur.shape, venusaur.layout]).toEqual([
      'ex-special-illustration-rare',
      'stage',
      'sv-special-illustration',
    ]);
    const zapdos = selectHolo(
      card({
        id: 'sv03.5-202',
        localId: '202',
        rarity: 'Special illustration rare',
        stage: 'Basic',
      }),
    );
    expect([zapdos.shape, zapdos.layout]).toEqual(['regular', 'sv-special-illustration']);
    // A Supporter's is the whole card: the trainer region of its frame.
    const erika = selectHolo(
      card({
        id: 'sv03.5-203',
        localId: '203',
        category: 'Trainer',
        trainerType: 'Supporter',
        rarity: 'Special illustration rare',
      }),
    );
    expect([erika.shape, erika.layout]).toEqual(['trainer', 'sv-special-illustration']);
  });

  it('clips illustration-rare to its full art’s frame, inside the border, by its stage', () => {
    // The card inside its border, the stage tab out, as the reference's
    // border polygon; an evolution's picture and band out too, as its masks.
    const bulbasaur = selectHolo(CAPTURED_CARDS['sv03.5-166']);
    expect([bulbasaur.effect, bulbasaur.shape, bulbasaur.layout, bulbasaur.invert]).toEqual([
      'illustration-rare',
      'regular',
      'sv-illustration',
      false,
    ]);
    const ivysaur = selectHolo(
      card({ id: 'me01-134', localId: '134', rarity: 'Illustration rare', stage: 'Stage1' }),
    );
    expect([ivysaur.shape, ivysaur.layout]).toEqual(['stage', 'sv-illustration']);
    const gloom = selectHolo(
      card({ id: 'A1-228', localId: '228', rarity: 'One Star', stage: 'Stage1' }),
    );
    expect([gloom.effect, gloom.shape, gloom.layout]).toEqual([
      'illustration-rare',
      'stage',
      'pocket-illustration',
    ]);
  });

  it('still clips radiant to the border rect, and a gallery holo to its frame inside it', () => {
    expect(selectHolo(card({ rarity: 'Radiant Rare' })).shape).toBe('borders');
    const gallery = selectHolo(card({ localId: 'TG05', rarity: 'Holo Rare' }));
    expect([gallery.shape, gallery.layout]).toEqual(['regular', 'swsh-gallery-holo']);
  });
});

describe('selectHolo — 151 reverse holos', () => {
  /** A 151 Common numbered `localId`, TCGdex-padded, shown reversed. */
  const reversed = (localId: string) =>
    selectHolo(card({ id: `sv03.5-${localId}`, localId, rarity: 'Common' }), {
      variant: 'reverse',
    });

  it('gives exactly the reference’s eight card numbers the Master Ball pattern', () => {
    for (const n of ['001', '004', '007', '025', '133', '144', '146', '161']) {
      expect(shown(reversed(n)), n).toEqual({
        effect: 'masterball-holo',
        shape: 'regular',
        invert: true,
      });
    }
  });

  it('gives every other 151 reverse the Poké Ball pattern, and the same one every time', () => {
    // Neighbours of the Master Ball numbers, so an off-by-one shows. The
    // reference promotes a random fifth of these to Master Ball; a card here
    // must render the same on every call.
    for (const n of ['002', '005', '008', '024', '026', '132', '134', '145', '147', '160', '162']) {
      for (let call = 0; call < 3; call += 1) {
        expect(shown(reversed(n)), n).toEqual({
          effect: 'poke-ball-holo',
          shape: 'regular',
          invert: true,
        });
      }
    }
  });

  it('clips both patterns to the card’s own region, inverted, as reverse-holo does', () => {
    expect(shown(selectHolo(CAPTURED_CARDS['sv03.5-002'], { variant: 'reverse' }))).toEqual({
      effect: 'poke-ball-holo',
      shape: 'stage',
      invert: true,
    });
    expect(shown(selectHolo(CAPTURED_CARDS['sv03.5-001'], { variant: 'reverse' }))).toEqual({
      effect: 'masterball-holo',
      shape: 'regular',
      invert: true,
    });
  });

  it('reverses a 151 Rare too, since a Scarlet & Violet Rare is sv-rare-holo first', () => {
    expect(selectHolo(CAPTURED_CARDS['sv03.5-026'], { variant: 'reverse' }).effect).toBe(
      'poke-ball-holo',
    );
  });

  it('shows no pattern unless the reverse printing is asked for, Master Ball numbers included', () => {
    // The reference forces its eight numbers to reverse whatever was asked;
    // here reverse stays the caller's choice. Both of these have a reverse
    // printing in TCGdex (variants.reverse), which must not be enough.
    expect(shown(selectHolo(CAPTURED_CARDS['sv03.5-001']))).toEqual({
      effect: 'basic',
      shape: 'regular',
      invert: false,
    });
    expect(selectHolo(CAPTURED_CARDS['sv03.5-002']).effect).toBe('basic');
  });

  it('never replaces a 151 chase rarity with a pattern', () => {
    expect(selectHolo(CAPTURED_CARDS['sv03.5-166'], { variant: 'reverse' }).effect).toBe(
      'illustration-rare',
    );
    expect(selectHolo(CAPTURED_CARDS['sv03.5-003'], { variant: 'reverse' }).effect).toBe(
      'ex-regular',
    );
  });

  it('leaves any other set on reverse-holo unless TCGdex lists a Poké Ball printing', () => {
    // Outside 151 the set decides nothing: these list no ball printing (no
    // variants_detailed at all), so even a Prismatic Evolutions id, a set
    // TCGdex marks as Poké Ball patterned, stays reverse-holo. The next block
    // holds the cards that do list one.
    for (const id of ['sv08.5-001', 'sv01-001', 'me01-001', 'swsh3-3']) {
      const localId = id.slice(id.lastIndexOf('-') + 1);
      expect(
        shown(selectHolo(card({ id, localId, rarity: 'Common' }), { variant: 'reverse' })),
        id,
      ).toEqual({
        effect: 'reverse-holo',
        shape: 'regular',
        invert: true,
      });
    }
  });
});

describe('selectHolo — the Poké Ball reverses TCGdex lists', () => {
  /*
   * Real cards, captured verbatim from `GET /v2/en/cards/{id}` on 2026-09-25
   * and trimmed as effect-gallery.fixture.ts trims its own, variants_detailed
   * down to each printing's type and foil. Exeggcute and Amarys are from
   * Prismatic Evolutions, whose every Common, Uncommon and Rare lists a
   * Poké Ball reverse, and whose Pokémon list a Master Ball one besides.
   */
  const PRISMATIC_POKEMON: Card = {
    id: 'sv08.5-001',
    localId: '001',
    name: 'Exeggcute',
    image: 'https://assets.tcgdex.net/en/sv/sv08.5/001',
    category: 'Pokemon',
    set: { id: 'sv08.5', name: 'Prismatic Evolutions', cardCount: { total: 180, official: 131 } },
    rarity: 'Common',
    stage: 'Basic',
    variants: { firstEdition: false, holo: false, normal: true, reverse: true, wPromo: false },
    variants_detailed: [
      { type: 'normal' },
      { type: 'reverse' },
      { type: 'reverse', foil: 'pokeball' },
      { type: 'reverse', foil: 'masterball' },
    ],
  };
  const PRISMATIC_TRAINER: Card = {
    id: 'sv08.5-093',
    localId: '093',
    name: 'Amarys',
    image: 'https://assets.tcgdex.net/en/sv/sv08.5/093',
    category: 'Trainer',
    set: { id: 'sv08.5', name: 'Prismatic Evolutions', cardCount: { total: 180, official: 131 } },
    rarity: 'Common',
    variants: { firstEdition: false, holo: false, normal: true, reverse: true, wPromo: false },
    variants_detailed: [
      { type: 'normal' },
      { type: 'reverse' },
      { type: 'reverse', foil: 'pokeball' },
    ],
  };
  /** A plain reverse printing, and nothing else. */
  const PLAIN_REVERSE: Card = {
    id: 'sv01-001',
    localId: '001',
    name: 'Pineco',
    image: 'https://assets.tcgdex.net/en/sv/sv01/001',
    category: 'Pokemon',
    set: { id: 'sv01', name: 'Scarlet & Violet', cardCount: { total: 258, official: 198 } },
    rarity: 'Common',
    stage: 'Basic',
    variants: { firstEdition: false, holo: false, normal: true, reverse: true, wPromo: false },
    variants_detailed: [{ type: 'normal' }, { type: 'reverse' }],
  };
  /** A reverse printing with a foil of its own that is no ball: a league stamp. */
  const LEAGUE_REVERSE: Card = {
    id: 'me01-001',
    localId: '001',
    name: 'Bulbasaur',
    image: 'https://assets.tcgdex.net/en/me/me01/001',
    category: 'Pokemon',
    set: { id: 'me01', name: 'Mega Evolution', cardCount: { total: 188, official: 132 } },
    rarity: 'Common',
    stage: 'Basic',
    variants: { firstEdition: false, holo: false, normal: true, reverse: true, wPromo: false },
    variants_detailed: [
      { type: 'normal' },
      { type: 'reverse' },
      { type: 'reverse', foil: 'league' },
    ],
  };

  it('draws a reverse Poké Ball patterned when TCGdex lists a Poké Ball printing of it', () => {
    // Exeggcute lists a Master Ball printing too; reverse shows the Poké Ball.
    expect(shown(selectHolo(PRISMATIC_POKEMON, { variant: 'reverse' }))).toEqual({
      effect: 'poke-ball-holo',
      shape: 'regular',
      invert: true,
    });
  });

  it('does so for a trainer, which lists no Master Ball printing, in its own region', () => {
    expect(shown(selectHolo(PRISMATIC_TRAINER, { variant: 'reverse' }))).toEqual({
      effect: 'poke-ball-holo',
      shape: 'trainer',
      invert: true,
    });
  });

  it('keeps reverse-holo for a plain reverse, and for one whose foil is not a ball', () => {
    for (const printed of [PLAIN_REVERSE, LEAGUE_REVERSE]) {
      expect(shown(selectHolo(printed, { variant: 'reverse' })), printed.id).toEqual({
        effect: 'reverse-holo',
        shape: 'regular',
        invert: true,
      });
    }
  });

  it('shows no pattern unless the reverse printing is asked for', () => {
    expect(shown(selectHolo(PRISMATIC_POKEMON))).toEqual({
      effect: 'basic',
      shape: 'regular',
      invert: false,
    });
  });

  it('draws the Master Ball pattern when that printing is asked for, inverted as a reverse is', () => {
    expect(shown(selectHolo(PRISMATIC_POKEMON, { variant: 'masterball' }))).toEqual({
      effect: 'masterball-holo',
      shape: 'regular',
      invert: true,
    });
  });

  it('never puts a Master Ball on a chase rarity, any more than a reverse', () => {
    // 151's Venusaur ex, a Double rare: its own foil stands
    expect(selectHolo(CAPTURED_CARDS['sv03.5-003'], { variant: 'masterball' }).effect).toBe(
      'ex-regular',
    );
  });
});

describe('the card’s glow, base.css’s --card-glow', () => {
  const typed = (types?: string[]) => card({ types });
  const table: Array<[string, [number, number, number]]> = [
    ['Water', hsl(192, 97, 60)],
    ['Fire', hsl(9, 81, 59)],
    ['Grass', hsl(96, 81, 65)],
    ['Lightning', hsl(54, 87, 63)],
    ['Psychic', hsl(281, 62, 58)],
    ['Fighting', [145 / 255, 90 / 255, 39 / 255]],
    ['Darkness', hsl(189, 77, 27)],
    ['Metal', hsl(184, 20, 70)],
    ['Dragon', hsl(51, 60, 35)],
    ['Fairy', hsl(323, 100, 89)],
  ];

  it.each(table)('%s glows as base.css colours it', (type, rgb) => {
    glowOf(typed([type])).forEach((v, i) => expect(v).toBeCloseTo(rgb[i], 4));
  });

  it('keeps :root’s glow for Colorless and for a card with no type, and reads only the first', () => {
    hsl(175, 100, 90).forEach((v, i) => expect(DEFAULT_GLOW[i]).toBeCloseTo(v, 4));
    expect(glowOf(typed(['Colorless']))).toEqual(DEFAULT_GLOW);
    expect(glowOf(typed(undefined))).toEqual(DEFAULT_GLOW);
    expect(glowOf(typed(['Fire', 'Water']))).toEqual(glowOf(typed(['Fire'])));
  });

  it('hands the glow to the scene with the selection', () => {
    expect(selectHolo(typed(['Grass'])).glow).toEqual(glowOf(typed(['Grass'])));
  });
});

describe('the card’s foil brightness, reverse-holo.css’s --foil-brightness', () => {
  const typed = (types?: string[]) => card({ types });

  it('is 0.7 for Lightning, 0.8 for Darkness and 0.6 for Metal', () => {
    expect(foilBrightnessOf(typed(['Lightning']))).toBe(0.7);
    expect(foilBrightnessOf(typed(['Darkness']))).toBe(0.8);
    expect(foilBrightnessOf(typed(['Metal']))).toBe(0.6);
  });

  it('is 0.55 for every other type, and for a card with none', () => {
    expect(DEFAULT_FOIL_BRIGHTNESS).toBe(0.55);
    for (const types of [['Fire'], ['Colorless'], undefined]) {
      expect(foilBrightnessOf(typed(types))).toBe(0.55);
    }
  });

  it('hands it to the scene with the selection', () => {
    expect(selectHolo(typed(['Metal'])).foilBrightness).toBe(0.6);
  });
});
