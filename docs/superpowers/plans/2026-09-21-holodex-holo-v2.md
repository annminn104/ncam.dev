# Holodex holo effects v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace holodex's four generic foil tiers with 22 rarity-specific effects derived from simeydotme/pokemon-cards-css, confined to card-layout clip regions, plus the reference's pop/showcase interaction.

**Architecture:** Effect selection is a pure function over TCGdex fields. Each effect is a **declarative description** — a stack of layers, each with a source, a blend mode, a pointer-driven transform, a filter and an opacity — which a single generator compiles into GLSL and caches as a `ShaderMaterial` per effect. This mirrors the reference's own structure (`background-image` stack + `background-blend-mode` + `filter` + `mix-blend-mode`) one-for-one.

**Tech Stack:** TypeScript, three.js (already present), GLSL ES 3.0, Vitest under `environment: 'node'`.

**Spec:** `docs/superpowers/specs/2026-09-21-holodex-holo-v2-design.md` — read it before Task 1.

## Deviation from the spec, decided here

The spec's §5.2 has each effect file export a hand-written GLSL `chunk`. **This plan replaces that with a declarative description compiled to GLSL**, because examining the reference's CSS showed every one of the 22 effects is the same shape:

```
element := { layers: [{ source, blendWithPrevious, transform }], filter, mixBlend, opacity }
effect  := { shine: element[1..3], glare: element[1..2] }
```

Hand-writing 22 GLSL chunks would restate that structure 22 times and get it subtly wrong 22 times. One tested generator plus 22 data files preserves everything the spec asked for — one file per effect, editing `cosmos` cannot touch `radiant` — while making the hard part (blending, filtering, compositing) testable once. If you disagree, the effects' data files map 1:1 onto chunks and can be inlined later.

## Global Constraints

- **pnpm only.** Never npm or yarn.
- **`@ncam/tsconfig/base.json`** sets `noUnusedLocals: true`, `noUnusedParameters: true` (a `_`-prefixed parameter is exempt), `verbatimModuleSyntax: true` (**a type-only import MUST use `import type`**), plus `strict` and `noFallthroughCasesInSwitch`. An unused import is a hard typecheck failure, not a lint nit.
- **eslint enforces `prefer-const`.**
- **Tests run under `environment: 'node'` and jsdom is NOT installed and must not be added.** Anything needing a browser API takes it as an injected parameter. GLSL is not executable in tests — what gets tested is selection, regions, the blend formulas (as TypeScript reference implementations), and the generator's output as a string.
- **Conventional Commits**, and this repo's commitlint enforces **`subject-case`: the subject must be lowercase**. The body ends with the attribution trailer the session's reminder specifies.
- **lint-staged reformats staged files with prettier during `git commit`** — the tree changing mid-commit is expected.
- **Baseline at the start of this plan:** 164 tests passing, lint 0 errors, `pnpm run ci` green. Every task must keep all three true.
- **Do not start `pnpm dev`, `pnpm preview`, or any persistent server.** Ports 1337 and 9000–9006 belong to the machine owner. Browser verification is a controller-run smoke pass.
- **The lazy-chunk boundary is load-bearing:** nothing may import `holo/scene`, `holo/shader/*`, `holo/effects/*` or `three` at module scope outside the holo module itself. `HoloCard.tsx` reaches them only through `await import('./scene')` inside an effect. A single static import silently pulls three.js (~126 KB gz) into the entry chunk and nothing in the build complains.
- **Known tooling hazard:** `Edit` calls in this repo have repeatedly replaced straight quotes with Unicode curly quotes inside JSX and template literals, producing invalid syntax. Prefer a full-file `Write` when rewriting, and re-read what you produce. GLSL lives in template literals — this hazard is acute here.

## File Structure

**New:**

| File                         | Responsibility                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/holo/select.ts`         | `selectHolo(card)` → `{ effect, shape, invert }`. Pure. The rarity table and the overrides.                                                   |
| `src/holo/regions.ts`        | `ClipShape` → inset rect + shape id. Pure.                                                                                                    |
| `src/holo/shader/blend.ts`   | The 13 blend modes, as both GLSL source strings and TypeScript reference implementations (the latter exist so the formulas can be tested).    |
| `src/holo/shader/sources.ts` | GLSL generators for the layer sources: repeating linear gradient, linear gradient, radial gradient, conic gradient, glitter, grain, card art. |
| `src/holo/shader/types.ts`   | The effect DSL types: `Layer`, `Element`, `Effect`, `BlendMode`, `Filter`.                                                                    |
| `src/holo/shader/compile.ts` | `compileEffect(effect)` → complete fragment shader source. The generator.                                                                     |
| `src/holo/shader/base.ts`    | The invariant scaffold: uniforms, varyings, pointer maths, clip coverage, filter function, final composite.                                   |
| `src/holo/program-cache.ts`  | `getMaterial(effectId)` → cached `ShaderMaterial`, compiled on demand, `basic` on failure.                                                    |
| `src/holo/effects/index.ts`  | `EFFECTS: Record<EffectId, Effect>` — the registry the cache reads.                                                                           |
| `src/holo/effects/<id>.ts`   | 22 files, one per effect. Data only.                                                                                                          |

**Modified:** `src/holo/scene.ts` (gains `setEffect`, loses `setTier`), `src/holo/HoloCard.tsx` (calls `selectHolo`, adds pop/showcase), `src/holo/textures.ts` (tier textures become named textures: `glitter`, `grain`).

**Deleted:** `src/holo/tiers.ts`, `src/holo/tiers.test.ts`.

---

### Task 1: Effect selection

**Files:**

- Create: `apps/holodex/src/holo/select.ts`
- Test: `apps/holodex/src/holo/select.test.ts`

**Interfaces:**

- Consumes: `Card`, `Variants` from `../lib/tcgdex`; `CARD_RARITIES` from `../lib/constants`.
- Produces: `EffectId` (22 values), `ClipShape` (5 values), `HoloSelection`, `selectHolo(card)`, `EFFECT_BY_RARITY`, `OVERRIDE_ONLY_EFFECTS`.

- [ ] **Step 1: Write the failing test**

Create `apps/holodex/src/holo/select.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run apps/holodex/src/holo/select.test.ts
```

Expected: FAIL — `Failed to resolve import "./select"`.

- [ ] **Step 3: Write the implementation**

Create `apps/holodex/src/holo/select.ts`:

```ts
import type { Card, Variants } from '../lib/tcgdex';

/**
 * One effect per look in simeydotme/pokemon-cards-css. Four of these are
 * reachable only through the overrides below and never appear in the rarity
 * table — see OVERRIDE_ONLY_EFFECTS.
 */
export type EffectId =
  | 'basic'
  | 'reverse-holo'
  | 'regular-holo'
  | 'cosmos-holo'
  | 'amazing-rare'
  | 'radiant-holo'
  | 'rainbow-holo'
  | 'rainbow-alt'
  | 'secret-rare'
  | 'shiny-rare'
  | 'shiny-v'
  | 'shiny-vmax'
  | 'v-regular'
  | 'v-full-art'
  | 'v-max'
  | 'v-star'
  | 'trainer-full-art'
  | 'trainer-gallery-holo'
  | 'trainer-gallery-v-regular'
  | 'trainer-gallery-v-max'
  | 'trainer-gallery-secret-rare'
  | 'swsh-pikachu';

/** Which part of the card the foil is confined to. */
export type ClipShape = 'regular' | 'stage' | 'trainer' | 'borders' | 'full';

export interface HoloSelection {
  effect: EffectId;
  shape: ClipShape;
  /** reverse-holo inverts its clip: foil everywhere EXCEPT the region. */
  invert: boolean;
}

/**
 * Effects no rarity maps to. `reverse-holo` comes from a printing variant; the
 * three gallery variants come from the card number.
 *
 * `trainer-gallery-holo` is deliberately NOT here — `Illustration rare` maps to
 * it in the table below, and it is also the fallback the gallery override uses
 * for any other rarity. It is reachable both ways.
 */
export const OVERRIDE_ONLY_EFFECTS: EffectId[] = [
  'reverse-holo',
  'trainer-gallery-v-regular',
  'trainer-gallery-v-max',
  'trainer-gallery-secret-rare',
];

/** All 42 TCGdex rarities. Asserted complete in both directions. */
export const EFFECT_BY_RARITY: Record<string, EffectId> = {
  Common: 'basic',
  Uncommon: 'basic',
  None: 'basic',
  'One Diamond': 'basic',
  'Two Diamond': 'basic',
  'Three Diamond': 'basic',
  'Four Diamond': 'basic',
  Rare: 'basic',
  Promo: 'basic',
  'One Star': 'basic',

  'Holo Rare': 'regular-holo',
  'Rare Holo': 'regular-holo',
  'Rare Holo LV.X': 'regular-holo',
  'Rare PRIME': 'regular-holo',
  LEGEND: 'regular-holo',

  'Classic Collection': 'cosmos-holo',
  'Black White Rare': 'cosmos-holo',

  'Amazing Rare': 'amazing-rare',
  'Radiant Rare': 'radiant-holo',

  'Hyper rare': 'rainbow-holo',
  'Mega Hyper Rare': 'rainbow-holo',
  Crown: 'rainbow-holo',

  'Futuristic Rare': 'rainbow-alt',
  'Three Star': 'rainbow-alt',

  'Secret Rare': 'secret-rare',
  'ACE SPEC Rare': 'secret-rare',
  'Special illustration rare': 'secret-rare',

  'Shiny rare': 'shiny-rare',
  'One Shiny': 'shiny-rare',
  'Two Shiny': 'shiny-rare',

  'Shiny rare V': 'shiny-v',
  'Shiny Ultra Rare': 'shiny-v',
  'Shiny rare VMAX': 'shiny-vmax',

  'Holo Rare V': 'v-regular',
  'Ultra Rare': 'v-full-art',
  'Double rare': 'v-full-art',
  'Two Star': 'v-full-art',
  'Holo Rare VMAX': 'v-max',
  'Holo Rare VSTAR': 'v-star',

  'Full Art Trainer': 'trainer-full-art',
  'Illustration rare': 'trainer-gallery-holo',
  'Pikachu Rare': 'swsh-pikachu',
};

/** Effects whose foil covers the entire card rather than an art window. */
const FULL_ART: ReadonlySet<EffectId> = new Set<EffectId>([
  'v-full-art',
  'secret-rare',
  'rainbow-holo',
  'rainbow-alt',
  'shiny-rare',
  'shiny-v',
  'shiny-vmax',
  'v-max',
  'v-star',
  'swsh-pikachu',
]);

/** Effects the reference clips to the card's rounded border, not its art. */
const BORDERS: ReadonlySet<EffectId> = new Set<EffectId>([
  'radiant-holo',
  'trainer-gallery-holo',
  'trainer-gallery-v-regular',
  'trainer-gallery-v-max',
  'trainer-gallery-secret-rare',
]);

/** Effects a reverse printing is allowed to replace. */
const REVERSIBLE: ReadonlySet<EffectId> = new Set<EffectId>(['basic', 'regular-holo']);

/** The reference detects gallery cards from the card number, not a rarity. */
function isTrainerGallery(localId: string | undefined): boolean {
  return /^[tg]g/i.test(localId ?? '');
}

function galleryEffect(base: EffectId): EffectId {
  if (base === 'v-regular') return 'trainer-gallery-v-regular';
  if (base === 'v-max') return 'trainer-gallery-v-max';
  if (base === 'secret-rare') return 'trainer-gallery-secret-rare';
  return 'trainer-gallery-holo';
}

function clipShape(effect: EffectId, card: Card): ClipShape {
  // Order matters: radiant and the gallery effects clip to the border, and
  // would otherwise be claimed by the full-art or trainer rules below.
  if (BORDERS.has(effect)) return 'borders';
  if (card.rarity === 'Full Art Trainer') return 'full';
  if (FULL_ART.has(effect)) return 'full';
  if (card.category === 'Trainer') return 'trainer';
  if (card.stage === 'Stage1' || card.stage === 'Stage2') return 'stage';
  return 'regular';
}

