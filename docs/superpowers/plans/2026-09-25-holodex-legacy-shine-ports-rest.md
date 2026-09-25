# Holodex legacy shine ports — the other twenty — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the remaining twenty legacy effects' shines from pokemon-cards-css's unmasked path, as the pilot ported secret-rare and radiant-holo, with the textures they need drawn here.

**Architecture:** The pilot's foundation carries these ports: groups (`Element.children`), the RGBA path with CSS compositing and CSS's own filter chain, exact gradients (`css-linear`, `css-radial`, `css-conic`), the card's glow. Two small extensions join it: a per-type foil brightness (reverse-holo) and textures with alpha (the cosmos layers, illusion-mask). Each port is a transcription, every value from the CSS; `secret-rare.ts` and `radiant-holo.ts` show the form.

**Tech Stack:** TypeScript, three.js GLSL ES 3.00, Vitest (node), Playwright 1.63 with the cached Chromium 1208 headless shell for comparisons.

**Spec:** `docs/superpowers/specs/2026-09-25-holodex-legacy-shine-ports-design.md` (and the pilot plan, `2026-09-25-holodex-legacy-shine-ports.md`, whose "How it landed" this builds on).

## Global Constraints

Everything in the pilot plan's Global Constraints, and:

- Commit message files are named `shine-msg-<task>.txt`, fresh per commit (a stale file of the same name once supplied a wrong message).
- The RGB path, `applyFilter` and every pinned block stay as they are (`unchanged.test.ts`).
- Sources of truth, both in the scratchpad (`$S`): the CSS text, `refcss/shine/<rarity>.txt` (every rule touching `.card__shine`, verbatim), for formulas; and `cmp/shine/computed.json`, the reference's own computed styles for each rarity on the unmasked probe card (pointer pinned mid-card), for anything the cascade decides (which rule wins, `var()` values, the sunpillar rotation). Where the two seem to disagree, the computed style is right about the cascade and the text about the pointer terms.
- A shine's clip must be the CSS's: where `select.ts`'s `ClipShape` disagrees, the task that ports the effect changes `select.ts` and `select.test.ts`.

## Notation for the effect tables

