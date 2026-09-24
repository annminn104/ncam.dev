# Holodex — Scarlet & Violet effects from the 151 reference

**Goal:** make holodex's Scarlet & Violet (and Mega, and Pokémon Pocket) cards look like simey's
[poke-151 demo](https://poke-151.simey.me/) by porting its dedicated SV effects, instead of
rendering every SV card with a Sword & Shield stand-in.

**Decided by the repo owner (2026-09-24):** port the reference's _recipes_ — gradients, blend modes,
textures — **without** per-card masks. See "The ceiling" below.

Branch `feat/holodex-holo-v2`. Local commits only; **never push**.

## Why

`simeydotme/pokemon-cards-css`, which v2's 22 effects were derived from, only defines Sword & Shield
rarities. Every SV mapping in `EFFECT_BY_RARITY` was therefore invented. The author's separate
`simeydotme/pokemon-cards-151` repo _does_ define SV effects. Its CSS selectors give the
authoritative mapping:

| `data-rarity`                                                                                  | 151 effect                                             | holodex today          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------- |
| `rare holo` — and every SV `Rare` (`CardProxy`: `if (rarity === "Rare") rarity = "Rare Holo"`) | `regular-holo`                                         | `basic`, unfoiled      |
| `double rare`                                                                                  | `ex-regular`                                           | `v-regular`            |
| `ultra rare`                                                                                   | `ex-full-art`                                          | `v-full-art`           |
| `illustration rare`                                                                            | `illustration-rare`                                    | `trainer-gallery-holo` |
| `special illustration rare`                                                                    | `ex-special-illustration-rare`                         | `secret-rare`          |
| `hyper rare`                                                                                   | `hyper-rare`                                           | `rainbow-holo`         |
| reverse                                                                                        | `poke-ball-holo`, `masterball holo` for 8 card numbers | `reverse-holo`         |

Verified against TCGdex: `Hyper rare` is 100% SV and is the **gold** tier (visible in the demo);
`Special illustration rare` and `Illustration rare` are SV + Mega full-bleed art, not gold.

## The ceiling — stated so nobody chases it

The reference's `ex-regular`, `ex-full-art`, `ex-special-illustration-rare`, `hyper-rare`,
`poke-ball-holo` and `reverse-holo` all use `var(--mask)` / `var(--foil)`: **per-card** images marking
exactly which parts of that printed card are foil. That is most of the demo's realism — foil follows
the Pokémon's outline. We have no masks: they live on the author's CDN, derive from copyrighted scans,
and cover only sets he processed, keyed to pokemontcg.io numbering. Our foil covers a geometric
region instead. `illustration-rare` needs no mask and ports exactly; the others match colour and
character but not contour.

## Porting rules — CSS to our DSL (`holo/shader/types.ts`)

The reference CSS is saved verbatim for reading at
`/private/tmp/claude-502/-Users-mason-nguyencaominhanh-Mason-Workspace-ncam/e0870a3b-c2b4-4b99-bf0a-f22db85c397f/scratchpad/ref151/*.css`.
Read the file for each effect you port. Map it the same way v2's 22 effects were mapped:

| CSS                                                                | DSL                                                                                                               |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `.card__shine`, `::before`, `::after`                              | `shine[]` elements (≤ 3 — the registry test enforces it)                                                          |
| `.card__glare`, `.card__glare2`                                    | `glare[]` elements (≤ 2)                                                                                          |
| each entry in `background-image`                                   | a `Layer`, bottom-most first                                                                                      |
| `background-blend-mode` list                                       | each layer's `blend` — **layer 0's is always `'normal'`** (the generator drops it; a registry test enforces this) |
| `mix-blend-mode`                                                   | the element's `mixBlend`                                                                                          |
| `filter: brightness() contrast() saturate()`                       | the element's `filter`                                                                                            |
| `opacity: calc(... var(--pointer-from-center))`                    | a `PointerDriven` opacity                                                                                         |
| `background-size` / `background-position` with `--background-x/y`  | a layer's `size` / `PointerDriven` `offset`                                                                       |
| `clip-path`                                                        | the card's `ClipShape`, chosen in `select.ts` — not part of the `Effect`                                          |
| `var(--grain)`, `var(--noise)`, `var(--noise-over)`                | `grain`                                                                                                           |
| `var(--glitter)`                                                   | `glitter`                                                                                                         |
| `var(--iri1..9)`                                                   | the new `iri` source (Task 1)                                                                                     |
| `var(--birthday-dank)`, `var(--birthday-dank2)`, `var(--birthday)` | the new `birthday` source (Task 1)                                                                                |
| `var(--mask)`                                                      | **drop the layer** — our geometric clip stands in                                                                 |
| `var(--foil)`                                                      | replace with `iri` (a coloured speckle is the closest procedural stand-in) and say so in a comment                |
| `hsl()` / hex colours                                              | linear-ish RGB triples in 0..1, as the existing effect files do                                                   |

When a CSS layer has no faithful DSL equivalent, pick the closest and **write a one-line comment
naming what the reference does and what you did instead**. A future reader must be able to tell a
deliberate approximation from a porting mistake.

## Tasks

### Task 1 — Foundations: two blend modes, two textures

- **`plus-lighter`**: `min(1, src + dst)` per channel. **`color-burn`**: W3C —
  `dst == 1 ? 1 : src == 0 ? 0 : 1 - min(1, (1 - dst) / src)`. Add both to `shader/blend.ts` as GLSL
  plus TypeScript twins, extend `BLEND_ID`, and test each twin against hand-computed values the way
  the existing blend tests do. Mutation-test: swap an operand, drop the clamp.
- **`iri` texture**: a fine coloured speckle — random dots on near-black, hues biased to violet / blue
  / white. The reference's `iri-8` is 300×300 of exactly this. Generate it in `textures.ts` like the
  existing `sparkle()`, deterministically seeded so it is identical every load.
- **`pokeball`, `pokeball-inner`, `masterball` textures** — added after dispatch. The reference's
  Poké Ball reverse uses three _shared_ pattern images as masks (`--pokeball`, `--pokeball-inner`,
  `--masterball`): dark Poké Ball outline glyphs on light grey, two sizes, staggered, tiling. Unlike
  per-card masks these are identical on every card, so they are generated. Task 2 layers them over the
  gradient with `multiply` to stand in for masking.
- **`birthday` texture**: multicoloured **four-pointed star** sparkles of varied size on black — the
  reference's `birthday-holo-dank` is 1140×2026 of rainbow-hued stars. Draw star shapes (two crossed
  thin diamonds) at random positions, sizes and hues, seeded.