/** Which foil a card gets, where it is confined, and whether that is inverted. */
export function selectHolo(card: Card): HoloSelection {
  const base: EffectId = (card.rarity && EFFECT_BY_RARITY[card.rarity]) || 'basic';

  let effect = base;
  let invert = false;

  if (isTrainerGallery(card.localId)) {
    effect = galleryEffect(base);
  } else if (REVERSIBLE.has(base) && (card.variants as Variants | undefined)?.reverse) {
    effect = 'reverse-holo';
    invert = true;
  }

  return { effect, shape: clipShape(effect, card), invert };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
pnpm vitest run apps/holodex/src/holo/select.test.ts
```

Expected: PASS, 19 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm --filter @ncam/holodex typecheck && pnpm lint
git add apps/holodex/src/holo/select.ts apps/holodex/src/holo/select.test.ts
git commit -m "feat(holodex): select a holo effect per rarity, layout and printing

All 42 TCGdex rarities map to one of 22 effects, asserted in both directions.
Trainer-gallery cards are detected from the card number, as the reference does,
and a reverse printing replaces only the basic and regular-holo looks.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Clip regions

**Files:**

- Create: `apps/holodex/src/holo/regions.ts`
- Test: `apps/holodex/src/holo/regions.test.ts`

**Interfaces:**

- Consumes: `ClipShape` from `./select`.
- Produces: `RegionRect` (`{ top, right, bottom, left }`, fractions of the card), `SHAPE_ID` (`Record<ClipShape, number>`), `regionFor(shape)`, `coversPoint(shape, x, y, invert)`.

`coversPoint` is the TypeScript twin of the GLSL coverage function. It exists so the geometry can be tested — the shader version is generated from the same numbers in Task 5.

- [ ] **Step 1: Write the failing test**

Create `apps/holodex/src/holo/regions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { coversPoint, regionFor, SHAPE_ID } from './regions';

describe('regionFor', () => {
  it('returns the reference inset for a regular card', () => {
    // --clip: inset(9.85% 8% 52.85% 8%)
    expect(regionFor('regular')).toEqual({ top: 0.0985, right: 0.08, bottom: 0.5285, left: 0.08 });
  });

  it('returns the reference inset for a trainer', () => {
    // --clip-trainer: inset(14.5% 8.5% 48.2% 8.5%)
    expect(regionFor('trainer')).toEqual({ top: 0.145, right: 0.085, bottom: 0.482, left: 0.085 });
  });

  it('returns the reference inset for the rounded border', () => {
    // --clip-borders: inset(2.8% 4%)
    expect(regionFor('borders')).toEqual({ top: 0.028, right: 0.04, bottom: 0.028, left: 0.04 });
  });

  it('covers the whole card for the full shape', () => {
    expect(regionFor('full')).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('gives the stage shape the same outer bounds as regular', () => {
    const stage = regionFor('stage');
    const regular = regionFor('regular');
    expect(stage.left).toBe(regular.left);
    expect(stage.bottom).toBe(regular.bottom);
  });
});

describe('SHAPE_ID', () => {
  it('assigns every shape a distinct integer for the shader', () => {
    const ids = Object.values(SHAPE_ID);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
  });
});

describe('coversPoint', () => {
  it('covers the middle of the art window and not the text box', () => {
    expect(coversPoint('regular', 0.5, 0.3, false)).toBe(true);
    expect(coversPoint('regular', 0.5, 0.8, false)).toBe(false);
  });

  it('excludes the margins', () => {
    expect(coversPoint('regular', 0.02, 0.3, false)).toBe(false);
    expect(coversPoint('regular', 0.98, 0.3, false)).toBe(false);
  });

  it('inverts exactly — reverse holo foils everything the region excludes', () => {
    for (const [x, y] of [
      [0.5, 0.3],
      [0.5, 0.8],
      [0.02, 0.3],
    ] as const) {
      expect(coversPoint('regular', x, y, true)).toBe(!coversPoint('regular', x, y, false));
    }
  });

  it('covers everything for the full shape and nothing when that is inverted', () => {
    expect(coversPoint('full', 0.01, 0.99, false)).toBe(true);
    expect(coversPoint('full', 0.5, 0.5, true)).toBe(false);
  });

  it('steps the stage shape in at the top-left, where the evolution box sits', () => {
    // Inside the regular window but within the stage cut-out.
    expect(coversPoint('regular', 0.2, 0.12, false)).toBe(true);
    expect(coversPoint('stage', 0.2, 0.12, false)).toBe(false);
    // Well inside the art for both.
    expect(coversPoint('stage', 0.5, 0.35, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run apps/holodex/src/holo/regions.test.ts
```

Expected: FAIL — cannot resolve `./regions`.

- [ ] **Step 3: Write the implementation**

Create `apps/holodex/src/holo/regions.ts`:

```ts
import type { ClipShape } from './select';

/** Insets as fractions of the card, matching the reference's CSS percentages. */
export interface RegionRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Passed to the shader as an int so it can branch on the outline's shape. */
export const SHAPE_ID: Record<ClipShape, number> = {
  full: 0,
  regular: 1,
  stage: 2,
  trainer: 3,
  borders: 4,
};

/**
 * Straight from pokemon-cards-css:
 *   --clip:         inset(9.85% 8% 52.85% 8%)
 *   --clip-trainer: inset(14.5% 8.5% 48.2% 8.5%)
 *   --clip-borders: inset(2.8% 4% round 2.55% / 1.5%)
 * `stage` shares regular's outer bounds and cuts a step out of the top-left,
 * where an evolution card's "evolves from" box overlaps the art.
 */
const REGIONS: Record<ClipShape, RegionRect> = {
  full: { top: 0, right: 0, bottom: 0, left: 0 },
  regular: { top: 0.0985, right: 0.08, bottom: 0.5285, left: 0.08 },
  stage: { top: 0.0985, right: 0.08, bottom: 0.5285, left: 0.08 },
  trainer: { top: 0.145, right: 0.085, bottom: 0.482, left: 0.085 },
  borders: { top: 0.028, right: 0.04, bottom: 0.028, left: 0.04 },
};

/** The stage cut-out: everything left of `x` and above `y` is excluded. */
const STAGE_STEP = { x: 0.57, y: 0.16 };

export function regionFor(shape: ClipShape): RegionRect {
  return REGIONS[shape];
}

/**
 * Whether the foil covers this point. `x` and `y` are fractions of the card
 * from its top-left. The GLSL coverage function generated in Task 5 computes
 * the same thing from the same constants — this is its testable twin.
 */
export function coversPoint(shape: ClipShape, x: number, y: number, invert: boolean): boolean {
  const r = REGIONS[shape];
  let inside = x >= r.left && x <= 1 - r.right && y >= r.top && y <= 1 - r.bottom;
  if (inside && shape === 'stage' && x < STAGE_STEP.x && y < STAGE_STEP.y) inside = false;
  return invert ? !inside : inside;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
pnpm vitest run apps/holodex/src/holo/regions.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/holodex/src/holo/regions.ts apps/holodex/src/holo/regions.test.ts
git commit -m "feat(holodex): clip regions for the foil, with a testable coverage twin

Insets come straight from the reference's CSS custom properties. coversPoint
is the TypeScript twin of the GLSL coverage function so the geometry, including
reverse holo's inversion, can be tested without a GPU.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Blend modes

Thirteen CSS blend modes, each as a GLSL function and as a TypeScript reference implementation. The TypeScript twins exist so the formulas can be tested — a wrong `softLight` is invisible in a screenshot but obvious against a known value. These are the exact formulas from the W3C compositing specification, not approximations; getting them right is most of what makes a derived effect resemble its source.

**Files:**

- Create: `apps/holodex/src/holo/shader/blend.ts`
- Test: `apps/holodex/src/holo/shader/blend.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `BlendMode` (13 values), `blendGLSL` (the GLSL source for all of them plus a `blendWith(int, vec3, vec3)` dispatcher), `BLEND_ID: Record<BlendMode, number>`, and `blendRGB(mode, backdrop, source): [number, number, number]`.

- [ ] **Step 1: Write the failing test**

Create `apps/holodex/src/holo/shader/blend.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BLEND_ID, blendGLSL, blendRGB, type BlendMode } from './blend';

const ALL: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'luminosity',
];

const close = (a: number, b: number) => Math.abs(a - b) < 1e-4;
const rgbClose = (a: readonly number[], b: readonly number[]) => a.every((v, i) => close(v, b[i]));

describe('BLEND_ID', () => {
  it('gives every mode a distinct integer', () => {
    const ids = ALL.map((m) => BLEND_ID[m]);
    expect(ids.every((n) => Number.isInteger(n))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('blendRGB — separable modes against known values', () => {
  it('multiply darkens toward the product', () => {
    expect(
      rgbClose(blendRGB('multiply', [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0.25, 0.25, 0.25]),
    ).toBe(true);
    expect(rgbClose(blendRGB('multiply', [1, 1, 1], [0.3, 0.3, 0.3]), [0.3, 0.3, 0.3])).toBe(true);
  });

  it('screen lightens toward the inverse product', () => {
    expect(rgbClose(blendRGB('screen', [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0.75, 0.75, 0.75])).toBe(
      true,
    );
    expect(rgbClose(blendRGB('screen', [0, 0, 0], [0.4, 0.4, 0.4]), [0.4, 0.4, 0.4])).toBe(true);
  });

  it('overlay and hard-light are transposes of each other', () => {
    const backdrop = [0.25, 0.6, 0.9] as const;
    const source = [0.7, 0.2, 0.5] as const;
    expect(
      rgbClose(blendRGB('overlay', backdrop, source), blendRGB('hard-light', source, backdrop)),
    ).toBe(true);
  });

  it('darken and lighten pick per channel', () => {
    expect(rgbClose(blendRGB('darken', [0.2, 0.8, 0.5], [0.6, 0.3, 0.5]), [0.2, 0.3, 0.5])).toBe(
      true,
    );
    expect(rgbClose(blendRGB('lighten', [0.2, 0.8, 0.5], [0.6, 0.3, 0.5]), [0.6, 0.8, 0.5])).toBe(
      true,
    );
  });

  it('color-dodge brightens and saturates at white', () => {
    expect(
      rgbClose(blendRGB('color-dodge', [0.25, 0.25, 0.25], [0.5, 0.5, 0.5]), [0.5, 0.5, 0.5]),
    ).toBe(true);
    expect(rgbClose(blendRGB('color-dodge', [0.4, 0.4, 0.4], [1, 1, 1]), [1, 1, 1])).toBe(true);
    expect(rgbClose(blendRGB('color-dodge', [0, 0, 0], [0.7, 0.7, 0.7]), [0, 0, 0])).toBe(true);
  });

  it('difference and exclusion agree at the extremes and differ in the middle', () => {
    expect(rgbClose(blendRGB('difference', [1, 0, 0.5], [0, 1, 0.5]), [1, 1, 0])).toBe(true);
    expect(rgbClose(blendRGB('exclusion', [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0.5, 0.5, 0.5])).toBe(
      true,
    );
    expect(rgbClose(blendRGB('difference', [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0, 0, 0])).toBe(
      true,
    );
  });

  it('soft-light leaves the backdrop alone at mid-grey source', () => {
    const backdrop = [0.2, 0.55, 0.85] as const;
    expect(rgbClose(blendRGB('soft-light', backdrop, [0.5, 0.5, 0.5]), backdrop)).toBe(true);
  });

  it('normal returns the source', () => {
    expect(rgbClose(blendRGB('normal', [0.1, 0.2, 0.3], [0.7, 0.8, 0.9]), [0.7, 0.8, 0.9])).toBe(
      true,
    );
  });
});

describe('blendRGB — non-separable modes', () => {
  it('luminosity takes the source luma and the backdrop colour', () => {
    const out = blendRGB('luminosity', [0.8, 0.2, 0.2], [0.5, 0.5, 0.5]);
    const luma = (c: readonly number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    expect(close(luma(out), 0.5)).toBe(true);
  });

  it('hue keeps the backdrop luma', () => {
    const backdrop = [0.8, 0.2, 0.2] as const;
    const out = blendRGB('hue', backdrop, [0.2, 0.2, 0.8]);
    const luma = (c: readonly number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    expect(close(luma(out), luma(backdrop))).toBe(true);
  });

  it('saturation keeps the backdrop luma too', () => {
    const backdrop = [0.6, 0.4, 0.2] as const;
    const out = blendRGB('saturation', backdrop, [0.9, 0.1, 0.1]);
    const luma = (c: readonly number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    expect(close(luma(out), luma(backdrop))).toBe(true);
  });

  it('never produces a channel outside 0..1', () => {
    for (const mode of ALL) {
      for (const [b, s] of [
        [
          [0, 0, 0],
          [1, 1, 1],
        ],
        [
          [1, 1, 1],
          [0, 0, 0],
        ],
        [
          [0.9, 0.1, 0.5],
          [0.2, 0.95, 0.05],
        ],
      ] as const) {
        const out = blendRGB(mode, b, s);
        expect(out.every((v) => v >= -1e-6 && v <= 1 + 1e-6)).toBe(true);
      }
    }
  });
});

describe('blendGLSL', () => {
  it('declares a function for every mode and a dispatcher', () => {
    for (const name of [
      'blendMultiply',
      'blendScreen',
      'blendOverlay',
      'blendDarken',
      'blendLighten',
      'blendColorDodge',
      'blendHardLight',
      'blendSoftLight',
      'blendDifference',
      'blendExclusion',
      'blendHue',
      'blendSaturation',
      'blendLuminosity',
      'blendWith',
    ]) {
      expect(blendGLSL).toContain(name);
    }
  });

  it('dispatches on the same integers the TypeScript side uses', () => {
    for (const mode of ALL) {
      expect(blendGLSL).toContain(`case ${BLEND_ID[mode]}:`);
    }
  });

  it('is balanced source, so a concatenation cannot silently truncate it', () => {
    const opens = (blendGLSL.match(/\{/g) ?? []).length;
    const closes = (blendGLSL.match(/\}/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run apps/holodex/src/holo/shader/blend.test.ts
```

Expected: FAIL — cannot resolve `./blend`.

- [ ] **Step 3: Write the implementation**

Create `apps/holodex/src/holo/shader/blend.ts`:

```ts
/**
 * The CSS blend modes pokemon-cards-css composites its foil layers with,
 * as GLSL and as TypeScript.
 *
 * Both sides implement the W3C compositing formulas exactly. The TypeScript
 * twins are not used at runtime — they exist so the formulas can be tested
 * against known values, because a wrong soft-light is invisible in a
 * screenshot and obvious in an assertion.
 */

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'luminosity';

export const BLEND_ID: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  'color-dodge': 6,
  'hard-light': 7,
  'soft-light': 8,
  difference: 9,
  exclusion: 10,
  hue: 11,
  saturation: 12,
  luminosity: 13,
};

// ---------------------------------------------------------------- TypeScript

type RGB = readonly [number, number, number] | readonly number[];
type Out = [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const perChannel = (b: RGB, s: RGB, f: (b: number, s: number) => number): Out => [
  clamp01(f(b[0], s[0])),
  clamp01(f(b[1], s[1])),
  clamp01(f(b[2], s[2])),
];

const lum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

function clipColor(c: Out): Out {
  const l = lum(c);
  const n = Math.min(c[0], c[1], c[2]);
  const x = Math.max(c[0], c[1], c[2]);
  let out: Out = [c[0], c[1], c[2]];
  if (n < 0) out = out.map((v) => l + ((v - l) * l) / (l - n || 1e-6)) as Out;
  if (x > 1) out = out.map((v) => l + ((v - l) * (1 - l)) / (x - l || 1e-6)) as Out;
  return out;
}

function setLum(c: RGB, l: number): Out {
  const d = l - lum(c);
  return clipColor([c[0] + d, c[1] + d, c[2] + d]);
}

const sat = (c: RGB) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);

function setSat(c: RGB, s: number): Out {
  const out: Out = [c[0], c[1], c[2]];
  const mx = Math.max(out[0], out[1], out[2]);
  const mn = Math.min(out[0], out[1], out[2]);
  if (mx <= mn) return [0, 0, 0];
  return out.map((v) => ((v - mn) / (mx - mn)) * s) as Out;
}

const softLightChannel = (b: number, s: number): number => {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
};

/** Blend `source` onto `backdrop`, both non-premultiplied RGB in 0..1. */
export function blendRGB(mode: BlendMode, backdrop: RGB, source: RGB): Out {
  switch (mode) {
    case 'normal':
      return [clamp01(source[0]), clamp01(source[1]), clamp01(source[2])];
    case 'multiply':
      return perChannel(backdrop, source, (b, s) => b * s);
    case 'screen':
      return perChannel(backdrop, source, (b, s) => b + s - b * s);
    case 'overlay':
      return perChannel(backdrop, source, (b, s) =>
        b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s),
      );
    case 'darken':
      return perChannel(backdrop, source, (b, s) => Math.min(b, s));
    case 'lighten':
      return perChannel(backdrop, source, (b, s) => Math.max(b, s));
    case 'color-dodge':
      return perChannel(backdrop, source, (b, s) =>
        b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)),
      );
    case 'hard-light':
      return perChannel(backdrop, source, (b, s) =>
        s <= 0.5 ? 2 * s * b : 1 - 2 * (1 - s) * (1 - b),
      );
    case 'soft-light':
      return perChannel(backdrop, source, softLightChannel);
    case 'difference':
      return perChannel(backdrop, source, (b, s) => Math.abs(b - s));
    case 'exclusion':
      return perChannel(backdrop, source, (b, s) => b + s - 2 * b * s);
    case 'hue':
      return setLum(setSat(source, sat(backdrop)), lum(backdrop)).map(clamp01) as Out;
    case 'saturation':
      return setLum(setSat(backdrop, sat(source)), lum(backdrop)).map(clamp01) as Out;
    case 'luminosity':
      return setLum(backdrop, lum(source)).map(clamp01) as Out;
  }
}

// ---------------------------------------------------------------------- GLSL

/**
 * Appended verbatim into every generated fragment shader. `blendWith`
 * dispatches on the same integers as BLEND_ID, so the two implementations
 * cannot drift apart without a test noticing.
 */
export const blendGLSL = /* glsl */ `
float bLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }

vec3 bClipColor(vec3 c) {
  float l = bLum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + ((c - l) * l) / max(l - n, 1e-6);
  if (x > 1.0) c = l + ((c - l) * (1.0 - l)) / max(x - l, 1e-6);
  return c;
}

vec3 bSetLum(vec3 c, float l) { return bClipColor(c + (l - bLum(c))); }

float bSat(vec3 c) {
  return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
}

vec3 bSetSat(vec3 c, float s) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  if (mx <= mn) return vec3(0.0);
  return ((c - mn) / (mx - mn)) * s;
}

vec3 blendMultiply(vec3 b, vec3 s) { return b * s; }
vec3 blendScreen(vec3 b, vec3 s) { return b + s - b * s; }
vec3 blendDarken(vec3 b, vec3 s) { return min(b, s); }
vec3 blendLighten(vec3 b, vec3 s) { return max(b, s); }
vec3 blendDifference(vec3 b, vec3 s) { return abs(b - s); }
vec3 blendExclusion(vec3 b, vec3 s) { return b + s - 2.0 * b * s; }

vec3 blendOverlay(vec3 b, vec3 s) {
  return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));
}

vec3 blendHardLight(vec3 b, vec3 s) {
  return mix(2.0 * s * b, 1.0 - 2.0 * (1.0 - s) * (1.0 - b), step(0.5, s));
}

vec3 blendColorDodge(vec3 b, vec3 s) {
  vec3 r = min(vec3(1.0), b / max(1.0 - s, 1e-6));
  r = mix(r, vec3(1.0), step(1.0, s));
  return mix(r, vec3(0.0), step(b, vec3(0.0)));
}

vec3 blendSoftLight(vec3 b, vec3 s) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
  vec3 lo = b - (1.0 - 2.0 * s) * b * (1.0 - b);
  vec3 hi = b + (2.0 * s - 1.0) * (d - b);
  return mix(lo, hi, step(0.5, s));
}

vec3 blendHue(vec3 b, vec3 s) { return bSetLum(bSetSat(s, bSat(b)), bLum(b)); }
vec3 blendSaturation(vec3 b, vec3 s) { return bSetLum(bSetSat(b, bSat(s)), bLum(b)); }
vec3 blendLuminosity(vec3 b, vec3 s) { return bSetLum(b, bLum(s)); }

vec3 blendWith(int mode, vec3 b, vec3 s) {
  switch (mode) {
    case ${BLEND_ID.multiply}: return blendMultiply(b, s);
    case ${BLEND_ID.screen}: return blendScreen(b, s);
    case ${BLEND_ID.overlay}: return blendOverlay(b, s);
    case ${BLEND_ID.darken}: return blendDarken(b, s);
    case ${BLEND_ID.lighten}: return blendLighten(b, s);
    case ${BLEND_ID['color-dodge']}: return blendColorDodge(b, s);
    case ${BLEND_ID['hard-light']}: return blendHardLight(b, s);
    case ${BLEND_ID['soft-light']}: return blendSoftLight(b, s);
    case ${BLEND_ID.difference}: return blendDifference(b, s);
    case ${BLEND_ID.exclusion}: return blendExclusion(b, s);
    case ${BLEND_ID.hue}: return blendHue(b, s);
    case ${BLEND_ID.saturation}: return blendSaturation(b, s);
    case ${BLEND_ID.luminosity}: return blendLuminosity(b, s);
    case ${BLEND_ID.normal}: return s;
  }
  return s;
}
`;
```

The `switch` on an `int` needs GLSL ES 3.0, which is what three.js emits for a WebGL2 context — and `capability.ts` already refuses anything without WebGL2, so this is safe.

- [ ] **Step 4: Run it and watch it pass**

```bash
pnpm vitest run apps/holodex/src/holo/shader/blend.test.ts
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/holodex/src/holo/shader/blend.ts apps/holodex/src/holo/shader/blend.test.ts
git commit -m "feat(holodex): the 13 css blend modes in glsl and typescript

Exact W3C compositing formulas, including the three non-separable hsl modes.
The TypeScript twins are not used at runtime; they exist so the formulas can be
asserted against known values, since a wrong soft-light is invisible in a
screenshot.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The effect DSL and its layer sources

This task defines the vocabulary every effect file is written in, and the GLSL that realises each kind of layer. The shape comes directly from the reference's CSS: a `background-image` stack composited by `background-blend-mode`, then a `filter`, then a `mix-blend-mode` onto what is below, at a pointer-driven `opacity`.

**Files:**

- Create: `apps/holodex/src/holo/shader/types.ts`
- Create: `apps/holodex/src/holo/shader/sources.ts`
- Test: `apps/holodex/src/holo/shader/sources.test.ts`

**Interfaces:**

- Consumes: `BlendMode`, `BLEND_ID` from `./blend`.
- Produces:
  - Types: `Source`, `Layer`, `Filter`, `Element`, `Effect`, `PointerDriven`
  - `uvTransform(uv, size, pos)` — TypeScript twin of the GLSL transform
  - `sourcesGLSL` — the source-sampling functions
  - `SOURCE_ID: Record<Source['kind'], number>`

- [ ] **Step 1: Write the DSL types**

Create `apps/holodex/src/holo/shader/types.ts`:

```ts
import type { BlendMode } from './blend';

/**
 * A number that may follow the pointer. The reference writes these as CSS
 * calc() over --pointer-from-center and friends; here they are a base plus
 * coefficients the shader evaluates per fragment.
 */
export interface PointerDriven {
  base: number;
  /** multiplied by distance from card centre, 0 at centre, 1 at a corner */
  fromCenter?: number;
  /** multiplied by pointer position across the card, 0..1 */
  fromLeft?: number;
  fromTop?: number;
}

/** One entry in a layer stack — the GLSL equivalent of one background-image. */
export type Source =
  | { kind: 'solid'; color: [number, number, number] }
  | {
      /** repeating-linear-gradient(angle, stops...) — the foil's rainbow bands */
      kind: 'repeating-linear';
      angleDeg: number;
      /** fraction of the gradient each stop occupies; the reference's --space */
      space: number;
      stops: Array<[number, number, number]>;
    }
  | { kind: 'linear'; angleDeg: number; stops: Array<[number, number, number]> }
  | {
      /** radial-gradient(circle at pointer, stops...) — the glare */
      kind: 'radial-pointer';
      stops: Array<{ at: number; color: [number, number, number] }>;
    }
  | { kind: 'conic'; stops: Array<[number, number, number]> }
  /** tiled value-noise sparkle, generated once into a texture */
  | { kind: 'glitter'; scale: number }
  /** tiled film grain, generated once into a texture */
  | { kind: 'grain'; scale: number }
  /** the card art itself */
  | { kind: 'card' }
  /** horizontal scanlines, as in regular-holo */
  | { kind: 'scanlines'; spacing: number; light: number; dark: number };

export interface Layer {
  source: Source;
  /** how this layer combines with the ones beneath it inside the same element */
  blend: BlendMode;
  /** background-size: 1 means cover; 4 means the source repeats 4x */
  size?: [number, number];
  /** background-position, as a fraction; may follow the pointer */
  offset?: { x: PointerDriven; y: PointerDriven };
}

/** CSS filter: brightness()/contrast()/saturate(), each pointer-driven. */
export interface Filter {
  brightness?: PointerDriven;
  contrast?: PointerDriven;
  saturate?: PointerDriven;
}

/** One of the reference's .card__shine / .card__glare elements. */
export interface Element {
  layers: Layer[];
  filter?: Filter;
  /** how the finished element composites onto everything below it */
  mixBlend: BlendMode;
  opacity?: PointerDriven;
}

export interface Effect {
  id: string;
  /** 1–3 elements, matching .card__shine and its :before / :after */
  shine: Element[];
  /** 0–2 elements, matching .card__glare and its :after */
  glare: Element[];
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/holodex/src/holo/shader/sources.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SOURCE_ID, sourcesGLSL, uvTransform } from './sources';

describe('uvTransform', () => {
  it('returns uv unchanged at size 1 and no offset', () => {
    expect(uvTransform([0.25, 0.75], [1, 1], [0, 0])).toEqual([0.25, 0.75]);
  });

  it('scales around the origin so a size of 2 repeats twice', () => {
    expect(uvTransform([0.5, 0.5], [2, 2], [0, 0])).toEqual([1, 1]);
  });

  it('shifts by the offset', () => {
    const [x, y] = uvTransform([0.5, 0.5], [1, 1], [0.25, -0.25]);
    expect(x).toBeCloseTo(0.75, 6);
    expect(y).toBeCloseTo(0.25, 6);
  });

  it('composes scale then offset, in that order', () => {
    const [x, y] = uvTransform([0.5, 0.5], [4, 2], [0.1, 0.2]);
    expect(x).toBeCloseTo(2.1, 6);
    expect(y).toBeCloseTo(1.2, 6);
  });
});

describe('SOURCE_ID', () => {
  it('gives every source kind a distinct integer', () => {
    const ids = Object.values(SOURCE_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every kind the DSL can express', () => {
    for (const kind of [
      'solid',
      'repeating-linear',
      'linear',
      'radial-pointer',
      'conic',
      'glitter',
      'grain',
      'card',
      'scanlines',
    ]) {
      expect(SOURCE_ID).toHaveProperty(kind);
    }
  });
});

describe('sourcesGLSL', () => {
  it('declares a sampler for each source kind', () => {
    for (const fn of [
      'srcSolid',
      'srcRepeatingLinear',
      'srcLinear',
      'srcRadialPointer',
      'srcConic',
      'srcGlitter',
      'srcGrain',
      'srcCard',
      'srcScanlines',
    ]) {
      expect(sourcesGLSL).toContain(fn);
    }
  });

  it('declares the uv transform and the filter helper', () => {
    expect(sourcesGLSL).toContain('uvTransform');
    expect(sourcesGLSL).toContain('applyFilter');
  });

  it('is balanced source', () => {
    expect((sourcesGLSL.match(/\{/g) ?? []).length).toBe((sourcesGLSL.match(/\}/g) ?? []).length);
    expect((sourcesGLSL.match(/\(/g) ?? []).length).toBe((sourcesGLSL.match(/\)/g) ?? []).length);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
pnpm vitest run apps/holodex/src/holo/shader/sources.test.ts
```

Expected: FAIL — cannot resolve `./sources`.

- [ ] **Step 4: Write the implementation**

Create `apps/holodex/src/holo/shader/sources.ts`:

```ts
import type { Source } from './types';

export const SOURCE_ID: Record<Source['kind'], number> = {
  solid: 0,
  'repeating-linear': 1,
  linear: 2,
  'radial-pointer': 3,
  conic: 4,
  glitter: 5,
  grain: 6,
  card: 7,
  scanlines: 8,
};

/**
 * background-size then background-position, in that order — the same order
 * CSS applies them. The GLSL twin below must stay identical; the test pins it.
 */
export function uvTransform(
  uv: readonly [number, number],
  size: readonly [number, number],
  offset: readonly [number, number],
): [number, number] {
  return [uv[0] * size[0] + offset[0], uv[1] * size[1] + offset[1]];
}

/**
 * The layer-source samplers. Gradient stops arrive as a uniform array so one
 * compiled program can serve every effect that uses the same source kinds;
 * only the data differs.
 */
export const sourcesGLSL = /* glsl */ `
#define MAX_STOPS 8

uniform sampler2D uCard;
uniform sampler2D uGlitter;
uniform sampler2D uGrain;
uniform vec2 uPointer;        // -1..1 across the card
uniform vec2 uPointerUV;      // 0..1, for radial gradients centred on it
uniform float uPointerFromCenter;
uniform float uTime;

vec2 uvTransform(vec2 uv, vec2 size, vec2 offset) {
  return uv * size + offset;
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

/** brightness, contrast and saturate, matching CSS's filter functions. */
vec3 applyFilter(vec3 c, float brightness, float contrast, float saturate) {
  c *= brightness;
  c = (c - 0.5) * contrast + 0.5;
  c = mix(vec3(luma(c)), c, saturate);
  return clamp(c, 0.0, 1.0);
}

vec3 gradientAt(vec3 stops[MAX_STOPS], int count, float t) {
  t = fract(t);
  float scaled = t * float(count);
  int i = int(floor(scaled));
  int j = i + 1 >= count ? 0 : i + 1;
  return mix(stops[i], stops[j], fract(scaled));
}

vec3 srcSolid(vec3 color) { return color; }

vec3 srcRepeatingLinear(vec2 uv, float angleDeg, float space, vec3 stops[MAX_STOPS], int count) {
  float a = radians(angleDeg);
  float t = (uv.x * cos(a) + uv.y * sin(a)) / max(space, 1e-4);
  return gradientAt(stops, count, t);
}

vec3 srcLinear(vec2 uv, float angleDeg, vec3 stops[MAX_STOPS], int count) {
  float a = radians(angleDeg);
  float t = clamp(uv.x * cos(a) + uv.y * sin(a), 0.0, 1.0);
  return gradientAt(stops, count, t * (1.0 - 1.0 / float(count)));
}

vec3 srcRadialPointer(vec2 uv, vec3 stops[MAX_STOPS], int count) {
  float d = clamp(length(uv - uPointerUV) * 1.4142, 0.0, 1.0);
  return gradientAt(stops, count, d * (1.0 - 1.0 / float(count)));
}

vec3 srcConic(vec2 uv, vec3 stops[MAX_STOPS], int count) {
  vec2 d = uv - 0.5;
  float t = (atan(d.y, d.x) + 3.14159265) / 6.2831853;
  return gradientAt(stops, count, t);
}

vec3 srcGlitter(vec2 uv, float scale) { return texture(uGlitter, uv * scale).rgb; }
vec3 srcGrain(vec2 uv, float scale) { return texture(uGrain, uv * scale).rgb; }
vec3 srcCard(vec2 uv) { return texture(uCard, uv).rgb; }

vec3 srcScanlines(vec2 uv, float spacing, float light, float dark) {
  float s = step(0.5, fract(uv.y / max(spacing, 1e-4)));
  return vec3(mix(dark, light, s));
}
`;
```

`gradientAt` wraps rather than clamping, which is what makes `repeating-linear` repeat; `srcLinear` and `srcRadialPointer` compensate by scaling `t` so their last stop lands at the end instead of wrapping onto the first.

- [ ] **Step 5: Run it and watch it pass**

```bash
pnpm vitest run apps/holodex/src/holo/shader/sources.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @ncam/holodex typecheck && pnpm lint
git add apps/holodex/src/holo/shader/types.ts apps/holodex/src/holo/shader/sources.ts apps/holodex/src/holo/shader/sources.test.ts
git commit -m "feat(holodex): effect dsl and the glsl layer sources

The DSL mirrors the reference's own structure: a stack of sources combined by
background-blend-mode, a filter, then a mix-blend-mode onto what is below.
uvTransform has a TypeScript twin so the size-then-offset order is pinned.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The shader generator

Turns an `Effect` into a complete fragment shader. Because every effect gets its own compiled program, all of its constants — gradient stops, angles, blend ids, filter coefficients — are **inlined as literals** rather than plumbed through uniform arrays. That keeps the generator simple and the shaders branch-free.

**Files:**

- Create: `apps/holodex/src/holo/shader/base.ts`
- Create: `apps/holodex/src/holo/shader/compile.ts`
- Test: `apps/holodex/src/holo/shader/compile.test.ts`

**Interfaces:**

- Consumes: `Effect`, `Element`, `Layer`, `Source`, `Filter`, `PointerDriven` from `./types`; `blendGLSL`, `BLEND_ID` from `./blend`; `sourcesGLSL` from `./sources`; `SHAPE_ID` from `../regions`.
- Produces: `VERTEX_SHADER`, `baseGLSL`, `compileEffect(effect): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/holodex/src/holo/shader/compile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compileEffect, VERTEX_SHADER } from './compile';
import type { Effect } from './types';

const minimal: Effect = {
  id: 'test-minimal',
  shine: [
    {
      layers: [{ source: { kind: 'card' }, blend: 'normal' }],
      mixBlend: 'normal',
    },
  ],
  glare: [],
};

const rich: Effect = {
  id: 'test-rich',
  shine: [
    {
      layers: [
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: -33,
            space: 0.06,
            stops: [
              [0.9, 0.2, 0.2],
              [0.2, 0.4, 0.9],
            ],
          },
          blend: 'luminosity',
          size: [4, 4],
          offset: { x: { base: 0.1, fromLeft: 0.8 }, y: { base: 0, fromTop: 0.5 } },
        },
        { source: { kind: 'glitter', scale: 4 }, blend: 'soft-light' },
      ],
      filter: { brightness: { base: 0.4, fromCenter: 0.4 }, contrast: { base: 2 } },
      mixBlend: 'color-dodge',
      opacity: { base: 0.3, fromCenter: 0.5 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 1, 1] },
              { at: 1, color: [0, 0, 0] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.8 },
    },
  ],
};

describe('VERTEX_SHADER', () => {
  it('passes uv through and is balanced', () => {
    expect(VERTEX_SHADER).toContain('vUv');
    expect(VERTEX_SHADER).toContain('gl_Position');
    expect((VERTEX_SHADER.match(/\{/g) ?? []).length).toBe(
      (VERTEX_SHADER.match(/\}/g) ?? []).length,
    );
  });
});

describe('compileEffect', () => {
  it('produces a complete, balanced fragment shader', () => {
    const src = compileEffect(minimal);
    expect(src).toContain('void main()');
    expect(src).toContain('precision');
    expect((src.match(/\{/g) ?? []).length).toBe((src.match(/\}/g) ?? []).length);
    expect((src.match(/\(/g) ?? []).length).toBe((src.match(/\)/g) ?? []).length);
  });

  it('includes the blend and source libraries exactly once', () => {
    const src = compileEffect(minimal);
    expect(src.split('vec3 blendWith(').length - 1).toBe(1);
    expect(src.split('vec3 uvTransform(').length - 1).toBe(0); // uvTransform returns vec2
    expect(src.split('vec2 uvTransform(').length - 1).toBe(1);
  });

  it('is deterministic — the same effect compiles to the same source', () => {
    expect(compileEffect(rich)).toBe(compileEffect(rich));
  });

  it('emits no #version directive — three.js prepends its own', () => {
    // three.js builds '#version ' + glslVersion in WebGLProgram when the
    // material sets glslVersion, and GLSL3 === '300 es'. A second directive
    // here is a GLSL compile error that only shows on a real GPU, so this
    // assertion is the only thing standing between us and a black card.
    expect(compileEffect(rich)).not.toContain('#version');
    expect(compileEffect(minimal)).not.toContain('#version');
  });

  it('declares its own fragment output, which GLSL3 does not provide', () => {
    // For GLSL3 three.js deliberately omits its pc_fragColor shim, so the
    // shader must declare `out vec4 fragColor` itself — baseGLSL does.
    expect(compileEffect(minimal)).toContain('out vec4 fragColor');
    expect(compileEffect(minimal)).toContain('fragColor =');
  });

  it('names the effect in a comment so a shader log can be traced back', () => {
    expect(compileEffect(rich)).toContain('test-rich');
  });

  it('inlines gradient stops as literals rather than uniforms', () => {
    const src = compileEffect(rich);
    expect(src).toContain('0.9');
    expect(src).toContain('vec3(0.900000, 0.200000, 0.200000)');
    expect(src).not.toContain('uniform vec3 uStops');
  });

  it('emits the blend id for every layer and element blend', () => {
    const src = compileEffect(rich);
    // luminosity within the stack, color-dodge for the element, hard-light for glare
    expect(src).toContain('blendWith(13');
    expect(src).toContain('blendWith(6');
    expect(src).toContain('blendWith(7');
  });

  it('evaluates pointer-driven numbers rather than baking their base only', () => {
    const src = compileEffect(rich);
    expect(src).toContain('uPointerFromCenter');
  });

  it('emits no glare block when an effect has none', () => {
    const src = compileEffect(minimal);
    expect(src).not.toContain('srcRadialPointer');
  });

  it('applies the clip coverage before writing the fragment', () => {
    const src = compileEffect(minimal);
    expect(src).toContain('coverage');
    expect(src).toContain('uInvert');
  });

  it('handles every source kind without throwing', () => {
    const kinds: Effect['shine'][number]['layers'] = [
      { source: { kind: 'solid', color: [1, 0, 0] }, blend: 'normal' },
      {
        source: {
          kind: 'linear',
          angleDeg: 45,
          stops: [
            [1, 1, 1],
            [0, 0, 0],
          ],
        },
        blend: 'normal',
      },
      {
        source: {
          kind: 'conic',
          stops: [
            [1, 0, 0],
            [0, 1, 0],
          ],
        },
        blend: 'normal',
      },
      { source: { kind: 'grain', scale: 2 }, blend: 'normal' },
      { source: { kind: 'scanlines', spacing: 0.01, light: 0.4, dark: 0 }, blend: 'normal' },
      { source: { kind: 'card' }, blend: 'normal' },
    ];
    const all: Effect = {
      id: 'all-kinds',
      shine: [{ layers: kinds, mixBlend: 'normal' }],
      glare: [],
    };
    expect(() => compileEffect(all)).not.toThrow();
    const src = compileEffect(all);
    expect((src.match(/\{/g) ?? []).length).toBe((src.match(/\}/g) ?? []).length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run apps/holodex/src/holo/shader/compile.test.ts
```

Expected: FAIL — cannot resolve `./compile`.

- [ ] **Step 3: Write the invariant scaffold**

Create `apps/holodex/src/holo/shader/base.ts`:

```ts
import { SHAPE_ID } from '../regions';

export const VERTEX_SHADER = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Everything every effect shares: the varyings, the clip uniforms, and the
 * coverage function. The coverage maths mirrors `coversPoint` in ../regions.ts
 * exactly — that function is its tested twin.
 */
export const baseGLSL = /* glsl */ `
in vec2 vUv;
out vec4 fragColor;

uniform vec4 uClipRect;   // top, right, bottom, left, as fractions
uniform int uClipShape;
uniform float uInvert;    // 1.0 for reverse holo
uniform float uCardOpacity;

const float STAGE_STEP_X = 0.57;
const float STAGE_STEP_Y = 0.16;

/** Whether the foil reaches this fragment. uv.y runs down the card. */
float coverage(vec2 uv) {
  float inside = step(uClipRect.w, uv.x)
               * step(uv.x, 1.0 - uClipRect.y)
               * step(uClipRect.x, uv.y)
               * step(uv.y, 1.0 - uClipRect.z);

  if (uClipShape == ${SHAPE_ID.stage}) {
    float inStep = step(uv.x, STAGE_STEP_X) * step(uv.y, STAGE_STEP_Y);
    inside *= 1.0 - inStep;
  }

  return mix(inside, 1.0 - inside, uInvert);
}
`;
```

- [ ] **Step 4: Write the generator**

Create `apps/holodex/src/holo/shader/compile.ts`:

```ts
import { BLEND_ID, blendGLSL } from './blend';
import { sourcesGLSL } from './sources';
import { baseGLSL, VERTEX_SHADER } from './base';
import type { Effect, Element, Filter, Layer, PointerDriven, Source } from './types';

export { VERTEX_SHADER };

const f = (n: number): string => n.toFixed(6);
const vec3 = (c: readonly number[]): string => `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;

/** A pointer-driven number becomes a GLSL expression, not a constant. */
function driven(p: PointerDriven | undefined, fallback: number): string {
  if (!p) return f(fallback);
  const terms = [f(p.base)];
  if (p.fromCenter) terms.push(`${f(p.fromCenter)} * uPointerFromCenter`);
  if (p.fromLeft) terms.push(`${f(p.fromLeft)} * (uPointerUV.x)`);
  if (p.fromTop) terms.push(`${f(p.fromTop)} * (uPointerUV.y)`);
  return `(${terms.join(' + ')})`;
}

/** Gradient stops become a local const array; each effect owns its own program. */
function stopsArray(name: string, stops: Array<readonly number[]>): string {
  const body = stops.map(vec3).join(', ');
  return `  vec3 ${name}[MAX_STOPS] = vec3[MAX_STOPS](${body}${', vec3(0.0)'.repeat(
    Math.max(0, 8 - stops.length),
  )});`;
}

function sourceExpr(source: Source, uv: string, decls: string[], id: string): string {
  switch (source.kind) {
    case 'solid':
      return `srcSolid(${vec3(source.color)})`;
    case 'repeating-linear':
      decls.push(stopsArray(`stops_${id}`, source.stops));
      return `srcRepeatingLinear(${uv}, ${f(source.angleDeg)}, ${f(source.space)}, stops_${id}, ${source.stops.length})`;
    case 'linear':
      decls.push(stopsArray(`stops_${id}`, source.stops));
      return `srcLinear(${uv}, ${f(source.angleDeg)}, stops_${id}, ${source.stops.length})`;
    case 'radial-pointer':
      decls.push(
        stopsArray(
          `stops_${id}`,
          source.stops.map((s) => s.color),
        ),
      );
      return `srcRadialPointer(${uv}, stops_${id}, ${source.stops.length})`;
    case 'conic':
      decls.push(stopsArray(`stops_${id}`, source.stops));
      return `srcConic(${uv}, stops_${id}, ${source.stops.length})`;
    case 'glitter':
      return `srcGlitter(${uv}, ${f(source.scale)})`;
    case 'grain':
      return `srcGrain(${uv}, ${f(source.scale)})`;
    case 'card':
      return `srcCard(${uv})`;
    case 'scanlines':
      return `srcScanlines(${uv}, ${f(source.spacing)}, ${f(source.light)}, ${f(source.dark)})`;
  }
}

function layerCode(layer: Layer, index: number, prefix: string): string {
  const id = `${prefix}_${index}`;
  const decls: string[] = [];
  const size = layer.size ?? [1, 1];
  const ox = driven(layer.offset?.x, 0);
  const oy = driven(layer.offset?.y, 0);
  const uv = `uv_${id}`;
  const expr = sourceExpr(layer.source, uv, decls, id);

  return [
    ...decls,
    `  vec2 ${uv} = uvTransform(vUv, vec2(${f(size[0])}, ${f(size[1])}), vec2(${ox}, ${oy}));`,
    `  vec3 src_${id} = ${expr};`,
    index === 0
      ? `  vec3 stack_${prefix} = src_${id};`
      : `  stack_${prefix} = blendWith(${BLEND_ID[layer.blend]}, stack_${prefix}, src_${id});`,
  ].join('\n');
}

function filterCode(filter: Filter | undefined, prefix: string): string {
  const b = driven(filter?.brightness, 1);
  const c = driven(filter?.contrast, 1);
  const s = driven(filter?.saturate, 1);
  return `  stack_${prefix} = applyFilter(stack_${prefix}, ${b}, ${c}, ${s});`;
}

function elementCode(element: Element, prefix: string): string {
  const layers = element.layers.map((l, i) => layerCode(l, i, prefix)).join('\n');
  const opacity = driven(element.opacity, 1);
  return [
    `  // --- ${prefix}`,
    layers,
    filterCode(element.filter, prefix),
    `  acc = mix(acc, blendWith(${BLEND_ID[element.mixBlend]}, acc, stack_${prefix}), clamp(${opacity} * uCardOpacity, 0.0, 1.0));`,
  ].join('\n');
}

/** An Effect becomes one complete fragment shader, constants and all. */
export function compileEffect(effect: Effect): string {
  const shine = effect.shine.map((e, i) => elementCode(e, `shine${i}`)).join('\n\n');
  const glare = effect.glare.map((e, i) => elementCode(e, `glare${i}`)).join('\n\n');

  // NO `#version` directive here. three.js prepends `#version 300 es` itself
  // whenever `glslVersion` is set on the material (WebGLProgram.js builds
  // `'#version ' + parameters.glslVersion`, and GLSL3 === '300 es'). Emitting
  // one here too produces a duplicate directive, which is a compile error —
  // and one no test in this plan can catch, because ShaderMaterial is an inert
  // object until a GPU compiles it. The test below pins this.
  return `precision highp float;

// effect: ${effect.id}

${baseGLSL}
${sourcesGLSL}
${blendGLSL}

void main() {
  vec3 art = srcCard(vUv);
  vec3 acc = art;
  float cov = coverage(vUv);

${shine}

  // the foil only exists inside the clip region
  acc = mix(art, acc, cov);

${glare}

  fragColor = vec4(acc, 1.0);
}
`;
}
```

Note the ordering in `main`: the shine stack is clipped, the glare is not. That matches the reference, where `.card__shine` carries `clip-path` and `.card__glare` sweeps the whole card.

- [ ] **Step 5: Run it and watch it pass**

```bash
pnpm vitest run apps/holodex/src/holo/shader/compile.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
pnpm --filter @ncam/holodex typecheck && pnpm lint
git add apps/holodex/src/holo/shader/base.ts apps/holodex/src/holo/shader/compile.ts apps/holodex/src/holo/shader/compile.test.ts
git commit -m "feat(holodex): compile an effect description into a fragment shader

Each effect gets its own program, so every constant is inlined as a literal
rather than plumbed through uniform arrays. The clip coverage applies to the
shine stack and not the glare, matching the reference.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

The program cache lands in Task 6, alongside the effect registry it reads —
committing it here would commit a file that cannot typecheck.

---

### Task 6: The registry, the program cache, and the first four effects

Introduces `EFFECTS`, the cache that compiles from it, and the four effects that cover the ordinary card: `basic`, `reverse-holo`, `regular-holo`, `cosmos-holo`. After this task a Common, a reverse Common and a Holo Rare all render their own foil.

**Files:**

- Create: `apps/holodex/src/holo/effects/basic.ts`, `reverse-holo.ts`, `regular-holo.ts`, `cosmos-holo.ts`, `index.ts`
- Create: `apps/holodex/src/holo/program-cache.ts`
- Test: `apps/holodex/src/holo/effects/index.test.ts`

**Interfaces:**

- Consumes: `Effect` from `../shader/types`; `EffectId` from `../select`; `compileEffect`, `VERTEX_SHADER` from `../shader/compile`.
- Produces: `EFFECTS: Record<EffectId, Effect>` (partial until Task 9 fills it), `getMaterial(id)`, `disposeMaterials()`.

- [ ] **Step 1: Write the failing registry test**

Create `apps/holodex/src/holo/effects/index.test.ts`. It is written now against the **final** 22-effect registry and will stay red until Task 9 completes it — that is deliberate, and Tasks 7 and 8 each turn part of it green:

```ts
import { describe, expect, it } from 'vitest';
import { compileEffect } from '../shader/compile';
import { EFFECTS } from './index';
import { EFFECT_BY_RARITY, OVERRIDE_ONLY_EFFECTS, type EffectId } from '../select';

const ALL_EFFECT_IDS: EffectId[] = [
  ...new Set([...Object.values(EFFECT_BY_RARITY), ...OVERRIDE_ONLY_EFFECTS]),
];

describe('EFFECTS registry', () => {
  it('has an entry for every effect selection can return', () => {
    const missing = ALL_EFFECT_IDS.filter((id) => !(id in EFFECTS));
    expect(missing).toEqual([]);
  });

  it('has no entry selection can never return', () => {
    const stray = Object.keys(EFFECTS).filter((id) => !ALL_EFFECT_IDS.includes(id as EffectId));
    expect(stray).toEqual([]);
  });

  it('gives every effect an id matching its key', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) expect(effect.id).toBe(key);
  });

  it('keeps every effect within the reference’s element budget', () => {
    // The reference gives each card at most .card__shine + :before + :after and
    // .card__glare + :after. `basic` legitimately has no shine at all.
    for (const [key, effect] of Object.entries(EFFECTS)) {
      expect(effect.shine.length, key).toBeLessThanOrEqual(3);
      expect(effect.glare.length, key).toBeLessThanOrEqual(2);
      expect(effect.shine.length + effect.glare.length, key).toBeGreaterThan(0);
    }
  });

  it('gives every element at least one layer', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) {
      for (const el of [...effect.shine, ...effect.glare]) {
        expect(el.layers.length, key).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every gradient within the shader stop limit', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) {
      for (const el of [...effect.shine, ...effect.glare]) {
        for (const layer of el.layers) {
          const s = layer.source;
          const count =
            s.kind === 'repeating-linear' || s.kind === 'linear' || s.kind === 'conic'
              ? s.stops.length
              : s.kind === 'radial-pointer'
                ? s.stops.length
                : 0;
          expect(count, `${key}/${s.kind}`).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it('compiles every effect to balanced shader source', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) {
      const src = compileEffect(effect);
      expect((src.match(/\{/g) ?? []).length, key).toBe((src.match(/\}/g) ?? []).length);
      expect(src, key).toContain('void main()');
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run apps/holodex/src/holo/effects/index.test.ts
```

Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Write the four effects**

`apps/holodex/src/holo/effects/basic.ts` — a non-foil card still catches a little light:

```ts
import type { Effect } from '../shader/types';

/** No foil. A soft pointer-tracking sheen so the card is not inert. */
export const basic: Effect = {
  id: 'basic',
  shine: [],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 1, 1] },
              { at: 0.6, color: [0.15, 0.15, 0.18] },
              { at: 1, color: [0, 0, 0] },
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 0.9 }, contrast: { base: 1.3 } },
      mixBlend: 'soft-light',
      opacity: { base: 0.15, fromCenter: 0.35 },
    },
  ],
};
```

Note `shine: []` — a non-foil card has no shine layer at all, only a glare. The registry test in Step 1 already allows this: it bounds each list and requires the two together to be non-empty, rather than demanding a shine element.

`apps/holodex/src/holo/effects/reverse-holo.ts` — the foil covers everything **except** the art window; `invert` is set by `selectHolo`, so the effect itself needs no special casing:

```ts
import type { Effect } from '../shader/types';

/** Reverse holo: glitter over the card body, art window left clean. */
export const reverseHolo: Effect = {
  id: 'reverse-holo',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 6 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 110,
            space: 0.05,
            stops: [
              [0.78, 0.18, 0.21],
              [0.93, 0.87, 0.06],
              [0.13, 0.91, 0.52],
              [0.05, 0.74, 0.91],
              [0.79, 0.16, 0.95],
            ],
          },
          blend: 'soft-light',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.6 }, y: { base: 0, fromTop: 0.6 } },
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 1.6 },
        saturate: { base: 1.2 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.4, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 1, 1] },
              { at: 1, color: [0.05, 0.05, 0.08] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.18, fromCenter: 0.5 },
    },
  ],
};
```

`apps/holodex/src/holo/effects/regular-holo.ts` — the reference's rainbow bands crossed with vertical scanlines:

```ts
import type { Effect } from '../shader/types';

/** Rare Holo: spectral bands over scanlines, clipped to the art window. */
export const regularHolo: Effect = {
  id: 'regular-holo',
  shine: [
    {
      layers: [
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 110,
            space: 0.05,
            stops: [
              [0.79, 0.16, 0.95],
              [0.05, 0.74, 0.91],
              [0.13, 0.91, 0.52],
              [0.93, 0.87, 0.06],
              [0.97, 0.05, 0.21],
            ],
          },
          blend: 'normal',
          size: [2.2, 2.2],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
        {
          source: { kind: 'scanlines', spacing: 0.006, light: 0.4, dark: 0.0 },
          blend: 'overlay',
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.35 },
        contrast: { base: 2.2 },
        saturate: { base: 1.4 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.45, fromCenter: 0.45 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 1, 1] },
              { at: 1, color: [0.08, 0.08, 0.1] },
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 0.85 }, contrast: { base: 1.7 } },
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
```

`apps/holodex/src/holo/effects/cosmos-holo.ts` — three stacked layers with the galaxy speckle, mirroring his `:before` / `:after`:

```ts
import type { Effect } from '../shader/types';

/** Cosmos foil: galaxy speckle under spectral bands, three parallaxed layers. */
export const cosmosHolo: Effect = {
  id: 'cosmos-holo',
  shine: [
    {
      layers: [
        { source: { kind: 'grain', scale: 1 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 82,
            space: 0.04,
            stops: [
              [0.86, 0.79, 0.35],
              [0.55, 0.82, 0.33],
              [0.33, 0.78, 0.86],
              [0.62, 0.38, 0.87],
            ],
          },
          blend: 'multiply',
          size: [4, 9],
          offset: { x: { base: 0.1, fromLeft: 0.8 }, y: { base: 0.1, fromTop: 0.8 } },
        },
      ],
      filter: { brightness: { base: 1 }, contrast: { base: 1 }, saturate: { base: 0.8 } },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.3 },
    },
    {
      layers: [
        { source: { kind: 'glitter', scale: 3 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 82,
            space: 0.04,
            stops: [
              [0.86, 0.79, 0.35],
              [0.33, 0.78, 0.86],
            ],
          },
          blend: 'lighten',
          size: [4, 9],
          offset: { x: { base: 0.15, fromLeft: 0.7 }, y: { base: 0.15, fromTop: 0.7 } },
        },
      ],
      filter: { brightness: { base: 1.25 }, contrast: { base: 1.75 }, saturate: { base: 0.8 } },
      mixBlend: 'overlay',
      opacity: { base: 0.6, fromCenter: 0.3 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0.05, color: [0.85, 0.94, 1] },
              { at: 1, color: [0.17, 0.16, 0.22] },
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 0.75 }, contrast: { base: 2 }, saturate: { base: 2 } },
      mixBlend: 'overlay',
      opacity: { base: 0.25, fromCenter: 0.6 },
    },
  ],
};
```

`apps/holodex/src/holo/effects/index.ts`:

```ts
import type { EffectId } from '../select';
import type { Effect } from '../shader/types';
import { basic } from './basic';
import { reverseHolo } from './reverse-holo';
import { regularHolo } from './regular-holo';
import { cosmosHolo } from './cosmos-holo';

/**
 * Every effect `selectHolo` can return. The registry test asserts this covers
 * exactly that set — a missing entry is a failing test, not a blank card.
 */
export const EFFECTS = {
  basic,
  'reverse-holo': reverseHolo,
  'regular-holo': regularHolo,
  'cosmos-holo': cosmosHolo,
} as unknown as Record<EffectId, Effect>;
```

The `as unknown as` cast is temporary and **must be removed in Task 9**, when the registry is complete and the type can be satisfied honestly. Leave a comment saying so.

- [ ] **Step 4: Write the program cache**

Create `apps/holodex/src/holo/program-cache.ts` exactly as follows:

```ts
import { ShaderMaterial, Vector2, Vector4 } from 'three';
import { createLogger } from '@ncam/logger';
import { compileEffect, VERTEX_SHADER } from './shader/compile';
import { EFFECTS } from './effects';
import type { EffectId } from './select';

const log = createLogger({ scope: 'holodex' });

const cache = new Map<EffectId, ShaderMaterial>();

function build(id: EffectId): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: '300 es',
    transparent: true,
    vertexShader: VERTEX_SHADER,
    fragmentShader: compileEffect(EFFECTS[id]),
    uniforms: {
      uCard: { value: null },
      uGlitter: { value: null },
      uGrain: { value: null },
      uPointer: { value: new Vector2(0, 0) },
      uPointerUV: { value: new Vector2(0.5, 0.5) },
      uPointerFromCenter: { value: 0 },
      uTime: { value: 0 },
      uClipRect: { value: new Vector4(0, 0, 0, 0) },
      uClipShape: { value: 0 },
      uInvert: { value: 0 },
      uCardOpacity: { value: 1 },
    },
  });
}

/**
 * One material per effect, compiled on first use and kept for the page's
 * lifetime. A failure falls back to `basic`; if `basic` itself fails the
 * caller drops to the plain image.
 */
export function getMaterial(id: EffectId): ShaderMaterial | null {
  const hit = cache.get(id);
  if (hit) return hit;
  try {
    const material = build(id);
    cache.set(id, material);
    return material;
  } catch (error) {
    log.warn('holo.compile-failed', {
      effect: id,
      error: error instanceof Error ? error.message : String(error),
    });
    if (id === 'basic') return null;
    return getMaterial('basic');
  }
}

/** Frees every cached program. Called when the whole remote unmounts. */
export function disposeMaterials(): void {
  for (const material of cache.values()) material.dispose();
  cache.clear();
}
```

- [ ] **Step 5: Test the cache**

`ShaderMaterial` is a plain object until it is rendered, so the cache is testable under `node` with no GL context. Create `apps/holodex/src/holo/program-cache.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { disposeMaterials, getMaterial } from './program-cache';

describe('getMaterial', () => {
  it('returns a material for a known effect', () => {
    const m = getMaterial('basic');
    expect(m).not.toBeNull();
    expect(m?.fragmentShader).toContain('void main()');
  });

  it('compiles each effect once and caches it', () => {
    disposeMaterials();
    const first = getMaterial('regular-holo');
    const second = getMaterial('regular-holo');
    expect(first).toBe(second);
  });

  it('gives different effects different programs', () => {
    disposeMaterials();
    const a = getMaterial('regular-holo');
    const b = getMaterial('cosmos-holo');
    expect(a).not.toBe(b);
    expect(a?.fragmentShader).not.toBe(b?.fragmentShader);
  });

  it('declares every uniform the generated shaders reference', () => {
    disposeMaterials();
    const m = getMaterial('cosmos-holo');
    for (const name of [
      'uCard',
      'uGlitter',
      'uGrain',
      'uPointer',
      'uPointerUV',
      'uPointerFromCenter',
      'uTime',
      'uClipRect',
      'uClipShape',
      'uInvert',
      'uCardOpacity',
    ]) {
      expect(m?.uniforms, name).toHaveProperty(name);
    }
  });

  it('falls back to basic when an effect cannot be compiled', () => {
    disposeMaterials();
    // An id outside the registry makes compileEffect throw on an undefined effect.
    const m = getMaterial('does-not-exist' as Parameters<typeof getMaterial>[0]);
    expect(m).not.toBeNull();
    expect(m).toBe(getMaterial('basic'));
  });

  it('empties the cache on dispose', () => {
    const before = getMaterial('basic');
    disposeMaterials();
    expect(getMaterial('basic')).not.toBe(before);
  });
});
```

- [ ] **Step 6: Run the tests**

```bash
pnpm vitest run apps/holodex/src/holo
```

Expected: the program-cache tests pass, and the registry's "has an entry for every effect" test FAILS, listing the 18 effects still to come. Every other test in the file passes. That failure is the plan's progress bar — Tasks 7, 8 and 9 shrink the list to empty.

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm --filter @ncam/holodex typecheck && pnpm lint
git add apps/holodex/src/holo/effects apps/holodex/src/holo/program-cache.ts apps/holodex/src/holo/program-cache.test.ts
git commit -m "feat(holodex): effect registry, program cache and the four ordinary foils

basic, reverse-holo, regular-holo and cosmos-holo. The registry test asserts
coverage against what selectHolo can return and stays red until the remaining
18 effects land.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: The chase foils

Six effects: `rainbow-holo`, `rainbow-alt`, `secret-rare`, `swsh-pikachu`, `amazing-rare`, `radiant-holo`. All are full-card or border-clipped, and all lean on glitter.

**Files:** create six files under `apps/holodex/src/holo/effects/`, and register them in `index.ts`.

**Interfaces:** consumes `Effect` from `../shader/types`; produces six named exports added to `EFFECTS`.

Shared palette — put this in `apps/holodex/src/holo/effects/palette.ts` and import it, rather than repeating the numbers:

```ts
/** The reference's --sunpillar stops, as linear RGB triples. */
export const SUNPILLAR: Array<[number, number, number]> = [
  [0.79, 0.16, 0.95],
  [0.05, 0.74, 0.91],
  [0.13, 0.91, 0.52],
  [0.93, 0.87, 0.06],
  [0.97, 0.05, 0.21],
];

/** The muted rainbow-rare stops (--r-clr-1..7), noticeably darker. */
export const RAINBOW_MUTED: Array<[number, number, number]> = [
  [0.58, 0.25, 0.25],
  [0.6, 0.47, 0.29],
  [0.4, 0.56, 0.22],
  [0.22, 0.56, 0.56],
  [0.25, 0.4, 0.61],
  [0.44, 0.22, 0.6],
];

/** A neutral pointer glare used by most chase effects. */
export const GLARE_STOPS = [
  { at: 0, color: [1, 1, 1] as [number, number, number] },
  { at: 1, color: [0.06, 0.06, 0.08] as [number, number, number] },
];
```

- [ ] **Step 1: Write the six effects**

`rainbow-holo.ts` — muted rainbow crossed with glitter, `color-dodge` on top:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, RAINBOW_MUTED } from './palette';

export const rainbowHolo: Effect = {
  id: 'rainbow-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'linear', angleDeg: -45, stops: RAINBOW_MUTED },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0.25, fromLeft: 0.5 }, y: { base: 0.25, fromTop: 0.5 } },
        },
        { source: { kind: 'glitter', scale: 4 }, blend: 'soft-light' },
        {
          source: { kind: 'linear', angleDeg: -30, stops: RAINBOW_MUTED },
          blend: 'luminosity',
          size: [4, 4],
          offset: { x: { base: 0.25, fromLeft: 0.5 }, y: { base: 0.25, fromTop: 0.5 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 2.2 },
        saturate: { base: 0.75 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      filter: { brightness: { base: 0.9 }, contrast: { base: 1.75 } },
      mixBlend: 'hard-light',
      opacity: { base: 0.1, fromCenter: 0.9 },
    },
  ],
};
```

`rainbow-alt.ts` — brighter, tighter bands:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const rainbowAlt: Effect = {
  id: 'rainbow-alt',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: -60, space: 0.035, stops: SUNPILLAR },
          blend: 'normal',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.9 }, y: { base: 0, fromTop: 0.9 } },
        },
        { source: { kind: 'glitter', scale: 5 }, blend: 'soft-light' },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.3 },
        contrast: { base: 2 },
        saturate: { base: 1.3 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'hard-light',
      opacity: { base: 0.15, fromCenter: 0.7 },
    },
  ],
};
```

`secret-rare.ts` — two offset glitter layers over a conic gold sweep, the reference's signature:

```ts
import type { Effect } from '../shader/types';
import { SUNPILLAR } from './palette';

export const secretRare: Effect = {
  id: 'secret-rare',
  shine: [
    {
      layers: [
        {
          source: { kind: 'glitter', scale: 4 },
          blend: 'normal',
          offset: { x: { base: 0.45 }, y: { base: 0.45 } },
        },
        {
          source: { kind: 'glitter', scale: 4 },
          blend: 'hard-light',
          offset: { x: { base: 0.55 }, y: { base: 0.55 } },
        },
        { source: { kind: 'conic', stops: SUNPILLAR }, blend: 'overlay' },
      ],
      filter: {
        brightness: { base: 0.4, fromCenter: 0.2 },
        contrast: { base: 1 },
        saturate: { base: 2.7 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.55, fromCenter: 0.35 },
    },
    {
      layers: [
        {
          source: {
            kind: 'linear',
            angleDeg: 45,
            stops: [
              [0.98, 0.76, 0.03],
              [1, 0.9, 0.42],
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 1.25 }, contrast: { base: 1.25 }, saturate: { base: 0.35 } },
      mixBlend: 'lighten',
      opacity: { base: 0.35, fromCenter: 0.25 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [0.82, 0.8, 0.76] },
              { at: 1, color: [0.13, 0.11, 0.09] },
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 1.3 }, contrast: { base: 1.5 } },
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
```

`swsh-pikachu.ts` — a secret-rare variant pushed toward yellow:

```ts
import type { Effect } from '../shader/types';

export const swshPikachu: Effect = {
  id: 'swsh-pikachu',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 5 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 120,
            space: 0.04,
            stops: [
              [1, 0.85, 0.1],
              [1, 0.62, 0.05],
              [1, 0.93, 0.55],
            ],
          },
          blend: 'multiply',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.8 }, y: { base: 0, fromTop: 0.8 } },
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.6 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 0.98, 0.85] },
              { at: 1, color: [0.1, 0.08, 0.02] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.7 },
    },
  ],
};
```

`amazing-rare.ts` — saturated bands, `lighten` and `saturation` blends:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const amazingRare: Effect = {
  id: 'amazing-rare',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 0, space: 0.03, stops: SUNPILLAR },
          blend: 'normal',
          size: [1, 6],
          offset: { x: { base: 0 }, y: { base: 0, fromTop: 1 } },
        },
        { source: { kind: 'grain', scale: 2 }, blend: 'saturation' },
      ],
      filter: {
        brightness: { base: 0.7, fromCenter: 0.3 },
        contrast: { base: 1.6 },
        saturate: { base: 1.8 },
      },
      mixBlend: 'lighten',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'overlay',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
```

`radiant-holo.ts` — hard diagonal shards, clipped to the border:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const radiantHolo: Effect = {
  id: 'radiant-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 45, space: 0.02, stops: SUNPILLAR },
          blend: 'normal',
          size: [5, 5],
          offset: { x: { base: 0, fromLeft: 1.2 }, y: { base: 0, fromTop: 1.2 } },
        },
        {
          source: { kind: 'repeating-linear', angleDeg: -45, space: 0.03, stops: SUNPILLAR },
          blend: 'hard-light',
          size: [5, 5],
          offset: { x: { base: 0, fromLeft: -1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.35 },
        contrast: { base: 2.4 },
        saturate: { base: 1.5 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      filter: { brightness: { base: 1 }, contrast: { base: 1.6 } },
      mixBlend: 'overlay',
      opacity: { base: 0.22, fromCenter: 0.6 },
    },
  ],
};
```

- [ ] **Step 2: Register them**

Add all six to `effects/index.ts`'s imports and to the `EFFECTS` object, keyed by their kebab-case ids.

- [ ] **Step 3: Run the tests**

```bash
pnpm vitest run apps/holodex/src/holo
```

Expected: the coverage test still fails, but now lists 12 missing effects rather than 18. Every other assertion — including "compiles every effect to balanced shader source", which now compiles ten effects — passes.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm --filter @ncam/holodex typecheck && pnpm lint
git add apps/holodex/src/holo/effects
git commit -m "feat(holodex): the chase foils

rainbow-holo, rainbow-alt, secret-rare, swsh-pikachu, amazing-rare and
radiant-holo, with the reference's sunpillar and muted-rainbow palettes shared
rather than repeated.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The V family

Five effects: `v-regular`, `v-full-art`, `v-max`, `v-star`, `trainer-full-art`.

**Files:** create five files under `apps/holodex/src/holo/effects/`, register them in `index.ts`.

- [ ] **Step 1: Write the five effects**

`v-regular.ts` — restrained, two soft sweeps:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const vRegular: Effect = {
  id: 'v-regular',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.06, stops: SUNPILLAR },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0, fromLeft: 0.8 }, y: { base: 0, fromTop: 0.8 } },
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.1 },
      },
      mixBlend: 'soft-light',
      opacity: { base: 0.5, fromCenter: 0.35 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'hard-light',
      opacity: { base: 0.18, fromCenter: 0.6 },
    },
  ],
};
```

`v-full-art.ts` — `exclusion` over the art, which is what gives full arts their oily sheen:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const vFullArt: Effect = {
  id: 'v-full-art',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.05, stops: SUNPILLAR },
          blend: 'normal',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
        { source: { kind: 'glitter', scale: 6 }, blend: 'overlay' },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 2 },
        saturate: { base: 1.2 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      filter: { brightness: { base: 1 }, contrast: { base: 1.4 } },
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.7 },
    },
  ],
};
```

`v-max.ts` — the widest bands of the family, `lighten` on top:

```ts
import type { Effect } from '../shader/types';
import { SUNPILLAR } from './palette';

export const vMax: Effect = {
  id: 'v-max',
  shine: [
    {
      layers: [
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: -33,
            space: 0.06,
            stops: [
              [0.83, 0.16, 0.13],
              [0.42, 0.48, 0.85],
              [0.24, 0.79, 0.62],
              [0.93, 0.83, 0.26],
            ],
          },
          blend: 'normal',
          size: [6, 6],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
        { source: { kind: 'grain', scale: 3 }, blend: 'soft-light' },
      ],
      filter: {
        brightness: { base: 0.4, fromCenter: 0.4 },
        contrast: { base: 2 },
        saturate: { base: 1 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.35 },
    },
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 0, space: 0.05, stops: SUNPILLAR },
          blend: 'normal',
          size: [2, 7],
          offset: { x: { base: 0 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: { saturate: { base: 1.5 } },
      mixBlend: 'lighten',
      opacity: { base: 0.3, fromCenter: 0.5 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 1, 1] },
              { at: 1, color: [0, 0, 0] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.8 },
    },
  ],
};
```

`v-star.ts` — tighter than VMAX, `exclusion` for the cold metallic look:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const vStar: Effect = {
  id: 'v-star',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: -20, space: 0.035, stops: SUNPILLAR },
          blend: 'normal',
          size: [4, 4],
          offset: { x: { base: 0, fromLeft: 1.1 }, y: { base: 0, fromTop: 1.1 } },
        },
        { source: { kind: 'glitter', scale: 7 }, blend: 'hard-light' },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.35 },
        contrast: { base: 2.1 },
        saturate: { base: 1.2 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.7 },
    },
  ],
};
```

`trainer-full-art.ts` — the quietest of the family; the reference uses `screen` and `multiply` only:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const trainerFullArt: Effect = {
  id: 'trainer-full-art',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.07, stops: SUNPILLAR },
          blend: 'normal',
          size: [2.5, 2.5],
          offset: { x: { base: 0, fromLeft: 0.7 }, y: { base: 0, fromTop: 0.7 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 1.5 },
        saturate: { base: 0.9 },
      },
      mixBlend: 'screen',
      opacity: { base: 0.3, fromCenter: 0.35 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'multiply',
      opacity: { base: 0.15, fromCenter: 0.5 },
    },
  ],
};
```

- [ ] **Step 2: Register, test, typecheck, commit**

Add all five to `effects/index.ts`. Then:

```bash
pnpm vitest run apps/holodex/src/holo
```

Expected: the coverage test now lists 7 missing effects. Everything else passes.

```bash
pnpm --filter @ncam/holodex typecheck && pnpm lint
git add apps/holodex/src/holo/effects
git commit -m "feat(holodex): the v family foils

v-regular, v-full-art, v-max, v-star and trainer-full-art.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Shiny and gallery foils — completing the registry

The last seven: `shiny-rare`, `shiny-v`, `shiny-vmax`, `trainer-gallery-holo`, `trainer-gallery-v-regular`, `trainer-gallery-v-max`, `trainer-gallery-secret-rare`. When this task lands the registry's coverage test goes green and the `as unknown as` cast in `index.ts` comes out.

The shiny family is defined by `exclusion` and `difference` — those two blends are what make a shiny card look like inverted metal rather than rainbow foil.

- [ ] **Step 1: Write the three shiny effects**

`shiny-rare.ts`:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS } from './palette';

export const shinyRare: Effect = {
  id: 'shiny-rare',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 8 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 100,
            space: 0.04,
            stops: [
              [0.75, 0.85, 0.95],
              [0.35, 0.45, 0.6],
              [0.9, 0.92, 0.98],
            ],
          },
          blend: 'difference',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.9 }, y: { base: 0, fromTop: 0.9 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.3 },
        contrast: { base: 1.9 },
        saturate: { base: 0.8 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'overlay',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
```

`shiny-v.ts` — the same idea pushed colder, with `darken` in the stack:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS } from './palette';

export const shinyV: Effect = {
  id: 'shiny-v',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 6 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 140,
            space: 0.05,
            stops: [
              [0.6, 0.78, 0.95],
              [0.22, 0.3, 0.5],
              [0.85, 0.9, 1],
            ],
          },
          blend: 'darken',
          size: [3.5, 3.5],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.62, fromCenter: 0.28 },
        contrast: { base: 2 },
        saturate: { base: 0.9 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'overlay',
      opacity: { base: 0.2, fromCenter: 0.65 },
    },
  ],
};
```

`shiny-vmax.ts` — `hue` in the stack and `lighten` on top, the warmest of the three:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const shinyVmax: Effect = {
  id: 'shiny-vmax',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 7 }, blend: 'normal' },
        {
          source: { kind: 'repeating-linear', angleDeg: 115, space: 0.045, stops: SUNPILLAR },
          blend: 'hue',
          size: [4, 4],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.4 },
      },
      mixBlend: 'lighten',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'overlay',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
```

- [ ] **Step 2: Write the four gallery effects**

All four clip to `borders`, so their foil runs to the card's edge. They are deliberately softer than their non-gallery counterparts — gallery cards have painted art that heavy foil ruins.

`trainer-gallery-holo.ts`:

```ts
import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const trainerGalleryHolo: Effect = {
  id: 'trainer-gallery-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 120, space: 0.06, stops: SUNPILLAR },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0, fromLeft: 0.7 }, y: { base: 0, fromTop: 0.7 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 1.5 },
        saturate: { base: 1 },
      },
      mixBlend: 'hard-light',
      opacity: { base: 0.3, fromCenter: 0.35 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'soft-light',
      opacity: { base: 0.2, fromCenter: 0.5 },
    },
  ],
};
```

`trainer-gallery-v-regular.ts` and `trainer-gallery-v-max.ts` — the reference's own files for these are one rule each, reusing the gallery-holo look with a different intensity. Write them the same way:

```ts
// trainer-gallery-v-regular.ts
import type { Effect } from '../shader/types';
import { trainerGalleryHolo } from './trainer-gallery-holo';

/** The reference gives gallery V cards the gallery holo look, a touch stronger. */
export const trainerGalleryVRegular: Effect = {
  ...trainerGalleryHolo,
  id: 'trainer-gallery-v-regular',
  shine: trainerGalleryHolo.shine.map((el) => ({
    ...el,
    opacity: { base: 0.38, fromCenter: 0.4 },
  })),
};
```

```ts
// trainer-gallery-v-max.ts
import type { Effect } from '../shader/types';
import { trainerGalleryHolo } from './trainer-gallery-holo';

export const trainerGalleryVMax: Effect = {
  ...trainerGalleryHolo,
  id: 'trainer-gallery-v-max',
  shine: trainerGalleryHolo.shine.map((el) => ({
    ...el,
    opacity: { base: 0.45, fromCenter: 0.45 },
  })),
};
```

`trainer-gallery-secret-rare.ts` — gold, like `secret-rare`, but border-clipped and calmer:

```ts
import type { Effect } from '../shader/types';
import { SUNPILLAR } from './palette';

export const trainerGallerySecretRare: Effect = {
  id: 'trainer-gallery-secret-rare',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 5 }, blend: 'normal' },
        { source: { kind: 'conic', stops: SUNPILLAR }, blend: 'soft-light' },
        {
          source: {
            kind: 'linear',
            angleDeg: 45,
            stops: [
              [0.98, 0.76, 0.03],
              [1, 0.9, 0.42],
            ],
          },
          blend: 'hard-light',
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.25 },
        contrast: { base: 1.6 },
        saturate: { base: 1.8 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.4, fromCenter: 0.35 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [0.9, 0.86, 0.75] },
              { at: 1, color: [0.12, 0.1, 0.06] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
```

- [ ] **Step 3: Complete the registry and drop the cast**

`effects/index.ts` now imports all 22 and exports them with an honest type:

```ts
import type { EffectId } from '../select';
import type { Effect } from '../shader/types';
// …22 imports…

export const EFFECTS: Record<EffectId, Effect> = {
  basic,
  'reverse-holo': reverseHolo,
  'regular-holo': regularHolo,
  'cosmos-holo': cosmosHolo,
  'amazing-rare': amazingRare,
  'radiant-holo': radiantHolo,
  'rainbow-holo': rainbowHolo,
  'rainbow-alt': rainbowAlt,
  'secret-rare': secretRare,
  'shiny-rare': shinyRare,
  'shiny-v': shinyV,
  'shiny-vmax': shinyVmax,
  'v-regular': vRegular,
  'v-full-art': vFullArt,
  'v-max': vMax,
  'v-star': vStar,
  'trainer-full-art': trainerFullArt,
  'trainer-gallery-holo': trainerGalleryHolo,
  'trainer-gallery-v-regular': trainerGalleryVRegular,
  'trainer-gallery-v-max': trainerGalleryVMax,
  'trainer-gallery-secret-rare': trainerGallerySecretRare,
  'swsh-pikachu': swshPikachu,
};
```

The `as unknown as Record<EffectId, Effect>` cast from Task 6 must be gone. If TypeScript now complains about a missing key, that is the registry test's point arriving early — add the missing effect rather than restoring the cast.

- [ ] **Step 4: Run the tests — the registry goes green**

```bash
pnpm vitest run apps/holodex/src/holo
```

Expected: PASS, every test including the coverage assertions in both directions and "compiles every effect to balanced shader source" across all 22.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm --filter @ncam/holodex typecheck && pnpm lint
git add apps/holodex/src/holo/effects
git commit -m "feat(holodex): shiny and gallery foils complete the registry

The shiny family leans on exclusion and difference, which is what makes those
cards read as inverted metal rather than rainbow foil. All 22 effects are now
present and the registry's type no longer needs a cast.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Rework the scene

Swap the tier model for the effect model inside `scene.ts`, and feed the shader the uniforms the effects reference.

**Files:**

- Modify: `apps/holodex/src/holo/scene.ts`
- Modify: `apps/holodex/src/holo/textures.ts`
- Delete: `apps/holodex/src/holo/tiers.ts`, `apps/holodex/src/holo/tiers.test.ts`

**Interfaces:**

- Consumes: `getMaterial`, `disposeMaterials` (Task 6); `regionFor`, `SHAPE_ID` (Task 2); `HoloSelection` (Task 1).
- Produces: `HoloScene` with `setCard(url)`, `setSelection(selection)`, `setPointer(x, y)`, `resize(w, h)`, `start()`, `stop()`, `dispose()`. **`setTier` is gone.**

- [ ] **Step 1: Rename the textures**

`textures.ts` currently generates a texture per tier. Replace its export with two named generators, keeping the existing canvas-based approach and the module-level cache:

```ts
export type TextureName = 'glitter' | 'grain';

/** Generated once at runtime, shared by every effect that names them. */
export function makeTexture(name: TextureName): HTMLCanvasElement;
```

`glitter` keeps the existing sparkle generator at 512²; `grain` keeps the existing cosmos generator, renamed, at 1024². The per-tier `rainbow` strip is no longer needed — gradients are computed in the shader now — so delete it.

- [ ] **Step 2: Rework `scene.ts`**

The renderer, camera, geometry, RAF loop, spring and resize all stay exactly as they are. Three things change:

1. `setTier(tier)` becomes `setSelection(selection: HoloSelection)`, which fetches the material from the cache, assigns the shared `uGlitter` / `uGrain` textures and the current card texture onto it, sets `uClipRect` from `regionFor(selection.shape)`, `uClipShape` from `SHAPE_ID`, and `uInvert` from `selection.invert`, then swaps `mesh.material`.
2. The RAF loop updates `uPointer`, `uPointerUV` (the pointer in 0..1 card space), `uPointerFromCenter` (0 at the centre, 1 at a corner) and `uTime` on the **current** material each frame. Because materials are cached and shared, set these on `mesh.material` rather than on a captured reference.
3. `dispose()` frees the card texture and the geometry as before, but **must not** dispose the cached materials — they outlive the scene. Call `disposeMaterials()` only from `HoloCard`'s unmount, not here.

`setCard` keeps its existing behaviour: load the texture, dispose the previous one, assign to `uCard`.

- [ ] **Step 3: Delete the tier model**

```bash
git rm apps/holodex/src/holo/tiers.ts apps/holodex/src/holo/tiers.test.ts
```

Grep for stragglers — `foilTier`, `TIER_BY_RARITY`, `TIER_INTENSITY`, `FoilTier` must appear nowhere:

```bash
grep -rn "foilTier\|TIER_BY_RARITY\|TIER_INTENSITY\|FoilTier\|setTier" apps/holodex/src || echo "clean"
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @ncam/holodex typecheck && pnpm vitest run && pnpm lint && pnpm --filter @ncam/holodex build
```

Expected: typecheck clean, tests pass (the count drops by the 17 tier tests removed and is otherwise unchanged), lint 0, build succeeds with three.js still in its own lazy chunk.

```bash
git add apps/holodex/src/holo
git commit -m "feat(holodex): drive the scene from an effect selection

setSelection replaces setTier: it pulls the compiled material from the cache
and feeds it the clip region, the inversion flag and the shared textures. The
four-tier model and its tests are gone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Wire up HoloCard, and add the pop and showcase

**Files:**

- Modify: `apps/holodex/src/holo/HoloCard.tsx`
- Create: `apps/holodex/src/holo/showcase.ts`
- Test: `apps/holodex/src/holo/showcase.test.ts`

**Interfaces:**

- Consumes: `selectHolo` (Task 1); the reworked scene (Task 10); `disposeMaterials` (Task 6); `supportsHolo`, `browserProbe` (existing).
- Produces: `createShowcase(opts)` — a pure state machine driving the one-shot intro rotation.

The showcase is extracted into its own module precisely so it can be tested: it is the only part of the interaction with real logic, and everything else is a transform.

- [ ] **Step 1: Write the failing showcase test**

Create `apps/holodex/src/holo/showcase.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createShowcase } from './showcase';

describe('createShowcase', () => {
  it('starts inactive until started', () => {
    const s = createShowcase({ durationMs: 1000 });
    expect(s.isActive()).toBe(false);
    expect(s.valueAt(500)).toEqual({ x: 0, y: 0 });
  });

  it('sweeps and returns to centre over its duration', () => {
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    expect(s.isActive()).toBe(true);
    const mid = s.valueAt(250);
    expect(Math.abs(mid.x)).toBeGreaterThan(0.1);
    const end = s.valueAt(1000);
    expect(Math.abs(end.x)).toBeLessThan(0.01);
    expect(Math.abs(end.y)).toBeLessThan(0.01);
  });

  it('finishes once its duration elapses', () => {
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    s.valueAt(1001);
    expect(s.isActive()).toBe(false);
  });

  it('cancels on real pointer input and never replays', () => {
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    s.cancel();
    expect(s.isActive()).toBe(false);
    expect(s.valueAt(250)).toEqual({ x: 0, y: 0 });
    s.start(0);
    expect(s.isActive()).toBe(false);
  });

  it('never starts when it is disabled', () => {
    const s = createShowcase({ durationMs: 1000, enabled: false });
    s.start(0);
    expect(s.isActive()).toBe(false);
  });

  it('stays within the unit range throughout', () => {
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    for (let t = 0; t <= 1000; t += 50) {
      const v = s.valueAt(t);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(v.y)).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run apps/holodex/src/holo/showcase.test.ts
```

Expected: FAIL — cannot resolve `./showcase`.

- [ ] **Step 3: Write the showcase**

Create `apps/holodex/src/holo/showcase.ts`:

```ts
export interface ShowcaseValue {
  x: number;
  y: number;
}

export interface Showcase {
  start: (nowMs: number) => void;
  /** Synthetic pointer position for this moment, or the centre when inactive. */
  valueAt: (nowMs: number) => ShowcaseValue;
  cancel: () => void;
  isActive: () => boolean;
}

export interface ShowcaseOptions {
  durationMs: number;
  /** false under reduced motion; the showcase then never runs. */
  enabled?: boolean;
}

/**
 * The one-shot intro sweep. A pure state machine over a clock the caller
 * supplies, so it can be tested without a browser: `valueAt` is a function of
 * elapsed time, and the only mutable state is whether it is running.
 *
 * It ends where it started, at the centre, so handing control back to the
 * pointer spring is seamless.
 */
export function createShowcase({ durationMs, enabled = true }: ShowcaseOptions): Showcase {
  let startedAt: number | null = null;
  let cancelled = false;

  const isActive = () => startedAt !== null && !cancelled;

  return {
    isActive,
    start(nowMs) {
      if (!enabled || cancelled || startedAt !== null) return;
      startedAt = nowMs;
    },
    cancel() {
      cancelled = true;
      startedAt = null;
    },
    valueAt(nowMs) {
      if (!isActive()) return { x: 0, y: 0 };
      const elapsed = nowMs - (startedAt as number);
      if (elapsed >= durationMs) {
        startedAt = null;
        cancelled = true;
        return { x: 0, y: 0 };
      }
      const t = elapsed / durationMs;
      // One full sweep, eased at both ends so it starts and stops gently.
      const envelope = Math.sin(Math.PI * t);
      return {
        x: Math.sin(t * Math.PI * 2) * envelope,
        y: Math.sin(t * Math.PI * 2 + Math.PI / 3) * envelope * 0.5,
      };
    },
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
pnpm vitest run apps/holodex/src/holo/showcase.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Wire HoloCard**

Three changes to `HoloCard.tsx`, all inside the existing structure — the `<img>` still renders unconditionally, the canvas is still attached in an effect after mount, and the dynamic `import('./scene')` is untouched:

1. Replace the tier call with `const selection = selectHolo(card)`, and the early return's `tier === 'flat'` condition with `selection.effect === 'basic'`. Pass `selection` to `scene.setSelection(selection)` instead of `setTier`.
2. Add the pop. `pointerenter` sets a `popped` ref to true, `pointerleave` sets it false; the RAF loop already springs, so feed the scale through the same spring and apply it as a CSS `transform: scale()` on the wrapper. Keep it modest — around 1.04 — and apply `will-change: transform` only while interacting.
3. Add the showcase. Create it with `createShowcase({ durationMs: 1400, enabled: supportsHolo(browserProbe()) })`, `start()` it once the scene reports ready, feed `valueAt(performance.now())` into `scene.setPointer` while `isActive()`, and `cancel()` it in the existing `pointermove` and `deviceorientation` handlers.

`disposeMaterials()` is called from `HoloCard`'s unmount cleanup — not from `scene.dispose()`, since the cache outlives any one scene.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @ncam/holodex typecheck && pnpm vitest run && pnpm lint && pnpm --filter @ncam/holodex build
```

```bash
git add apps/holodex/src/holo
git commit -m "feat(holodex): select effects per card and add the pop and showcase

The showcase is a pure state machine over an injected clock, so the one part of
the interaction with real logic is testable without a browser. The card pops on
pointer-enter and plays a single intro sweep that cancels on the first real
input.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Documentation, budget, and the CI gate

**Files:**

- Modify: `apps/holodex/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-21-holodex-holo-v2-design.md` (Status line)

Three steps of the original holodex plan are **not** part of this task and must not be attempted: no gallery thumbnail (needs a dev server), no manual walkthrough (same), and **no `git push` and no pull request** — that is the repo owner's decision.

- [ ] **Step 1: Re-measure the bundle**

```bash
pnpm --filter @ncam/holodex build
```

Read the emitted chunk list. Record in `apps/holodex/AGENTS.md`: the gzipped size of the main chunk excluding React, and of the lazy three.js chunk. The budgets are **under 90 KB gz** and **under 170 KB gz**. Before this work they measured ~69 KB and 126.49 KB.

The 22 compiled shaders are strings in the lazy chunk, so expect the lazy chunk to grow by a few KB. **If it now exceeds 170 KB gz, report it — do not fix it.** Trimming effects or moving to CSS is a spec-level decision.

Also confirm three.js is still isolated: nothing outside `holo/` may import `holo/scene`, `holo/shader/*`, `holo/effects/*` or `three` at module scope.

```bash
grep -rn "from './scene'\|from './shader/\|from './effects\|from 'three'" apps/holodex/src --include=*.ts --include=*.tsx | grep -v "src/holo/"
```

Expected: no output, except `HoloCard.tsx`'s `import type { HoloScene } from './scene'`, which is a type-only import and erases at compile time.

- [ ] **Step 2: Update the app guide**

Rewrite the holo section of `apps/holodex/AGENTS.md` to describe what is now there: 22 rarity-keyed effects rather than four tiers; selection by rarity plus layout plus printing variant, with trainer-gallery detected from the card number; the clip regions and why reverse holo inverts its; the effect DSL and the generator; the program cache; and the two measured chunk sizes. Note that the effects are _derived from_ pokemon-cards-css rather than ported, and link the repository.

- [ ] **Step 3: Mark the spec implemented**

Change the spec's `Status:` line to record that it is implemented on this branch, and add a line noting the plan's one deviation: effects are declarative descriptions compiled to GLSL rather than hand-written chunks.

- [ ] **Step 4: Run the full gate**

```bash
pnpm run ci
```

Expected: PASS. Lint, format:check, typecheck, test and build across the workspace.

- [ ] **Step 5: Commit**

```bash
git add apps docs
git commit -m "docs(holodex): holo v2 guide, bundle budgets and spec status

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## What this plan does not verify

Nothing here proves the effects _look_ right. The tests cover selection, regions, the blend formulas, the generator's output and the showcase's timing — everything except the pixels. A smoke pass is required after Task 12, on the cards named in the spec's §9:

| Effect         | Card                                                               |
| -------------- | ------------------------------------------------------------------ |
| `secret-rare`  | `sv06.5-090` (Special illustration rare), `sm115-69` (Secret Rare) |
| `regular-holo` | `hgss4-1`                                                          |
| `reverse-holo` | `swsh3-136` (Uncommon with a reverse printing)                     |
| `basic`        | any Common without a reverse variant                               |

Check especially that the clip regions line up against TCGdex's card images — the percentages come from the reference, which tuned them against pokemontcg.io's. A stage card and a trainer are where a mismatch would show first.

```ts
import { ShaderMaterial, Vector2, Vector4 } from 'three';
import { createLogger } from '@ncam/logger';
import { compileEffect, VERTEX_SHADER } from './shader/compile';
import { EFFECTS } from './effects';
import type { EffectId } from './select';

const log = createLogger({ scope: 'holodex' });

const cache = new Map<EffectId, ShaderMaterial>();

function build(id: EffectId): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: '300 es',
    transparent: true,
    vertexShader: VERTEX_SHADER,
    fragmentShader: compileEffect(EFFECTS[id]),
    uniforms: {
      uCard: { value: null },
      uGlitter: { value: null },
      uGrain: { value: null },
      uPointer: { value: new Vector2(0, 0) },
      uPointerUV: { value: new Vector2(0.5, 0.5) },
      uPointerFromCenter: { value: 0 },
      uTime: { value: 0 },
      uClipRect: { value: new Vector4(0, 0, 0, 0) },
      uClipShape: { value: 0 },
      uInvert: { value: 0 },
      uCardOpacity: { value: 1 },
    },
  });
}

/**
 * One material per effect, compiled on first use and kept for the page's
 * lifetime. A failure falls back to `basic`; if `basic` itself fails the
 * caller drops to the plain image.
 */
export function getMaterial(id: EffectId): ShaderMaterial | null {
  const hit = cache.get(id);
  if (hit) return hit;
  try {
    const material = build(id);
    cache.set(id, material);
    return material;
  } catch (error) {
    log.warn('holo.compile-failed', {
      effect: id,
      error: error instanceof Error ? error.message : String(error),
    });
    if (id === 'basic') return null;
    return getMaterial('basic');
  }
}

/** Frees every cached program. Called when the whole remote unmounts. */
export function disposeMaterials(): void {
  for (const material of cache.values()) material.dispose();
  cache.clear();
}
```

- [ ] **Step 7: Commit**

`EFFECTS` does not exist until Task 7, so typecheck fails here by design. Commit the generator now and the cache with the registry in Task 7:

```bash
git add apps/holodex/src/holo/shader/base.ts apps/holodex/src/holo/shader/compile.ts apps/holodex/src/holo/shader/compile.test.ts
git commit -m "feat(holodex): compile an effect description into a fragment shader

Each effect gets its own program, so every constant is inlined as a literal
rather than plumbed through uniform arrays. The clip coverage applies to the
shine stack and not the glare, matching the reference.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Hold `program-cache.ts` as an uncommitted file until Task 7, or stash it — do not commit a file that does not typecheck.

---
