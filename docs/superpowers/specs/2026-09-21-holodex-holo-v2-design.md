# Holodex holo effects v2 — rarity-keyed, derived from pokemon-cards-css

Date: 2026-09-21
Status: implemented on branch `feat/holodex-holo-v2` (not merged, not pushed,
not reviewed). One deviation from §5.1's sketch: effects are declarative
descriptions (`holo/shader/types.ts#Effect`) compiled to GLSL by
`holo/shader/compile.ts#compileEffect`, rather than hand-written GLSL chunks
per effect.
Scope: replaces the four-tier foil model in `apps/holodex/src/holo/` with 22
rarity-specific effects derived from
[simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css),
adds card-region clipping, and adds the reference's pop/showcase interaction.
Supersedes §6.2 and §6.3 of `2026-09-21-holodex-design.md`.

## 1. Summary

Today every card gets one of four generic foils (`flat`, `sparkle`, `rainbow`,
`cosmos`) chosen by rarity, painted over the whole card and masked by the art's
own luminance. The reference instead gives each rarity its own look, confines
the foil to the card's art window, and inverts that window for reverse holos.
This spec adopts that model on the existing WebGL renderer.

### Goals

- Each of TCGdex's 42 rarities resolves to one of 22 named effects, mapped
  explicitly and asserted in both directions.
- The foil is confined to a clip region derived from the card's layout, and
  inverted for reverse-holo printings.
- Each effect is one file: its GLSL chunk and its parameters together, so
  editing `cosmos` cannot change `radiant`.
- The card pops forward on pointer-enter, springs back on leave, and plays a
  one-shot showcase rotation on first mount.
- The lazy-chunk boundary, the SSR `<img>`-first contract, context-loss
  handling and the RAF pause all keep working exactly as they do now.

### Non-goals

- Replacing WebGL with the reference's CSS technique. Considered and declined;
  the owner chose to keep the shader.
- Pixel-faithful reproduction. GLSL gradients are a different medium from CSS
  blend modes — these are derived from the reference, not ports of it.
- Per-card foil/mask images. The reference supports them optionally; TCGdex
  ships none, and that decision stands from the v1 spec.
- WebGL on grid tiles. 24 live contexts remains impossible; tiles keep the CSS
  tilt.
- Click-to-focus overlay. The owner chose pop/showcase, not full interaction
  parity.

## 2. Decisions

| Decision         | Choice                               | Why                                                                                     |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| Renderer         | Keep WebGL                           | Owner's choice over porting to CSS. Reuses the reviewed scene, lifecycle and fallbacks. |
| Effect count     | Full 22-effect parity                | Owner's choice over ~12 consolidated looks.                                             |
| Masking          | Region clipping, reference-derived   | Owner's choice. Also fixes the washed-out cosmos card observed in the v1 smoke pass.    |
| Interaction      | Add pop + showcase                   | Owner's choice; stops short of the focus overlay.                                       |
| Shader structure | Composed chunks, one file per effect | Owner's choice. Isolation per effect; lazy compile.                                     |

### Accepted cost

Twenty-two effects is a large amount of _visual_ tuning with no automated
check. Nothing in the test suite can assert "this looks like a rainbow rare" —
only the selection logic and the region rule are testable. Expect iteration by
eye, and expect the first view of each effect to pay a shader compile.

## 3. What the reference actually does

Captured from the repository on 2026-09-21, so the design argues from fact
rather than memory.

- Effects are chosen by **pure CSS attribute selectors** on
  `data-rarity` and `data-subtypes`, e.g.
  `.card[data-rarity="rare holo"][data-subtypes^="stage"]`.
- Each effect paints two stacked overlays — `.card__shine` and `.card__glare` —
  with layered `background-image` (repeating gradients, scanlines, a shared
  `glitter.png` and `grain.webp`) composited using **13 distinct CSS blend
  modes**: `color-dodge`, `hard-light`, `soft-light`, `overlay`, `multiply`,
  `screen`, `lighten`, `darken`, `exclusion`, `difference`, `hue`,
  `saturation`, `luminosity`.