- Add `iri` and `birthday` to `TextureName`, add matching `Source` kinds (`{ kind: 'iri'; scale }`,
  `{ kind: 'birthday'; scale }`), GLSL samplers in `sources.ts`, uniforms in `program-cache.ts`, and
  wiring in `scene.ts`'s shared textures with `orientTexture`. The uniform-contract test derives
  expected uniforms from the generated source, so it will catch a missed uniform — make sure it does.
- **Seeded randomness matters**: `textures.ts` currently uses `Math.random()`. For the two new
  textures use a small seeded PRNG, so a card never looks different on reload. Do not change the
  existing two unless you have to.

### Task 2 — Port the seven effects

`ex-regular`, `ex-full-art`, `illustration-rare`, `ex-special-illustration-rare`, `hyper-rare`,
`poke-ball-holo`, `masterball-holo` — one file each under `holo/effects/`, following the porting
rules above, registered in `effects/index.ts`. Add the seven ids to the `EffectId` union.

`masterball-holo` is the reference's `masterball holo` variant of `poke-ball-holo.css` (same file,
different selector) — port its distinct values.

The registry tests (coverage, element budget, first-layer blend, stop limit, compile) must all pass
for the new effects. Adding ids to the union without a selection path would fail the registry's
"reachable" coverage — so Task 2 and Task 3 land in one commit, or Task 2 adds the ids to
`OVERRIDE_ONLY_EFFECTS` temporarily. Prefer landing them together.

### Task 3 — Era-aware selection

Card-set era, derived from the set id (strip `-${localId}` from `card.id`, exactly as
`lib/images.ts#cardImageBase` does — set ids contain hyphens):

- **SV**: `/^sv(\d|p$)/i` — `sv01`…`sv10.5w` and `svp` (SV promos). Must **not** match `swsh4.5sv`
  or McDonald's `2023sv`; anchoring at the start guarantees that.
- **Mega**: `/^me(\d|p$)/i` — `me01`… and `mep`.
- "Modern" = SV or Mega. They share one rarity system.

Mapping changes (everything not listed keeps its current effect):

