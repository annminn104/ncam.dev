# Holodex — port the 22 older effects' glares from pokemon-cards-css

**Status:** approved by the repo owner, 2026-09-25 ("Port the glares", basic
included). Branch `feat/holodex-holo-v2`, local commits only. This lifts the
owner's earlier "SV ports only" freeze for the glares, and only the glares.

## Problem

The 22 effects derived from
[simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)
(everything but the eight Scarlet & Violet ports) draw a glare that was
**derived by eye**, and it differs from the reference in three ways:

- **Stacking.** Ours paints every glare over the shine. The reference's
  `.card__glare` has no z-index while `.card__shine` has `z-index: 3`, so the
  glare paints _beneath_ it, as poke-151's was shown to. Verified on
  poke-holo.simey.me, 2026-09-25, with the card's pointer variables pinned
  (two captures of one state differ by 0.00): lifting the glare to z-index 4
  changes every one of the 11 rarities sampled, from 0.4% of the card's pixels
  (cosmos) to 17.8% (radiant).
- **Content.** Each is one hand-picked radial with its own blend, filter and
  opacity, where the reference often has other stops, another blend, and a
  second radial in `:after`. regular-holo's, for one, is a white-to-dark radial
  in `hard-light`; the reference's is base.css's radial and an `:after` radial,
  both `overlay`, under their own filters.
- **Geometry.** Ours uses the DSL's fixed radius; every reference glare is
  `radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y))`,
  whose radius grows as the pointer leaves the middle.

## Decision

Replace each of the 22 glares with a port of its CSS, made with `effects/css.ts`
as the Scarlet & Violet glares were, painted beneath the shine. **The shines stay
as derived**: this is a glare port, not a re-port.

## Design

### What a ported glare is

One `beneath` element per effect (`glare: []`), built from the rules that apply
to the rarity:

- **Layers**, bottom first: `.card__glare`'s own `background-image` (a rarity
  that sets none inherits base.css's radial: white 0.8 at 10%, white 0.65 at 20%,
  black 0.5 at 90%), then, where the rarity gives `:after` content, the
  `:after` radial, with the `:after`'s `mix-blend-mode` as its layer blend.
- **Radials** through `css.ts#radial()`, so they carry CSS's `farthest-corner`
  geometry (`cssBox`); `background-size` / `background-position` become the
  `CssBox` (default `COVER`; a size set with no position sits at CSS's initial
  `0% 0%`, as trainer-full-art's does). Alpha folds toward the neutral of whatever the
  layer is blended by (0.5 grey for overlay, soft-light and hard-light; white
  for multiply and darken; black for screen and lighten), as the SV ports do.
- **Element filter**: `.card__glare`'s `filter` (it applies to the glare and its
  `:after` together, as CSS's does). The `:after`'s own `filter` is baked into
  its stops with `filterRGB`, as `sv-rare-holo.ts` does.
- **Element opacity**: `.card__glare`'s `opacity` `calc()`, as a
  `PointerDriven` (base, `fromCenter`, `fromTop`); `--card-opacity` is the
  shader's own `uCardOpacity`. Every `calc()` in these files is linear in
  those terms, so each converts exactly.
- **Element blend**: `.card__glare`'s `mix-blend-mode`, base.css's `overlay`
  where the rarity sets none.

### Which rules apply

Ours has no masks, so a rarity's `:not(.masked)` rules apply and `.masked` ones
are dropped. Where rules vary by subtype, the rarity's main one is ported (the
Pokémon card's, or for trainer-full-art the supporter's, which is the only one
that file styles). The four trainer-gallery effects take their
`[trainer-gallery="true"]` rules. base.css fills whatever a rarity leaves unset.