- Clip regions are CSS custom properties:
  `--clip: inset(9.85% 8% 52.85% 8%)`,
  `--clip-trainer: inset(14.5% 8.5% 48.2% 8.5%)`,
  `--clip-stage` (a stepped polygon following the art window of an evolution
  card), `--clip-borders: inset(2.8% 4% round 2.55% / 1.5%)`, plus `-invert`
  variants used exclusively by `reverse-holo`.
- Per-card `foil` and `mask` image URLs are **optional**. When absent — which is
  our case always — each rarity still renders its generic effect.
- Trainer-gallery cards are detected from the card number matching `^[tg]g`,
  not from any rarity field.

## 4. Effect selection

### 4.1 `holo/select.ts` (new, pure, fully tested)

```ts
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

export type ClipShape = 'regular' | 'stage' | 'trainer' | 'borders' | 'full';

export interface HoloSelection {
  effect: EffectId;
  shape: ClipShape;
  /** reverse-holo inverts its clip: foil everywhere EXCEPT the region. */
  invert: boolean;
}

export function selectHolo(card: Card): HoloSelection;
```

Inputs available from TCGdex and verified present: `rarity`, `category`
(`Pokemon` | `Trainer` | `Energy`), `stage` (`Basic` | `Stage1` | `Stage2` |
`VMAX`), `suffix` (`ex` | `GX` | `TAG TEAM-GX` | `V` | `VSTAR` | …),
`trainerType` (`Supporter` | `Item` | `Stadium` | …), `localId`, and
`variants.reverse` / `variants.holo`.

### 4.2 Rarity → effect table

All 42 rarities. `TIER_BY_RARITY` and `tiers.ts` are deleted; this replaces
them, and gets the same two-directional coverage test.

| Effect                 | TCGdex rarities                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `basic`                | Common, Uncommon, None, One Diamond, Two Diamond, Three Diamond, Four Diamond, Rare, Promo, One Star |
| `regular-holo`         | Holo Rare, Rare Holo, Rare Holo LV.X, Rare PRIME, LEGEND                                             |
| `cosmos-holo`          | Classic Collection, Black White Rare                                                                 |
| `amazing-rare`         | Amazing Rare                                                                                         |
| `radiant-holo`         | Radiant Rare                                                                                         |
| `rainbow-holo`         | Hyper rare, Mega Hyper Rare, Crown                                                                   |
| `rainbow-alt`          | Futuristic Rare, Three Star                                                                          |
| `secret-rare`          | Secret Rare, ACE SPEC Rare, Special illustration rare                                                |
| `shiny-rare`           | Shiny rare, One Shiny, Two Shiny                                                                     |
| `shiny-v`              | Shiny rare V, Shiny Ultra Rare                                                                       |
| `shiny-vmax`           | Shiny rare VMAX                                                                                      |
| `v-regular`            | Holo Rare V                                                                                          |
| `v-full-art`           | Ultra Rare, Double rare, Two Star                                                                    |
| `v-max`                | Holo Rare VMAX                                                                                       |
| `v-star`               | Holo Rare VSTAR                                                                                      |
| `trainer-full-art`     | Full Art Trainer                                                                                     |
| `trainer-gallery-holo` | Illustration rare                                                                                    |
| `swsh-pikachu`         | Pikachu Rare                                                                                         |

The table above assigns exactly 42 rarities and names 18 of the 22 effects. The
remaining four — `reverse-holo`, `trainer-gallery-v-regular`,
`trainer-gallery-v-max` and `trainer-gallery-secret-rare` — are reachable only
through the overrides in §4.3 and must never appear in the rarity table. The
coverage test asserts that explicitly in both directions: every rarity has an
entry, every table value is a real `EffectId`, and the set of effects absent
from the table is exactly those four.

