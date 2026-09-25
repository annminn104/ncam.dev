# Holodex — port the 22 older effects' shines from pokemon-cards-css

**Status:** approved by the repo owner, 2026-09-25 ("Re-port 2 shines" as a
pilot, then "Re-port all 22 shines"; approach "A: groups + alpha"; after the
pilot, "Continue if it passes"). Amended while planning, the same day:
gradients on the RGBA path are exact (their stops where CSS puts them), where
the approved draft resampled them; see "Exact gradients". Branch `feat/holodex-holo-v2`, local commits
only. Licence terms, the owner's: port the CSS's structure and values, draw
every texture ourselves, copy no image from either GPL-3.0 reference (the
owner checks the licence question separately). This lifts the "SV ports
only" freeze for the shines, as the glare port lifted it for the glares.

## Problem

The 22 effects derived from
[simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)
now carry ported glares, but their shines are still **derived by eye**, and
the whole-card gap to the reference is theirs: after the glare port,
secret-rare measured about 30 and radiant-holo about 23 against
poke-holo.simey.me, where the glare alone matches within the 2.40 floor
(AGENTS.md, "Comparing an effect with the reference"). Reading the CSS
against the derived shines shows why:

- **Layer order.** CSS lists a background's top layer first. secret-rare's
  derived shine stacks its layers bottom-first, so its blends run upside down.
- **Palette.** `palette.ts`'s `SUNPILLAR` is the reference's `--red`, `--yellow`,
  `--green`, `--blue` and `--violet`, not its sunpillars. Both references share
  the paler `--sunpillar-1..6` that `css.ts` already holds.
- **Missing content.** secret-rare lacks its radial, its `:before`'s foil and
  radial and its `:after` glitter; radiant-holo draws two rainbow bands where
  the reference draws grey bars crossed at ±45° under a radial tinted by the
  card's type, plus a glitter `:before` and a textured `:after`.
- **What the DSL cannot say.** The reference's `:before` and `:after` blend
  inside `.card__shine`'s isolated group (its `filter` and `mix-blend-mode`
  make one), and only the finished group reaches the card, through the
  shine's filter and colour-dodge. Stops and textures carry alpha. Some
  radials are ellipses. radiant-holo tints by `--card-glow`, a colour per card
  type. trainer-gallery-secret-rare blends with `color`. And the unmasked path
  samples nine texture images the DSL has no source for.

## Decision

Port each of the 22 shines from its rarity's CSS on the unmasked path, as the
glares were, after extending the DSL so the ports can be transcriptions
rather than approximations:

- **Groups**: an element may hold children that paint inside its isolated
  group, in the reference's paint order.
- **Alpha**: an element that needs it compiles with an RGBA stack and CSS's
  own compositing. Every element that uses neither a group nor alpha compiles
  exactly as today.
- Elliptical radials with a moving centre, a per-card glow colour, the
  `color` blend mode, and a clip per child.
- **Textures** drawn procedurally here: glitter and grain redrawn, and nine
  new ones for the reference's texture images.

Pilot first: the compositing core, the textures and features secret-rare and
radiant-holo need, and those two ports, measured headless. If the pilot
passes (Verification), the other twenty follow; if not, the work stops and
the owner gets the numbers.

## Design

### Groups

`Element` gains `children?: Element[]`: the pseudo-elements that paint inside
this element's isolated group, in paint order. A child has no children of its
own (a test holds that). An element then draws:

1. its own layers, into a stack that starts transparent;
2. each child in order: the child's layers, its own filter, its opacity and
   clip applied to its alpha, then composited onto the group with the child's
   `mixBlend`;
3. the element's filter over the whole group;
4. the group onto the card with the element's `mixBlend`, weighted by the
   group's alpha, the element's opacity, `uCardOpacity` and its clip.

That is CSS's order for `.card__shine` with pseudo-elements: its filter
applies to the element and its descendants as one group, and its
`mix-blend-mode` composites the group. An element whose `layers` is empty and
whose children draw everything (the shine with no background of its own) is
allowed.

**Paint order** is the author's to resolve from the CSS and write as the
array's order. The pseudo-elements are grid items of `.card__shine`
(`display: grid`), so their `z-index` applies without positioning: `auto`
paints in DOM order (`:before`, then `:after`), and a positive `z-index`
paints after those, ascending. radiant-holo's `:before` (`z-index: 2`) and
shiny-rare's (`z-index: 1`) therefore paint **after** `:after`; v-star's
(`z-index: 2`) too; cosmos-holo's 2 and 3 keep DOM order.