| Rarity                              | Condition        | New effect                                                                                                            |
| ----------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Double rare`                       | — (SV/Mega only) | `ex-regular`                                                                                                          |
| `Ultra Rare`                        | modern           | `ex-full-art`                                                                                                         |
| `Ultra Rare`                        | older            | `v-full-art` (unchanged)                                                                                              |
| `Illustration rare`                 | —                | `illustration-rare`                                                                                                   |
| `Special illustration rare`         | —                | `ex-special-illustration-rare`                                                                                        |
| `Hyper rare`, `Mega Hyper Rare`     | —                | `hyper-rare`                                                                                                          |
| `Rare`                              | modern           | `regular-holo` (the reference promotes SV `Rare` to `Rare Holo`)                                                      |
| `Rare`                              | older            | `basic` (unchanged — non-holo rare)                                                                                   |
| `ACE SPEC Rare`                     | —                | `rainbow-holo` — SV prism foil, not gold; and it keeps `rainbow-holo` reachable once the three gold rarities leave it |
| `Promo` + `suffix`                  | modern           | `ex-regular`                                                                                                          |
| `Promo` + `suffix`                  | older            | `v-regular` (unchanged)                                                                                               |
| **Pocket** `Four Diamond` (ex)      | —                | `ex-regular`                                                                                                          |
| **Pocket** `One Star`               | —                | `illustration-rare`                                                                                                   |
| **Pocket** `Two Star` (full-art ex) | —                | `ex-full-art`                                                                                                         |
| **Pocket** `Crown` (gold)           | —                | `hyper-rare`                                                                                                          |
| **Pocket** `Three Diamond`          | —                | `regular-holo`                                                                                                        |
| **Pocket** `Two Shiny` (shiny ex)   | —                | `shiny-v`                                                                                                             |

**Clip regions for the new effects — read this before touching `clipShape()`.** Where the reference
confines foil with `mask-image: var(--mask)` instead of a `clip-path`, dropping the mask (as the
porting rules say) removes the _only_ thing confining it — and the foil spreads edge to edge. So
our geometric clip must stand in for the mask, per effect:

| Effect                              | Reference confines with                | Our `ClipShape`                                              |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `ex-regular`                        | **mask only, no `clip-path`**          | `regular` / `stage` / `trainer` by category — **not** `full` |
| `ex-full-art`                       | `--mask: none`                         | `full`                                                       |
| `ex-special-illustration-rare`      | mask (full-art card)                   | `full`                                                       |
| `hyper-rare`                        | mask (full-art card)                   | `full`                                                       |
| `illustration-rare`                 | `clip-path` — the border polygon       | `borders`                                                    |
| `poke-ball-holo`, `masterball-holo` | pattern mask + `--clip-borders-invert` | as `reverse-holo`: its region with `invert: true`            |

**`ex-regular` is the one that would silently regress.** It is `Double rare` — the standard-layout ex
whose whole-card foil was fixed in `bc3740c`. Put it in `FULL_ART` and that bug returns. Keep the
existing test asserting a `Double rare` card is not `full`, and confirm it still passes against the
new effect.

Reverse, when `options.reverse` is set on a reversible base:

- `sv03.5` (151) → `poke-ball-holo`, and `masterball-holo` for `localId` 1, 4, 7, 25, 133, 144, 146,
  161 — the reference's fixed list. **Not** its 20% random promotion: a card must render the same
  every time.
- every other set → `reverse-holo` (unchanged). Real SV sets outside 151 have plain reverse holos.

`REVERSIBLE` gains `regular-holo`'s new modern members automatically, since it keys on the effect.

**Pocket `Three Star` deliberately stays on `rainbow-alt`.** It is Pocket's top art tier and would fit
`ex-special-illustration-rare`, but moving it would leave `rainbow-alt` with only `Futuristic Rare` —
which has **2 cards in all of TCGdex** (controller-verified), too few even to fill a showcase section.
`ex-special-illustration-rare` is well served by SV and Mega SIRs (~120 cards) without it.

**Reachability — every one of the 29 effects must stay selectable**, and the registry test enforces
it. After this table: `rainbow-holo` survives only through `ACE SPEC Rare` (33 cards);
`secret-rare` through older `Secret Rare`; `v-full-art` through older `Ultra Rare`; `v-regular`
through `Holo Rare V` and older promos; `trainer-gallery-holo` through the TG override;
`rainbow-alt` through `Futuristic Rare` (2) and `Three Star` (23). Verify each against the live API —
a rarity that exists in the table but has no real card is dead.

**Era regexes, controller-verified against all 220 TCGdex sets:** `/^sv(\d|p$)/i` matches exactly the
17 SV sets (`sv01` … `sv10.5w`, `svp`); `/^me(\d|p$)/i` exactly the 7 Mega sets (`me01` … `me05`,
`mep`). Both correctly reject `swsh4.5sv`, `2023sv` and `2024sv`. They also leave out `sve` and
`mee`, the SV and Mega **basic energy** sets — harmless, because energies carry `Common` / `None`
rarities that never reach an era-split row. Say so in a comment rather than widening the patterns.

Tests: every row above, both sides of each era split, the SV regex's controls (`swsh4.5sv`,
`2023sv`), the masterball numbers and a non-masterball 151 card, and a non-151 SV reverse staying
`reverse-holo`. Mutation-test the era regexes' anchors.

### Task 4 — The showcase

29 sections × 3 cards = 87. **The controller builds and verifies the matrix** — through the real
selection logic, on each card's _real_ rarity from a detail fetch (TCGdex's `?rarity=` is a substring
match), with art confirmed to load — and hands it over, exactly as for the 66. Seven new sections;
several existing sections change membership because their rarities moved. The fixture gains the new
cards verbatim. Everything in the existing sections brief still holds: one live `HoloCard` on the
page, equal tile heights, constant `viewKey`.

## Verification

- `pnpm vitest run && pnpm lint && pnpm --filter @ncam/holodex typecheck && pnpm --filter @ncam/holodex build`
- The lazy three.js chunk will grow by seven compiled shader strings. Report the new size against
  the 170 KB gz budget.
- **The real check is visual**, and none of it is testable under node: a GPU smoke pass through
  `/effects`, comparing each new effect side by side with the same card in the 151 demo.

## Out of scope

- Per-card masks (see "The ceiling").
- Prismatic Evolutions (`sv08.5`) also had Poké Ball / Master Ball reverses. Not in the reference, so
  not here; a one-line extension of the `sv03.5` rule if wanted later.
- The rarity filter's substring bug in search and set views (found during the sections work):
  separate fix.