`cosmos-holo` deserves a note: the reference keys it on a `rare holo cosmos`
rarity that TCGdex does not have, because cosmos is a foil _pattern_, not a
rarity. Classic Collection (the Celebrations reprints) genuinely uses cosmos
foil, so it takes that effect; everything else that would have been cosmos
falls to `regular-holo`.

### 4.3 Overrides, applied in order

1. **Trainer gallery.** `localId` matching `/^[tg]g/i` overrides the table:
   `Holo Rare V` → `trainer-gallery-v-regular`, `Holo Rare VMAX` →
   `trainer-gallery-v-max`, `Secret Rare` → `trainer-gallery-secret-rare`,
   anything else → `trainer-gallery-holo`.
2. **Reverse holo.** `variants.reverse === true` on a card whose table effect is
   `basic` or `regular-holo` yields `reverse-holo` with `invert: true`.
3. **Unknown rarity** → `basic`. Not silently: the coverage test fails if a
   rarity in `CARD_RARITIES` has no table entry, so an unmapped rarity is a
   failing test rather than a dull card.

### 4.4 Clip shape rule

| Condition                                             | Shape |
| ----------------------------------------------------- | ----- |
| Evaluated top to bottom; the first matching row wins. |

| Condition                                                                                                                                                                   | Shape     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| effect is `radiant-holo` or any `trainer-gallery-*`                                                                                                                         | `borders` |
| rarity is `Full Art Trainer`                                                                                                                                                | `full`    |
| effect is one of the full-art family — `v-full-art`, `secret-rare`, `rainbow-holo`, `rainbow-alt`, `shiny-rare`, `shiny-v`, `shiny-vmax`, `v-max`, `v-star`, `swsh-pikachu` | `full`    |
| `category === 'Trainer'`                                                                                                                                                    | `trainer` |
| `stage` is `Stage1` or `Stage2`                                                                                                                                             | `stage`   |
| otherwise                                                                                                                                                                   | `regular` |

The two leading rows matter: the reference clips `radiant-holo` and
`trainer-gallery-holo` to `--clip-borders`, not to the art window, so those must
be decided before the full-art and trainer rules can claim them.

## 5. Shader architecture

### 5.1 Files

```
holo/
  select.ts            rarity/layout -> { effect, shape, invert }   (tested)
  regions.ts           ClipShape -> inset vec4 + shape id           (tested)
  shader/
    base.ts            vertex + fragment scaffold, uniforms, clip fn
    blend.ts           the 13 blend-mode functions as GLSL source
    noise.ts           shared value-noise / glitter helpers
  effects/
    basic.ts  reverse-holo.ts  regular-holo.ts  …  (22 files)
  program-cache.ts     assemble base+chunk, compile once per effect
  scene.ts             gains setEffect(selection); loses setTier
  HoloCard.tsx         unchanged contract; calls selectHolo(card)
```

`tiers.ts`, `tiers.test.ts` and the tier logic in `textures.ts` are removed.
`capability.ts` is unchanged and still gates everything.

### 5.2 Each effect file

```ts
export const cosmosHolo: Effect = {
  id: 'cosmos-holo',
  /** GLSL appended to the base; must define vec3 effectColor(vec2 uv, Ctx ctx). */
  chunk: /* glsl */ `…`,
  params: { intensity: 1.0, glareStrength: 0.9, scale: 1.4 /* … */ },
  textures: ['glitter', 'grain'],
};
```

Textures stay procedurally generated (v1 §6.3) — `glitter` and `grain` are
generated once into a canvas and shared by every effect that names them.

### 5.3 Blend modes