### Alpha and compositing

An element compiles to an **RGBA path** when it has children, or any of its
layers (or its children's) is an exact gradient (below) or a texture with an
alpha channel. Everything else keeps the RGB path
byte-for-byte: the generated code of every element that uses no new feature
is unchanged, which the tests pin for all eight Scarlet & Violet ports and
for the 22 ported glares. (The shared preamble, `sources.ts` and
`blend.ts`, grows with the new functions; blend ids are appended, never
renumbered.)

On the RGBA path, straight (unpremultiplied) colour and alpha, per W3C
Compositing and Blending Level 1, for a source `(Cs, αs)` over a backdrop
`(Cb, αb)`:

```
Cs' = (1 − αb)·Cs + αb·B(Cb, Cs)
αo  = αs + αb·(1 − αs)
Co  = (αs·Cs' + (1 − αs)·αb·Cb) / αo          (0 where αo is 0)
```

One GLSL function does this for a layer onto the layers beneath it
(`background-blend-mode`), a child onto its group (`mix-blend-mode` inside the
group) and, with `αb = 1`, the group onto the card:
`acc = mix(acc, B(acc, Cg), αg · weight)`. A layer's or child's opacity
multiplies its alpha. Filters act on straight colour and leave alpha alone,
as CSS's `brightness`, `contrast` and `saturate` do.

### Exact gradients

The RGBA path draws CSS gradients through three new source kinds,
`css-linear` (optionally `repeating`), `css-radial` and `css-conic`, whose
stops sit where CSS puts them: up to 32, each with its alpha, interpolated in
premultiplied colour as CSS's are, the first colour held before the first stop
and the last after the last. Nothing is resampled onto the older kinds' eight
even stops, so a band pattern keeps its hard edges (radiant-holo's bars are
twenty-one stops) and no alpha is folded. A `css-linear` carries its gradient
line as a function of the card's uv, the line `css.ts` already works out for
the older kinds; a `css-radial` its CSS geometry (below); a `css-conic` its
centre and start angle, measured clockwise from the top in the card's true
proportions, as CSS measures it. The older kinds keep their eight even RGB
stops, and `css.ts` its folding, for the RGB path. (The approved draft put
alpha on the older kinds' stops and kept the resampling; positioned stops are
exact where that was not.)

### Radials: ellipses, and a centre of their own

A `css-radial` carries its `centre` on the card and its image's `size`, as a
converted radial's `cssBox` does, plus `at`, the centre as a fraction of its
own image, which CSS measures the farthest corner from (the pointer, for every
radial converted so far), and whether it is an `ellipse`.
radiant-holo and trainer-gallery-holo centre at
`calc(var(--pointer-x) * 0.5 + 25%)`, so theirs is `0.25 + 0.5 · pointer`.

A `farthest-corner ellipse` keeps the aspect `farthest-side` would give it and
grows to pass through the corner: radii `√2 · max(c, 1 − c)` of the image
along each axis. A circle keeps today's geometry, generalised from the
pointer to `at`, and the reach is left unclamped, since CSS carries a stop
past 100% (the glares' 180%) beyond the ending shape. The older radials'
`radialCssDistance` becomes that reach, clamped, at the pointer. A
TypeScript twin in `css.ts` holds the geometry, and `compile.test.ts` keeps
translating the GLSL itself and holding it to the twin.

### A per-card glow

`--card-glow` is a colour per card type (base.css: `.card.water`,
`.card.fire`, … ten types; `hsl(175, 100%, 90%)` otherwise, trainers and
Colorless included). `selectHolo` adds `glow` to `HoloSelection`, looked up
from the card's first type in a table copied from base.css, and the scene
sets it as `uCardGlow`. An exact gradient's stop may be part glow:
`{ at, color, alpha, glow }` draws `mix(color, uCardGlow, glow)`, and
`css.ts` writes `var(--card-glow)` as a stop of glow 1. Only radiant-holo
uses it.

### The `color` blend, and a child's clip

`blend.ts` gains `color` (non-separable: the source's hue and saturation at
the backdrop's luminosity), the one CSS blend it lacks, for
trainer-gallery-secret-rare. A child takes `Element.clip` as elements do,
applied to its alpha inside the group: radiant-holo's `:after` keeps to the
art window (`--clip`) while its shine keeps to the borders.

### Textures

Every texture is drawn here, procedurally, from a seeded PRNG (`mulberry32`)
or pure geometry, so a card looks the same on every visit. None is a copy of
the reference's images; those were looked at headless only to match motif,
feature size, density and tone. Each is drawn at its reference image's
natural size, so a CSS `background-size` of `33%` or `25% auto` means the same
thing. What each paints is decided by pure functions that
`textures.test.ts` holds to account, as today; the canvas calls stay
untested.

| Texture         | Stands in for             | Size       | Alpha  | Motif                                            |
| --------------- | ------------------------- | ---------- | ------ | ------------------------------------------------ |
| `glitter`       | `glitter.png` (redrawn)   | 630 × 540  | —      | dense sparkle on near-black, a few 4-point stars |
| `grain`         | `grain.webp` (redrawn)    | 500 × 500  | —      | dark monochrome film grain                       |
| `geometric`     | `geometric.png`           | 300 × 300  | —      | diagonal line maze of nested L blocks            |
| `trainerbg`     | `trainerbg.png`           | 208 × 208  | —      | blue wavy diagonal lines on white                |
| `illusion`      | `illusion.png`            | 600 × 600  | —      | warped concentric black and white bands          |
| `illusion-mask` | `illusion-mask.png`       | 600 × 600  | yes    | the same bands, black opaque, white near-clear   |
| `ancient`       | `ancient.png`             | 300 × 300  | —      | stepped zig-zag diagonal stripes                 |
| `vmaxbg`        | `vmaxbg.jpg`              | 600 × 400  | —      | overlapping ringed discs, embossed blue metal    |
| `cosmos-bottom` | `cosmos-bottom.png`       | 734 × 1024 | —      | starfield: dots, sparkles, planets, clusters     |
| `cosmos-middle` | `cosmos-middle-trans.png` | 734 × 1024 | binary | a subset of the same objects, in place           |
| `cosmos-top`    | `cosmos-top-trans.png`    | 734 × 1024 | binary | a sparser subset, in place                       |

glitter and grain are sampled only by the 22 older effects, so redrawing
them touches nothing else. The three cosmos layers come from one seeded list
of objects, so they line up as the reference's do. Each new texture is a
`Source` kind with a sampler; an effect samples at most a handful, far under
WebGL2's sixteen active samplers, and `scene.ts` binds only the ones an
effect uses (`texturesUsedBy`), generating each on first use. `css.ts` gains
each texture's natural aspect, so `auto` sizes convert.

### Which rules apply

As for the glares: the unmasked path, so a rarity's `:not(.masked)` rules
apply and `.masked`-only ones are dropped; a rarity's main subtype where
rules vary; the gallery effects' `[trainer-gallery="true"]` rules; base.css
for whatever a rarity leaves unset. For the shine that means base.css's
`.card__shine` filter (`brightness(.85) contrast(2.75) saturate(.65)`) and
`color-dodge`, and its sunpillar rotation (`:before` starts at
`--sunpillar-5`, `:after` at `--sunpillar-6`). A pseudo-element draws only
where some rule gives it `content`, and not where the unmasked path sets
`display: none` (shiny-v's and v-full-art's `:before`).

- **Layer order**: the DSL's layers are bottom first, CSS's list reversed.
  `background-blend-mode` values repeat cyclically over the layers; the
  bottom layer's is a no-op, and its DSL blend is `normal`.
- **`--foil`**: where the unmasked path sets it, our texture of that name;
  where it sets `none` or nothing, the layer is dropped. That is how the
  comparison harness renders the reference, and it is the author's own
  unmasked convention: rainbow-alt and reverse-holo set `--foil: none`.
  amazing-rare and shiny-vmax are the two that use `--foil` with no override.
- **`--mask`**: none; masks are out of reach.
- **Clip paths**: the shine's own is the effect's `ClipShape`, which must
  agree (select.ts; a test holds each); a pseudo-element's own is the child's
  clip.
- **Units and variables**: px at `CARD_PX` (300); `--seedx`/`--seedy` 0;
  `--card-opacity` is `uCardOpacity`; each `calc()` of the pointer variables a
  `PointerDriven`; colours as the CSS writes them (`--r-clr-*` and the like
  read off the file being ported). `palette.ts`'s `SUNPILLAR` and
  `RAINBOW_MUTED` go when their last user does.
- **Approximations**: each file's header lists its own, as the ports do.

The glares stay as ported; `basic` keeps an empty shine (base.css's
`.card__shine` is transparent and basic.css adds none).

## Testing

- **Compiler** (`compile.test.ts`): the RGBA compositing function, translated
  from the emitted GLSL and held to a TypeScript twin checked against values
  worked by hand (an opaque source, a transparent one, a half-transparent
  source over a half-transparent backdrop, each blend family); a group's
  order (layers, then each child filtered, then the element's filter, then
  the card); a child's opacity and clip on its alpha; the exact gradients'
  stop lookup, the ellipse and `at` geometry and the conic angle, each
  translated from the GLSL and held to its twin; the glow stops. Every element with no new
  feature emits exactly what it did: the generated `main()` of each Scarlet
  & Violet port and of the 22 ported glares is pinned.
- **Blend**: `color` against CSS's definition, as the other non-separable
  modes are tested.
- **Selection**: `glow` per type, the default for trainers, energy and
  Colorless.
- **Textures** (`textures.test.ts`): each generator's pure part — sizes,
  seeds, the maze's cells, the wave and band geometry, the disc lattice, the
  cosmos object list and its three subsets — and that each tiles.
- **Ports**: a new `effects/legacy-shines.test.ts`, one row per effect, values
  copied by hand from the CSS (never computed with `css.ts`): the shine's
  blend and filter terms; each child's blend, filter, opacity and clip, in
  paint order; the layer blends, sources and sizes, bottom first. Plus hand
  checks of a few converted colours, as `legacy-glares.test.ts` has.
- The registry tests (element budget, first-layer blend, stop limit, compile)
  hold, extended to children.

## Verification

- `pnpm vitest run`, `pnpm lint`, `pnpm --filter @ncam/holodex typecheck`,
  Prettier; a fresh build, the three.js split check (2 / 1), and the lazy
  chunk against its 170 KB gz budget.
- **Headless, against poke-holo.simey.me**, with the harness the glares used
  (unmasked card, rarity retyped, our art in its `<img>`, pointer variables
  pinned, at the reference's own tilt), in two modes:
  - **Shared textures.** The reference's texture requests (`glitter.png`,
    `geometric.png`, …) answered with **our** textures, rendered by
    `makeTexture` in a page of the dev server, so ours and the reference differ
    in compositing alone.
  - **Own textures.** The reference as it ships, for the whole picture.
    Against the no-effect floor measured the same way, at the same points.
- **The pilot passes** when, in shared-texture mode, secret-rare's and
  radiant-holo's gaps are within 1.5 × the floor at every sample point. Then
  the other twenty follow, each measured the same way and reported; a port
  that misses is examined before it is accepted. If the pilot misses, work
  stops and the owner gets the numbers and side-by-side images.
- **GPU smoke** on the dev server: every scene-drawing legacy effect live on
  its card page and on `/effects`, a canvas each and no
  `holo.compile-failed`; one toggle and one lose/restore on a card whose
  effect uses a group.
- Side-by-side images of ours and the reference for the owner, pilot and
  final.

## Order of work

1. The RGBA path, groups and the compositing function.
2. Ellipses and `at`; the glow; `color`; a child's clip.
3. glitter, geometric and trainerbg; the harness's shared-texture mode.
4. secret-rare and radiant-holo; measure; the gate.
5. The rest, grouped by what they share: the illusion trio (shiny-rare,
   shiny-v, v-full-art); v-star (ancient); v-max and trainer-gallery-v-max
   (vmaxbg); the glitter family (amazing-rare, rainbow-holo, rainbow-alt,
   swsh-pikachu with illusion-mask, shiny-vmax, trainer-gallery-secret-rare);
   v-regular and trainer-gallery-v-regular (grain); cosmos-holo (its three
   layers); regular-holo, reverse-holo, trainer-full-art (trainerbg),
   trainer-gallery-holo; basic.
6. Docs; `palette.ts` retired.

## Docs

`apps/holodex/AGENTS.md`: "Two families of effects" (the 22 shines ported
too, and the freeze gone), the DSL paragraph (children, the RGBA path,
ellipses, the glow, the new textures), the textures bullet under "Tests are
DOM-free", and "Comparing an effect with the reference" (shared-texture
mode). `css.ts`'s header: the unfolded conversion, and its note calling its
sunpillars paler than pokemon-cards-css's, which is wrong (they are the
same; `palette.ts`'s were never the sunpillars).

## Out of scope

- **The eight Scarlet & Violet ports onto groups.** The owner chose to do it
  after the 22 ("Migrate later too"): a sub-project of its own, with its own
  spec and plan, re-checked against poke-151. Until then they stay
  byte-identical.
- Masks and per-card foils.
- The glares (ported), and whether Commons get a glare (the owner's).
- A subtype's own variant of a rarity's shine, where a file has one: the main
  rule stands in, as for the glares.