Layers are bottom first (CSS's list reversed). `bg` is `BACKGROUND_X/Y`; `p` is `POINTER_X/Y`; `pfc` is `--pointer-from-center`. A box is `size @ position`, fractions of the card; `auto` heights use `autoHeight(width, TEXTURE_SIZE[kind])`. Colours are as the CSS writes them. `RCLR` is the rainbow family's seven `--r-clr-*`: `hsl(0,57,37)`, `hsl(40,53,39)`, `hsl(90,60,35)`, `hsl(180,60,35)`, `hsl(180,60,35)`, `hsl(210,57,39)`, `hsl(280,55,31)`, written into a 22-stop linear as CSS lists them (1–7, 1–7, 1–7, 1, evenly spaced). `BANDS` is the V family's `repeating-linear-gradient(133deg, #0e152e 0%, hsl(180,10%,60%) 3.8%, hsl(180,29%,66%) 4.5%, hsl(180,10%,60%) 5.2%, #0e152e 10%, #0e152e 12%)`. `SUN(n)` is `--sunpillar-clr-1..6,1` at `--space` 1..7 as the element resolves them (`sunpillarClr(1)` on the shine, `sunpillarClr(6)` on `:after`, `sunpillarClr(5)` on `:before`). `DARK` is `radial(farthest-corner circle at p, black 0.1 12%, black 0.15 20%, black 0.25 120%)`. A filter `(b, c, s)` is `brightness, contrast, saturate`; a pointer term is written `b + k·pfc`.

---

### Task B1: The harness, for every sample

**Files (scratchpad):** `$S/cmp/shine/{ours.mjs,ref.mjs,stats.mjs,computed.mjs}`

- [ ] **Step 1:** Extend `ALL` in `cmp/shine/ours.mjs` with each effect's first gallery card, a query where the printing needs one: `regular-holo hgss4-1`, `reverse-holo swsh3-3?variant=reverse`, `cosmos-holo sv10.5b-171`, `amazing-rare swsh4-9`, `rainbow-holo sv06.5-058`, `rainbow-alt 30th-157`, `shiny-rare sv04.5-092`, `shiny-v swsh4.5sv-SV105`, `shiny-vmax swsh4.5sv-SV106`, `v-regular xyp-XY84`, `v-full-art sm9-1`, `v-max swsh3-2`, `v-star swsh12-008`, `trainer-gallery-holo swsh10tg-TG28`, `swsh-pikachu 30th-023`, `trainer-gallery-v-regular swsh12tg-TG12`, `trainer-gallery-v-max swsh12tg-TG15`, `trainer-gallery-secret-rare swsh9tg-TG29`, `trainer-full-art swsh12tg-TG23`. `ref.mjs` takes each effect's reference setup from `computed.mjs`'s `REFERENCE` (rarity, subtypes, supertype, type class, gallery flag, set and number), and pins `--foil`, `--mask` and `--cosmosbg` on `.card__front`, where Card.svelte sets them inline.
- [ ] **Step 2: Floors.** Temporarily make every effect draw nothing — in `effects/index.ts`, map `EFFECTS` through `(e) => ({ ...e, shine: [], beneath: [], glare: [] })` — capture `TAG=floor node ours.mjs`, then `git checkout -- apps/holodex/src/holo/effects/index.ts` and confirm `git status` shows it clean. Capture the reference with `HIDE_SHINE=1 HIDE_GLARE=1 TAG=floor node ref.mjs`, and print the floors with `TAG=floor node stats.mjs`.
- [ ] **Step 3: Before.** `TAG=before node ours.mjs`, `TAG=before node ref.mjs`, `TAG=before node stats.mjs` (the reference as it ships). Record floors and befores in the ledger.

### Task B2: A per-type foil brightness

**Files:** `apps/holodex/src/holo/shader/types.ts`, `shader/compile.ts`, `shader/sources.ts`, `effects/css.ts`, `select.ts`, `HoloCard.tsx`, `canvas-key.ts`, `material.ts`, `scene.ts`, and their tests.

reverse-holo.css filters its shine by `brightness(var(--foil-brightness))`: 0.55, but 0.7 on `.card.lightning`, 0.8 on `.card.darkness` and 0.6 on `.card.metal`.

- [ ] **Step 1: Tests.** `select.test.ts`: `foilBrightnessOf(card)` is 0.7 / 0.8 / 0.6 for Lightning / Darkness / Metal and 0.55 otherwise, and `selectHolo` returns it as `selection.foilBrightness`. `compile.test.ts`: a `PointerDriven` with `fromFoilBrightness: 1` compiles to `(0.000000 + 1.000000 * uFoilBrightness)`, and one without it compiles as before (the pins hold). `css.test.ts`: `valueAt({ base: 0, fromFoilBrightness: 1 }, { foilBrightness: 0.7 })` is 0.7. `canvas-key.test.ts`: a different foil brightness gives a different key. `material.test.ts`: `uFoilBrightness` starts at 0.55.
- [ ] **Step 2: Implement.** `PointerDriven.fromFoilBrightness?: number` (doc: "multiplied by the card's --foil-brightness, uFoilBrightness: reverse-holo's"); `driven()` appends `${f(k)} * uFoilBrightness` when present; `PointerAt.foilBrightness`; `TERMS` in css.ts gains the term (so `times`/`plus`/`valueAt` carry it); `uniform float uFoilBrightness;` in `sourcesGLSL`; `HoloSelection.foilBrightness: number` from a `FOIL_BRIGHTNESS_BY_TYPE` table in select.ts; HoloCard's memo, `holoCanvasKey`, the material (`uFoilBrightness: { value: 0.55 }`) and `setSelection` as the glow's.
- [ ] **Step 3:** Run the suite, the GLSL check, commit (`feat(holodex): hand the card's type foil brightness to the shader`).

### Task B3: Textures with alpha on the RGBA path

**Files:** `shader/compile.ts`, `shader/sources.ts`, tests.

- [ ] **Step 1: Test.** A layer whose source kind is in `ALPHA_TEXTURES` compiles on the RGBA path to `vec4 src_… = texture(u<Name>, uv_… * <scale>);` — its alpha kept — and makes `needsRGBA` true on its own; any other texture stays `vec4(src…(…), 1.0)`.
- [ ] **Step 2: Implement.** `ALPHA_TEXTURES` lists `illusion-mask`, `cosmos-middle` and `cosmos-top` (added with their kinds in Task B4); `rgbaLayerCode` samples those with their sampler (`TEXTURE_SAMPLER` in sources.ts, the kind-to-uniform map scene.ts's `SHARED_TEXTURE_UNIFORM` is then held against). Commit with Task B4's first texture if the kinds do not exist yet.

### Task B4: Seven textures

**Files:** `textures.ts`, `textures.test.ts`, `shader/types.ts`, `shader/sources.ts`, `shader/compile.ts`, `scene.ts`, `material.ts`, `scene.test.ts`, `shader/sources.test.ts`.

For each: first measure the reference image headless (size, alpha, tone histogram, run lengths or crossings along rows and diagonals, as the pilot's textures were measured), then draw it here to the motif, feature size, density and tone measured, seeded or pure geometry, at the reference's natural size, and look at the two side by side before committing. Tests hold each generator's pure part: size, determinism, tone bounds from the measurement, tiling (the seam no rougher than the inside), and each texture's own structure (named below).

| Texture                       | Size       | Alpha  | Draw                                                                                                                 | Structure the test holds                                               |
| ----------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `grain` (redrawn)             | 500 × 500  | —      | dark monochrome film grain, seeded, mean about 12 in 0..255                                                          | mean and spread within the measured bounds; tiles                      |
| `illusion`                    | 600 × 600  | —      | black and white bands of a warped distance field (concentric rhombi pulled by low-frequency sines), about half white | the black / white shares; band count along the diagonal                |
| `illusion-mask`               | 600 × 600  | yes    | `illusion`'s bands: black opaque, white nearly clear (the measured alpha split)                                      | alpha = f(luminance) as measured; same bands as `illusion`             |
| `ancient`                     | 300 × 300  | —      | stepped zig-zag diagonal stripes, white on black, about a quarter white                                              | white share; the stripe period along a row                             |
| `vmaxbg`                      | 600 × 400  | —      | overlapping discs in rows, each of concentric rings, shaded as embossed blue metal                                   | mean colour; ring period along a disc's radius                         |
| `cosmos-bottom`               | 734 × 1024 | —      | a seeded starfield: specks, four-point sparkles, soft planets, speckled clusters, on near-black                      | tone bounds; object counts per kind                                    |
| `cosmos-middle`, `cosmos-top` | 734 × 1024 | binary | subsets of the same objects in place (middle about 17% opaque, top about 3%), purple / orange                        | opaque shares; every opaque pixel lies on an object of the shared list |

Each new texture is a `Source` kind with a sampler (`SOURCE_ID` appended), a `srcX` function, a `sourceExpr` case, `SHARED_TEXTURE_UNIFORM`, a material uniform and a `TEXTURE_SIZE` entry. Commit per texture or per pair (`feat(holodex): draw <texture> for the <effect> shine`).

### Task B5: regular-holo, reverse-holo, trainer-gallery-holo, trainer-full-art

Tests first in `legacy-shines.test.ts` (one `describe` per effect, values copied from the CSS as the pilot's are), then each port, then the measurement (shared and own textures) and a look at the side-by-side.

**regular-holo** (clip: the card's own, `regular` / `stage` / `trainer`, as today). Shine `(1.1, 1.1, 1.2)`, `color-dodge`:

1. `css-linear` repeating 90°: `black 0px, black 1px, #666 1px, #666 2px` (`--scanlines-space: .5px`, at CARD_PX along the 90° line of a cover box), cover — `normal`
2. `css-linear` repeating 110°: `--violet, --blue, --green, --yellow, --red` three times, evenly 0–100%, `400% × 400% @ (1.8 − 2.6·bg.x, 2.25 − 3.5·bg.y)` — `overlay`

Children: `:before` then `:after`.

- `:before` `(1.15, 1.1)`, `hard-light`: 1. `css-linear` repeating 90° `black 6%, grey 0.7 9%, black 10.5%, grey 0.7 12%, black 15%, black 30%`, `200% × 200% @ (0.05 + 0.9·bg.x − 0.75·bg.y, bg.y)`; 2. the same with `black 42%` last, `200% × 200% @ (1.325 − 1.65·bg.x + 0.5·bg.y, bg.x)` — `screen`
- `:after` `(0.6, 4)`, `luminosity`: `css-radial` at p, `grey 0.9 α0.8 0%, grey 0.78 α0.1 25%, black 90%`, cover

**reverse-holo** (clip: inverted card region, as today; `--foil: none` drops its foil). Shine `(0 + 1·foilBrightness, 1.5, 1)`, `color-dodge`, opacity `1.5 − 1·pfc`:

1. `css-linear` −45°: `black 15%, white 50%, black 85%`, `200% × 200% @ (p.x, p.y)` — `normal` (CSS's `difference` onto the dropped foil)
2. `css-radial` circle at p: `white 5%, black 50%, white 80%`, `120% × 120% @ centre` — `soft-light`

**trainer-gallery-holo** (clip `borders`, as today). Shine `(0.5 + 0.3·pfc, 2.3, 1)`, `color-dodge`:

1. `css-linear` repeating −22°: `hsla(283,49%,60%,.75) 5%, hsla(2,74%,59%,.75) 10%, hsla(53,67%,53%,.75) 15%, hsla(93,56%,52%,.75) 20%, hsla(176,38%,50%,.75) 25%, hsla(228,100%,77%,.75) 30%, hsla(283,49%,61%,.75) 35%`, `300% × 400% @ (0, bg.y)` — `normal`

Children: `:after` only (`:before` is `display: none`): `(0.4 + 0.2·pfc, 0.85, 1.1)`, `hard-light`: `css-radial` ellipse at `(0.25 + 0.5·p)`: `white 5%, hsla(300,100%,11%,.6) 40%, hsl(0,0%,22%) 120%`, `400% × 500% @ centre`.

**trainer-full-art** (clip `full`, as today). v-full-art.css's supporter rules under trainer-full-art.css's unmasked ones (`computed.json`). Shine `(0.6 + 0.05·pfc, 1.5, 1.2)`, `color-dodge`:

1. `DARK`, `200% × 100% @ bg` — `normal`
2. `BANDS`, `300% × 100% @ (bg.x + 0.2·bg.y, bg.y)` — `hard-light`
3. `SUN` (shine), `200% × 700% @ (0, bg.y)` — `hue`
4. `trainerbg`, `20% auto @ centre` — `color-burn`

Children: `:after` (z auto) then `:before` (z 1).

- `:after` `(0.6 + 0.05·pfc, 1.5, 1.2)`, `exclusion`: layers 1–4 as the shine's with `SUN` rotated for `:after` and boxes `200% × 100% @ bg`, `195% × 100% @ (−(bg.x + 0.2·bg.y), −bg.y)`, `200% × 400% @ (0, bg.y)`, `20% auto @ centre`
- `:before` no filter, `screen`, opacity 0.5: `css-radial` at p, `white 0%, black α0 80%`, cover

### Task B6: the illusion trio — v-full-art, trainer-gallery-v-regular, shiny-v, shiny-rare

All four draw v-full-art's shape with `illusion` as the foil (`33% auto @ centre`) and the unmasked blends `exclusion, hue, hard-light`. Shine layers: `DARK 200% × 100% @ bg` (`normal`), `BANDS 300% × 100% @ (bg.x + 0.2·bg.y, bg.y)` (`hard-light`), `SUN 200% × 700% @ (0, bg.y)` (`hue`), `illusion` (`exclusion`); shine filter `(0.35 + 0.3·pfc, 2, 1.5)`, `color-dodge`. `:after`: the same four with `SUN` rotated and boxes `200% × 100% @ bg`, `195% × 100% @ (−(bg.x + 0.2·bg.y), −bg.y)`, `200% × 400% @ (0, bg.y)`, `33% auto @ centre`.

| Effect                    | `:after` filter, blend                                                                                | `:before`                                                                                       | Clip                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| v-full-art                | `(0.8 + 0.5·pfc, 1.6, 1.4)`, `exclusion`                                                              | none (`display: none`)                                                                          | `full`                                                                                |
| trainer-gallery-v-regular | as v-full-art                                                                                         | none                                                                                            | `full` — **was `borders`**: move it from `BORDERS` to `FULL_ART`                      |
| shiny-v                   | `(0.5 + 0.4·pfc, 1.4, 1.2)`, `difference` (shiny-rare's `.card.card[data-rarity*="rare shiny"]` rule) | none                                                                                            | `full`                                                                                |
| shiny-rare                | `(0.5 + 0.4·pfc, 1.4, 1.2)`, `difference`                                                             | z 1, after `:after`: `css-radial` at p `white 0%, black α0 40%`, cover, `overlay`, opacity 0.75 | the card's own (`--clip`, `--clip-stage`) — **was `full`**: take it out of `FULL_ART` |

`select.test.ts` gains each clip; the effect-gallery fixture's shape checks follow.

### Task B7: v-star, v-max, v-regular

**v-star** (`ancient` foil `18% × 15% @ centre`, blends `exclusion, hue, hard-light`; clip `full`). Shine layers as the illusion trio's with `ancient` for `illusion`; filter `(0.35 + 0.25·pfc, 1.8, 1.75)`. `:after` as theirs with `ancient`, filter `(0.5 + 0.75·pfc, 1.5, 1.5)`, `exclusion`. `:before` (z 2, painted last): `css-radial` at p `rgb(200,206,208) α.75 0%, rgb(125,119,136) α.25 45%, rgb(136,119,133) 120%`, cover, `hard-light`, opacity 0.8. Values off `v-star.txt`, their resolution off `computed.json`.

**v-max** (`vmaxbg` foil `60% × 30% @ centre`; clip `full`). Shine filter `(0.4 + 0.4·pfc, 2, 1)`, `color-dodge`:

1. `css-radial` at p: `hsla(189,76%,77%,.6) 0%, hsla(147,59%,77%,.6) 25%, hsla(271,55%,69%,.6) 50%, hsla(355,56%,72%,.6) 75%` (as `v-max.txt` gives them), `200% × 200% @ bg` — `normal`
2. `css-linear` repeating 133°: `hsla(227,53%,12%,.5) 0%, hsl(180,10%,50%) 2.5%, hsl(83,50%,35%) 5%, hsl(180,10%,50%) 7.5%, hsla(227,53%,12%,.5) 10%, hsla(227,53%,12%,.5) 15%`, `600% × 600% @ bg` — `soft-light`
3. `css-linear` repeating −33°: `hsl(2,70%,47%) 6%, hsl(228,60%,64%) 12%, hsl(176,55%,39%) 18%, hsl(123,68%,35%) 24%, hsl(283,75%,57%) 30%, hsl(2,70%,47%) 36%`, `1100% × 1100% @ bg` — `luminosity`
4. `vmaxbg`, `60% × 30% @ centre` — `difference`

Children: `:after` (`:before` has no content): `saturate(1.5)`, `lighten`, opacity `0.3 + 0.5·pfc`: 1. `BANDS 300% × 100% @ bg`; 2. `SUN` (`:after`, `--space` 6%) `200% × 700% @ (0, bg.y)` — `hue`.

**v-regular** (`grain` `500px × 100% @ centre`, blends `screen, hue, hard-light`; clip **`full`** — the CSS's, where today it is the card's own region: add it to `FULL_ART`). Shine layers as the illusion trio's with `grain` for the foil; filter `(0.7, 2, 0.5)` (`:not(.masked)`). `:after`: boxes `200% × 100% @ bg`, `195% × 100% @ (−bg.x, −bg.y)`, `200% × 400% @ (0, bg.y)`, `500px × 100% @ centre`, filter `(1, 2.5, 1.75)`, `soft-light`. No `:before`.

### Task B8: the glitter family

**amazing-rare** (clip `regular` on every card — `amazing-rare.css`'s `:not(.masked)` rule sets `--clip` whatever the stage; `clipShape` returns `regular` for it). Shine `(1, 1, 0.9)`, `color-dodge`: 1. `css-radial` at p `hsla(150,20%,10%,1) 10%, hsla(177,22%,80%,.1) 50%, hsla(0,0%,95%,.98) 90%`, cover — `normal`; 2. `glitter 25% × 25% @ (0.55, 0.55)` — `color-burn`; 3. `glitter 25% × 25% @ (0.40, 0.45)` — `soft-light`. Children: `:before` `(1, 1, 1)`, `lighten`, opacity 0.5: `css-radial` at p `hsla(50,20%,90%,.95) 10%, rgba(181,139,164,.5) 50%, black 60%`, cover (its `--foil` is `none`); `:after` `(0.75 − 0.5·pfc, 1, 1)`, `saturation`: `css-linear` repeating 133° `SUN` (`:after`), `400% × 800% @ (2 − 3·bg.x, 2 − 3·bg.y)`.

**rainbow-holo** (clip `full`). Shine `(0.6 + 0.25·pfc, 2.2, 0.75)`, `color-dodge`: 1. `css-linear` −30° `RCLR`, `400% × 400% @ (0.25 + 0.5·p.x, 0.25 + 0.5·p.y)` — `normal`; 2. `glitter 25% × 25% @ centre` — `soft-light`; 3. `css-linear` −45° `hsl(0,57%,37%) → hsl(180,60%,35%)`, `200% × 200% @ (0.25 + 0.5·p.x, 0.25 + 0.5·p.y)` — `luminosity`. Children: `:before` `(2.5, 1)`, `darken`, opacity `0.24 + 0.6·pfc`: `illusion-mask 33% auto @ centre`; `:after` `(0.55 + 0.3·pfc, 2, 1)`, `color-dodge`: 1. `css-linear` −60° `RCLR`, `400% × 400% @ p`; 2. `glitter 25% × 25% @ centre` — `soft-light`.

**swsh-pikachu** (clip `full`). As rainbow-holo but: shine filter `(0.75 + 0.5·pfc, 2, 1)`; the shine's glitter at `nudged(p, 1px)` (secret-rare's `--shift: 1px`, `+ var(--shift)`); `:before` `(2.5, 1)`, `multiply`, opacity `0.24 + 0.6·pfc`; `:after` `(0.35 + 0.35·pfc, 2, 1)`, `exclusion`, its glitter nudged the other way (`- var(--shift)`).

**rainbow-alt** (clip `full`). Shine `(0.3 + 0.3·pfc, 3, 1.8)`, `color-dodge`: 1. `css-linear` −30° `RCLR`, `400% × 400% @ (1.5·bg.x, 1.5·bg.y)` — `normal`; 2. `glitter 25% × 25% @ centre` — `overlay`; 3. `css-linear` repeating 133° `hsla(283,49%,60%,.75) 5%, hsla(2,70%,58%,.75) 10%, hsla(53,67%,53%,.75) 15%, hsla(93,56%,52%,.75) 20%, hsla(176,38%,50%,.75) 25%, hsla(228,100%,77%,.75) 30%, hsla(283,49%,61%,.75) 35%`, `200% × 400% @ (0, bg.y)` — `luminosity`. Children: `:after` only (`:before`'s `--foil` is `none`): `(0.6 + 0.5·pfc, 3, 1)`, `color-dodge`, opacity `1.2 − 0.5·pfc`: 1. `css-linear` −60° `RCLR`, `400% × 400% @ (−1.5·bg.x, −1.5·bg.y)`; 2. `glitter 25% × 25% @ centre` — `overlay`.

**trainer-gallery-v-max** (clip **`full`** — move from `BORDERS` to `FULL_ART`): rainbow-alt's with `--space: 6%` (v-max.css's, `computed.json`): the repeating stops at 6–42%.

**shiny-vmax** (clip `full`). Shine `(1, 1, 0.85)`, `color-dodge`: 1. `css-radial` at p `hsla(248,5%,10%,1) 10%, hsla(206,5%,80%,.1) 50%, hsla(0,0%,95%,.98) 90%`, cover — `normal`; 2. `css-linear` −30° `RCLR`, `400% × 400% @ (1.5·bg.x, 1.5·bg.y)` — `color-burn`; 3. `glitter 25% × 25% @ (0.55, 0.55)` — `overlay`; 4. `glitter 25% × 25% @ (0.40, 0.45)` — `soft-light`. Children: `:before` `(1, 1, 0.4)`, `lighten`, opacity 0.35: `css-radial` at p `hsla(248,5%,91%,.95) 10%, hsla(206,5%,68%,.5) 50%, black 120%`, cover; `:after` `(0.5 + 0.4·pfc, 1.4, 1.2)`, `difference` (shiny-rare's rule again): `css-linear` repeating −30° `SUN` (`:after`), `400% × 800% @ (2 − 3·bg.x, 2 − 3·bg.y)`.

**trainer-gallery-secret-rare** (clip **`full`** — move from `BORDERS` to `FULL_ART`). Shine `(0.2 + 0.3·pfc, 2, 0.75)`, `color-dodge`: 1. `css-linear` 45° `hsl(46,95%,50%) → hsl(52,100%,69%)`, cover — `normal`; 2. `css-radial` at p `hsl(152.7,21.6%,10%) 10%, hsla(177,22%,80%,.1) 50%, hsla(0,0%,95%,.98) 90%`, cover — `color`; 3. `glitter 25% × 25% @ (0.55, 0.55)` — `darken`; 4. `glitter 25% × 25% @ (0.40, 0.45)` — `soft-light`. Children: `:before` `(1, 1, 1)`, `exclusion`: 1. `css-radial` at p `hsla(50,20%,90%,.95) 10%, hsla(324,22%,63%,.5) 50%, black 90%`, cover; 2. `geometric 33% auto @ centre` — `color-burn`. `:after` `(0.6 + 0.5·pfc, 2, 3)`, `soft-light`: 1. `css-conic` `--sunpillar-clr-4,5,6,1,2,3,4` (`:after`) evenly; 2. `glitter 25% × 25% @ nudged(p, 1px)` (secret-rare's `:after` position) — `luminosity`.

### Task B9: cosmos-holo

Clip: the card's own, as today. Shine `(1, 1, 0.8)`, `color-dodge`: 1. `css-radial` at p `hsla(180,100%,89%,.5) 5%, hsla(180,14%,57%,.3) 40%, black 130%`, cover — `normal`; 2. `css-linear` repeating 82° rainbow, the twelve stops `computed.json` resolves (4–48%), `400% × 900% @` its CSS position — `multiply`; 3. `cosmos-bottom`, cover `@ (0, 0)` (`--cosmosbg`, seed 0) — `color-burn`. Children: `:before` (z 2) `(1.25, 1.75, 0.8)`, `overlay`: 1. the rainbow; 2. `cosmos-middle` (alpha) — `lighten`. `:after` (z 3) `(1.25, 1.75, 0.8)`, `multiply`: 1. the rainbow; 2. `cosmos-top` (alpha) — `multiply`.

### Task B10: Wrap up

- [ ] `palette.ts` goes (`git rm`), its last users ported; the `glitter`/`grain` expectation in `scene.test.ts` follows what the effects now sample.
- [ ] Docs: `apps/holodex/AGENTS.md` — "Two families" (all 22 shines ported, the freeze gone), the DSL paragraph (children, RGBA path, exact gradients, CSS filters, glow and foil brightness, the textures), "Tests are DOM-free" (the textures), "Comparing an effect with the reference" (shared textures; the probe's `.card__front` inline variables; the type class; `computed.json`); `css.ts`'s header (the exact converters; its sunpillar note). The owner-facing finding: the RGB path's `applyFilter` is not CSS's, for the Scarlet & Violet sub-project.
- [ ] Final: all twenty-two measured in both modes against their floors, a table in the ledger and the plan's "How it landed"; the full verification (tests, lint, typecheck, Prettier, fresh build, split, budget); GPU smoke of all 21 scene-drawing legacy effects on card pages and `/effects`, and a lose/restore; side-by-sides to the owner. Nothing pushed.

## How it landed (2026-09-25)

Executed inline, task by task, each test-first and committed locally: 6f44be0 (B2, foil
brightness), d0a6b50 (B5), 300a27a (B3 and illusion), 7d84349 (B6), a8adb1e (grain, ancient,
vmaxbg), a8e4c64 (B7), 7e86d99 (B8), ba05153 (the cosmos layers), 157b0a6 (B9), faae39e
(`palette.ts`), 2f1760a (docs). B1's harness stays in the scratchpad. What the plan did not
foresee:

- **The probe card's foil variables are inline on `.card__front`** (Card.svelte sets `--foil`,
  `--mask`, `--cosmosbg` and the seeds there), so pinning them on `.card` lost to the inline
  values, and amazing-rare's reference drew the probe card's own foil. The pins moved to
  `.card__front`. The pilot's two were unaffected: their unmasked rules set `--foil` on the shine.
- **regular-holo's `--scanlines-space: .5px` sits in a media query**; the probe computes 1px, and
  1px is what was ported, as the Global Constraints' "the computed style is right about the
  cascade" says.
- **Clips followed the CSS**: trainer-gallery-v-regular, trainer-gallery-v-max,
  trainer-gallery-secret-rare and v-regular are full art; shiny-rare takes the card's own region;
  amazing-rare the art window whatever its stage (`ART_WINDOW`).
- **The illusion field was not periodic** outside its tile until the point was wrapped into the
  tile first; the tiling test caught it.
- In B5 the ports were written before their tests. The tests were then added and watched failing
  against the older code, stashed.

**Final measurement**, all 21 that draw a scene (`basic` draws none), at (0.3, 0.3) · (0.7, 0.7):
luminance / chroma gap to the reference in 0..255, whole card unless marked. "Before" has only the
pilot's two ported; "shared" feeds the reference our textures, "own" leaves it its images; "shine
only" hides the glare on both sides, shared. The bound at each point is
max(1.5 × floor, floor + 2).

| Effect                      | Floor (0.3 / 0.7) | Before                | Now, shared textures | Now, own images     | Shine only        | Verdict                  |
| --------------------------- | ----------------- | --------------------- | -------------------- | ------------------- | ----------------- | ------------------------ |
| regular-holo                | 3.1/2.0 · 1.6/0.3 | 8.8/12.7 · 11.1/21.2  | 3.9/1.8 · 2.8/2.1    | 3.9/1.8 · 2.8/2.1   | —                 | within                   |
| reverse-holo                | 4.0/5.6 · 6.6/5.0 | 24.0/19.1 · 22.1/8.0  | 6.3/10.8 · 11.3/9.6  | 6.3/10.8 · 11.3/9.6 | 5.9/4.0 · 4.4/4.9 | shine within, glare over |
| cosmos-holo                 | 1.2/1.4 · 0.8/1.7 | 20.2/19.8 · 20.6/13.3 | 7.3/7.3 · 3.9/3.0    | 7.8/7.2 · 3.6/3.0   | 0.6/1.6 · 0.9/1.8 | shine within, glare over |
| amazing-rare                | 2.0/4.3 · 2.0/2.9 | 15.0/11.3 · 12.4/10.3 | 1.9/3.1 · 2.0/2.9    | 1.7/3.4 · 1.6/3.0   | —                 | within                   |
| radiant-holo                | 2.1/3.3 · 4.0/2.3 | 1.7/1.9 · 2.4/1.6     | 1.7/1.7 · 2.6/1.6    | 1.7/1.9 · 2.4/1.6   | —                 | within                   |
| rainbow-holo                | 1.0/2.7 · 1.4/8.2 | 4.4/11.6 · 1.8/13.6   | 1.2/3.3 · 2.6/9.6    | 1.3/4.2 · 2.6/9.6   | —                 | within                   |
| rainbow-alt                 | 3.1/1.7 · 2.0/2.0 | 31.6/26.7 · 27.3/31.9 | 2.9/2.4 · 3.4/3.4    | 3.1/2.1 · 4.0/3.4   | —                 | within                   |
| secret-rare                 | 3.7/2.9 · 3.4/4.8 | 3.0/2.3 · 3.3/4.1     | 3.0/2.3 · 3.4/4.1    | 3.0/2.3 · 3.3/4.1   | —                 | within                   |
| shiny-rare                  | 3.2/2.2 · 3.1/1.1 | 24.0/40.6 · 26.7/39.7 | 3.1/1.7 · 3.1/0.9    | 3.1/1.7 · 3.3/0.9   | —                 | within                   |
| shiny-v                     | 1.2/1.1 · 2.1/0.9 | 1.2/1.0 · 2.7/0.9     | 1.2/1.4 · 2.4/1.0    | 1.2/1.7 · 2.4/1.1   | —                 | within                   |
| shiny-vmax                  | 2.1/0.6 · 2.2/1.2 | 16.7/10.0 · 14.8/20.1 | 1.6/3.2 · 1.9/1.4    | 1.2/3.1 · 1.8/1.3   | 3.2/2.7 · 3.0/1.9 | marginal (chroma)        |
| v-regular                   | 3.2/3.7 · 2.3/3.0 | 11.2/10.1 · 9.3/5.1   | 2.9/4.6 · 3.2/1.9    | 2.8/4.6 · 3.1/1.8   | —                 | within                   |
| v-full-art                  | 2.6/0.8 · 3.3/1.6 | 24.3/10.2 · 20.3/16.9 | 3.0/1.3 · 3.4/1.6    | 3.0/1.1 · 3.3/1.7   | —                 | within                   |
| v-max                       | 2.9/0.6 · 3.8/1.3 | 26.2/15.2 · 27.2/13.7 | 3.9/0.9 · 2.3/1.4    | 3.7/0.9 · 2.3/1.3   | —                 | within                   |
| v-star                      | 2.4/0.4 · 3.0/2.1 | 11.3/5.1 · 9.1/3.7    | 2.0/0.7 · 1.8/1.2    | 2.1/0.7 · 1.8/1.3   | —                 | within                   |
| trainer-gallery-holo        | 1.9/2.1 · 2.3/1.7 | 20.4/28.7 · 25.2/36.4 | 6.6/4.4 · 8.4/4.4    | 6.6/4.4 · 8.4/4.4   | 1.8/2.2 · 3.0/2.7 | shine within, glare over |
| swsh-pikachu                | 3.2/1.8 · 3.4/2.7 | 19.9/13.1 · 20.2/16.4 | 3.7/6.0 · 3.4/3.0    | 4.6/6.4 · 3.7/4.0   | 3.3/4.0 · 3.1/3.1 | marginal (chroma)        |
| trainer-gallery-v-regular   | 3.0/2.4 · 5.1/2.1 | 29.7/69.0 · 22.6/67.1 | 5.1/8.2 · 8.9/8.1    | 5.2/8.3 · 8.9/8.4   | 3.0/2.2 · 5.1/1.9 | shine within, glare over |
| trainer-gallery-v-max       | 4.4/1.6 · 2.6/1.1 | 31.2/82.0 · 32.8/80.1 | 8.6/9.6 · 5.3/7.0    | 8.6/9.1 · 5.3/7.0   | 4.4/1.7 · 3.0/1.3 | shine within, glare over |
| trainer-gallery-secret-rare | 2.7/2.9 · 2.8/1.6 | 24.6/24.3 · 25.6/27.4 | 1.9/2.7 · 2.2/1.7    | 1.9/2.7 · 2.2/1.7   | —                 | within                   |
| trainer-full-art            | 2.6/2.8 · 1.7/3.6 | 18.2/13.2 · 19.2/13.0 | 10.8/4.6 · 4.0/3.3   | 10.7/4.1 · 4.0/3.3  | 1.7/0.9 · 1.7/2.9 | shine within, glare over |

Means over the 21: before 17.25 / 20.77, now 3.93 / 3.70 (own images 3.94 / 3.74), floor
2.74 / 2.34. Thirteen are within the floor whole; with the glare hidden, 19 are, and shiny-vmax
(2.7 against 2.6) and swsh-pikachu (4.0 against 3.8) miss on chroma at (0.3, 0.3), on floors of
0.6 and 1.8, alike by eye.

**Glare findings**, outside this plan and left as they were, for the owner:

- Glare only, reverse-holo's luminance gap is 5.8 · 12.8, trainer-gallery-holo's 6.6 · 7.6 and
  trainer-full-art's 11.8 · 4.7; cosmos-holo's glare was already known to sit 3 to 6 over.
- trainer-gallery-v-regular's glare computes to v-regular.css's radial (white 0%,
  rgba(134, 138, 141, .33) 45%, rgba(51, 51, 51, .9) 130%), hard-light through brightness(.9)
  contrast(1.75), at opacity .4; the glare port draws base.css's radial, overlaid.
- trainer-gallery-v-max's glare is hard-lit in the reference; the glare port overlays it.

**Verification:** 904 tests in 40 files, lint, typecheck and Prettier clean; a fresh build splits
2 / 1 and its lazy chunk is 570.64 kB, 148.72 KB gz (budget 170); GPU smoke: every legacy section
of `/effects`, and all 21 card pages, draw their effect, and a lost context comes back on a fresh
canvas (swsh9tg-TG29's first load got no card data from TCGdex, and passed on the next). Nothing
pushed. Next, as the owner chose: the Scarlet & Violet ports onto groups, a sub-project of its own
with its own spec and plan, re-checked against poke-151, which also settles the RGB path's
`applyFilter`.