`blend.ts` provides each CSS blend mode the reference uses as a GLSL function
over two `vec3`s: `colorDodge`, `hardLight`, `softLight`, `overlay`, `multiply`,
`screen`, `lighten`, `darken`, `exclusion`, `difference`, plus the three
non-separable HSL modes `hue`, `saturation`, `luminosity`, which need the
standard `setLum`/`setSat` helpers from the compositing spec. These are exact
formulas, not approximations, and they are what make a derived effect resemble
its source.

### 5.4 Clipping

`regions.ts` maps a `ClipShape` to an inset `vec4` in UV space plus a shape id.
The fragment shader computes coverage from that, and `invert` flips it. The
`stage` shape's stepped outline is computed arithmetically from two insets
rather than carried as polygon data. `borders` uses a rounded inset.

### 5.5 Program cache

`program-cache.ts` assembles `base + blend + noise + effect.chunk`, compiles a
`ShaderMaterial` per effect id, and caches it at module scope for the page's
lifetime. `scene.ts` swaps materials on `setEffect`, keeping one renderer, one
geometry and one mesh. A compile failure logs and falls back to `basic`; if
`basic` itself fails, `HoloCard` drops to the plain image.

## 6. Interaction

`HoloCard` gains, all on the wrapper's transform rather than in the shader, so
the host's stage layout and z-index are untouched:

- **Pop.** `pointerenter` scales the card forward and lifts it; `pointerleave`
  springs it back. The existing spring already damps the tilt — the same spring
  drives the scale.
- **Showcase.** On first mount the card plays one slow rotation, cancelled
  immediately by the first real pointer or orientation input, and never
  replayed.
- Both are skipped entirely when `capability.ts` reports reduced motion, which
  it already detects.

## 7. Failure behaviour

Unchanged from v1 except where noted: no WebGL or reduced motion → plain image,
chunk never loaded; context lost → `preventDefault`, fall back to the image,
rebuild on restore; off-screen or hidden tab → RAF paused; a card with no image
→ placeholder, no GL. New: an effect whose program fails to compile falls back
to `basic` and logs once.

## 8. Testing

Under `environment: 'node'`, no jsdom, same as the rest of the app.

- `select.ts`: every one of the 42 rarities resolves; every table key is a real
  rarity; the trainer-gallery override for each of its four cases; the
  reverse-holo override and that it does not downgrade a chase rarity; unknown
  rarity → `basic`.
- `regions.ts`: each `ClipShape` yields its documented inset; `invert` flips
  coverage; the shape rule's precedence, including a Full Art Trainer taking
  `full` rather than `trainer`.
- `program-cache.ts`: keying by effect id, one compile per id, fallback on
  failure.
- Not testable: the GLSL itself, the blend formulas' visual result, and the
  interaction. Verified by eye in a smoke pass.

## 9. Risks

1. **Visual fidelity is unverifiable by test.** "Looks like the reference" is a
   judgement call; budget for iteration and review the chase rarities by eye —
   `sv06.5-090` (Special illustration rare), `sm115-69` (Secret Rare),
   `hgss4-1` (Holo Rare), `swsh3-136` (Uncommon, reverse available).
2. **Twenty-two effects is a lot of surface** for something with no automated
   visual check. The one-file-per-effect structure limits blast radius, but the
   volume is real.
3. **First view of each effect pays a compile.** Roughly three to five per
   session in practice; a stutter, not a stall.
4. **The clip percentages are the reference's**, tuned against pokemontcg.io's
   card images. TCGdex's images are the same physical cards at a different
   resolution, so they should line up — but this needs checking by eye on a
   stage card and a trainer, where the regions differ most.
5. **Bundle.** Effect chunks are short strings and three.js is already present,
   so the 170 KB gz lazy-chunk budget should hold. Task 18's measurement is
   re-run to prove it rather than assumed.

## 10. Follow-ups (not in this spec)

- Porting the effects to CSS and dropping three.js entirely (~126 KB gz) — the
  option declined here; worth revisiting if the shader proves hard to tune.
- Per-card foil and mask images, if a source for them ever exists.
- The reference's click-to-focus overlay.