| Effect                        | Glare background      | `:after`            | Box          | Blend      |
| ----------------------------- | --------------------- | ------------------- | ------------ | ---------- |
| `basic`                       | base.css              | —                   | cover        | overlay    |
| `regular-holo`                | base.css              | radial, overlay     | cover        | overlay    |
| `reverse-holo`                | own                   | radial, normal      | cover        | overlay    |
| `cosmos-holo`                 | own                   | radial, soft-light  | cover        | overlay    |
| `amazing-rare`                | own (`:not(.masked)`) | — (masked only)     | cover        | multiply   |
| `radiant-holo`                | own                   | —                   | cover        | hard-light |
| `rainbow-holo`                | own                   | —                   | cover        | hard-light |
| `rainbow-alt`                 | own                   | —                   | cover        | overlay    |
| `secret-rare`                 | own                   | —                   | cover        | hard-light |
| `shiny-rare`                  | own                   | —                   | cover        | multiply   |
| `shiny-v`                     | own                   | —                   | 120% × 140%  | darken     |
| `shiny-vmax`                  | own                   | radial, overlay     | cover        | overlay    |
| `swsh-pikachu`                | own                   | —                   | cover        | hard-light |
| `trainer-full-art`            | base.css              | —                   | 170%, at 0 0 | multiply   |
| `trainer-gallery-holo`        | own                   | — (`display: none`) | cover        | soft-light |
| `trainer-gallery-secret-rare` | own                   | —                   | cover        | hard-light |
| `trainer-gallery-v-max`       | own                   | —                   | cover        | overlay    |
| `trainer-gallery-v-regular`   | base.css              | —                   | cover        | overlay    |
| `v-full-art`                  | own                   | —                   | 120% × 150%  | hard-light |
| `v-max`                       | own                   | —                   | cover        | hard-light |
| `v-regular`                   | own                   | —                   | cover        | hard-light |
| `v-star`                      | own                   | —                   | cover        | hard-light |

Filters, opacities and stops are read off each file when it is ported; the
table fixes the shape.

### A layer's own opacity

One `:after` layer fades with the pointer, cosmos-holo's
`calc(1 - var(--pointer-from-top) * .75)`: from opaque at the top of the card
to a quarter at the bottom. (The others are constant: shiny-vmax's is 1, and
reverse-holo's is `--card-opacity`, which is 1 while a card is live.) The DSL
cannot say it: a `Layer` has no opacity. `Layer` gains an optional
`opacity?: PointerDriven`, and `compile.ts` emits
`stack = mix(stack, blended, <opacity>)` for a layer that has one, clamped to
0..1. A layer without one compiles exactly as before, so every effect that
does not use it keeps its compiled source byte for byte.

### Stacking, and what stays

- Every ported glare is in `beneath`; `glare` is empty for all 22.
- The shines are untouched, including the five rarities whose CSS puts
  `.card__shine:before` above `:after` by z-index (radiant, shiny V, shiny,
  VSTAR, and v-full-art's supporter) — that belongs to a shine re-port.

### Approximations (each file lists its own, as the ports do)

- The `:after` clip to the art window on stage, supporter and item cards
  (`--clip-stage`, `--clip-trainer`, and reverse-holo's `-invert` pair) is not
  applied: an element's clip cannot depend on the card's type.
- Masked-only rules are dropped.
- A subtype's own variant of a rarity's glare, where the file has one, is not
  ported; the main rule stands in.

## Testing

- **`compile.test.ts`**: a layer with `opacity` compiles to the `mix()` above
  (the transpiled GLSL run against hand-computed values, as the file already
  does for clips and radials); a layer without one emits exactly what it did.
- **New `effects/legacy-glares.test.ts`**, one row per effect, each value copied
  by hand from the CSS (never computed with `css.ts`): the element's blend, its
  opacity terms, its filter, the layer blends, the stop positions and alphas
  before folding, the `cssBox` size. Plus, for all 22: `glare` is empty and
  `beneath` holds exactly one element whose radials all carry a `cssBox`.
- The registry tests (element budget, first-layer blend, stop limit, compile)
  hold as they are.

## Verification

- `pnpm vitest run`, `pnpm lint`, `pnpm --filter @ncam/holodex typecheck`,
  Prettier; a fresh build and the three.js split check (2 / 1).
- **Headless, against poke-holo.simey.me on the same art**, before and after,
  for regular-holo, cosmos-holo, radiant-holo, v-regular, secret-rare and
  shiny-v: the reference with its pointer variables pinned, ours at the same
  pointer, the difference measured by region. The expectation is that it drops;
  where it does not, the port is examined before it is accepted.
- **GPU smoke** on the dev server: every one of the 22 sections' first card
  live on `/effects`, a canvas each and no `holo.compile-failed`.

## Docs

`apps/holodex/AGENTS.md`: the "Two families of effects" paragraph (glares are
now ported in both families; shines of the 22 stay derived), the "Glare stacks
by z-index" paragraph (true of all 30), and the DSL paragraph (a layer's
opacity).

## Out of scope

- Re-porting the 22 shines, their pseudo-element order included.
- Masks.
- Any change to the eight Scarlet & Violet ports.
