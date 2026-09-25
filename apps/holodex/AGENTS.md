# AGENTS.md — apps/holodex

Holodex — a **Pokémon TCG database explorer** on the TCGdex API: browse every
series, set and card, filter by type and rarity, search globally, track a
collection, and inspect a card rendered with a three.js WebGL holo foil keyed
to its rarity. React 19 + Vite 8 + Tailwind CSS v4 + TanStack Query + three.js,
packaged as a **self-contained** React Module Federation remote (same model as
`apps/bali` / `apps/viktor` / `apps/mindloop` / `apps/immersive-ocean`).

**Current state: implemented.** Mounted by the portfolio host at
`/projects/holodex/...` via the host-owned, route-aware remote contract (see
"What it exposes" below); also runs fully standalone on `:9007`. Full design:
[`docs/superpowers/specs/2026-09-21-holodex-design.md`](../../docs/superpowers/specs/2026-09-21-holodex-design.md);
task-by-task plan:
[`docs/superpowers/plans/2026-09-21-holodex.md`](../../docs/superpowers/plans/2026-09-21-holodex.md).

## What it exposes

`defineRemote` (from `@ncam/mf-remote`) exposes three federated entries, plus a
fourth entry used only for standalone dev — **the four entries**:

```ts
// ./mount      — CSR: createRoot(target).render(<App/>); returns a MountHandle
// ./ssr        — renderHeroSSR({ config, assetBase }) → { html, css }
//                (renderToString inside a HydrationBoundary + dehydrated query cache)
// ./hydrate    — hydrateRoot(target, <App/>) onto the SSR markup; returns a MountHandle
// standalone.tsx — not federation-exposed. Drives #app in index.html on :9007,
//                  wires window.history / popstate so the app behaves like a
//                  real site when nobody is hosting it.
```

`mount` / `hydrate` / `renderHeroSSR` all accept an optional
`config?: MountConfig` (`route`, `onNavigate`, `assetBase` — the host↔remote
contract in `packages/mf-remote/src/contract.ts`) and `mount` / `hydrate`
return a `MountHandle`: a disposer that also carries an optional
`update?: (route: string) => void`.

- **`route`** is a leading-slash path local to the remote (`/sets/swsh3?type=Fire`),
  parsed by `routes.ts` — the remote never sees `/projects/holodex`.
- **`onNavigate`** is how the remote asks to go somewhere; the host owns the
  URL and answers by calling `handle.update(route)` back, or standalone dev
  answers itself (`standalone.tsx` pushes history state directly).
- **`update()` is what avoids a remount.** `route-controller.ts` holds the
  current route outside React (`App` reads it with `useSyncExternalStore`), so
  a click inside Holodex that changes the URL — set → card → back — calls
  `controller.setRoute()` through `update()` instead of tearing the whole
  remote down and rebuilding it. That is what lets the WebGL context, the
  react-query cache and scroll position survive in-app navigation; the remote
  is only destroyed when the host unmounts it entirely (leaving `/projects/holodex`)
  or when `mount`/`hydrate` is called fresh with no prior instance.
- A remote that ignores `config` (the other five in this repo) is unaffected —
  every field is optional and existing callers already satisfy the type.

## Structure

- `src/routes.ts` — the remote's whole URL space: `parseRoute` / `formatRoute`
  for `home | set | search | card | collection | effects | not-found`, plus
  filter (`q`, `type`, `rarity`, `page`) parsing.
- `src/route-controller.ts` — route store outside React (see above).
- `src/App.tsx` — one `switch` over `Route` into a view; wraps everything in
  `QueryClientProvider` + an error boundary keyed by route so a bad view can't
  wedge the whole app.
- `src/lib/tcgdex.ts` — the TCGdex client (gotchas below). `src/lib/queries.ts`
  — react-query keys/options, single source of query config. `src/lib/images.ts`
  — quality-suffixed asset URLs. `src/lib/collection.ts` — the localStorage
  owned/wishlist store. `src/lib/ssr-state.ts` — dehydrated-cache
  serialise/read for the `<script type="application/json">` handoff.
- `src/components/` — `Shell`, `FilterBar`, `Pager`, `CardGrid` / `CardTile` /
  `CardImage`, `StatPanel`, `PricePanel`, `CollectionToggle`, `ErrorBoundary` /
  `ErrorPanel`, `Skeleton`.
- `src/views/` — `SetsView`, `SetView`, `SearchView`, `CardView`,
  `CollectionView`, `EffectsView`, `NotFoundView` — one per `Route` case.
  `EffectsView` (`/effects`, `/effects/<effectId>`,
  `/effects/<effectId>?card=<cardId>`) gives every `EffectId` a section of its
  own, with the rarities that select it and three real cards — 30 sections,
  90 cards; exactly one card on the whole page renders a live `HoloCard` at a
  time, the other 89 are plain art. A rarity whose effect depends on the
  card's era appears in both its sections, each chip qualified by era
  ("Rare · Scarlet & Violet, Mega", "Rare · before Scarlet & Violet").
- `src/holo/` — eager (statically imported by `HoloCard.tsx`, so part of the
  main chunk): `select.ts` (rarity/layout/printing → `HoloSelection`),
  `regions.ts` (`ClipShape` → inset rect + `coversPoint`), `capability.ts`
  (`supportsHolo`), `showcase.ts` (the one-shot intro sweep, a pure state
  machine over an injected clock), `use-reduced-motion.ts`,
  `effect-gallery.ts` (the effects page's matrix: three
  example cards per `EffectId`, rarities read off `EFFECT_BY_RARITY` and
  `MODERN_EFFECT_BY_RARITY`, each card checked against the real `selectHolo`
  on a captured TCGdex copy in `effect-gallery.fixture.ts`), `canvas-key.ts` (`holoCanvasKey`, the key that
  gives every scene a canvas of its own — see the fourth gotcha below),
  `HoloCard.tsx` itself (mount, pop/showcase, context-loss and off-screen
  handling). Lazy (only reachable through
  `HoloCard.tsx`'s dynamic `import('./scene')` — see below): `scene.ts`,
  `textures.ts`, `material.ts`, `shader/` (`base.ts`, `blend.ts`,
  `sources.ts`, `compile.ts`, `types.ts`), `effects/` (30 effect files, one
  per `EffectId`, plus the `index.ts` registry, shared `palette.ts`, and
  `css.ts`, which converts pokemon-cards-151's CSS for the eight Scarlet &
  Violet ports — see "Two families of effects" below).
- `src/styles/globals.css` — Tailwind v4 entry: `@theme` holo palette tokens
  (`--color-holo-bg/panel/line/text/muted/accent`) and the `.holodex` root
  class, applied instead of `<body>` so the remote never repaints the host page.
- `src/mount.tsx` / `ssr.tsx` / `hydrate.tsx` / `standalone.tsx` + `index.html`.

## TCGdex gotchas (why the data layer looks the way it does)

Base `https://api.tcgdex.net/v2/en`, no key, CORS-open. Verified live 2026-09-21:

- **An unknown query param returns `[]`, not the unfiltered list.**
  `lib/tcgdex.ts` sends only a whitelisted set of params
  (`name`, `types`, `rarity`, `set.id`, `pagination:*`) — never a caller-supplied key.
- **`?set.id=` is a substring match, not exact membership**, and the bleed can
  swamp a page: `swsh1` is a prefix of `swsh10`/`swsh11`/`swsh12`/`swsh12.5`…,
  so `?set.id=swsh1` at a capped page size returns mostly _other_ sets' cards.
  Exact set membership therefore never comes from `?set.id=` — it comes from
  `GET /sets/{setId}`, which returns that one set's complete card list in a
  single response, paginated **in memory**. A _filtered_ set view still queries
  `/cards?set.id=…` (cheap once filters shrink the result), asked exactly
  since 2026-09-25 (below), and still intersects the rows with the exact id
  set from `/sets/{setId}`, which also orders them, before showing anything.
- **`?rarity=` is a substring match too.** `?rarity=Shiny rare V` returns the
  7 `Shiny rare VMAX` cards along with the 9 it names (verified 2026-09-24),
  and briefs carry no rarity to filter them back out. So a card's rarity comes
  from `GET /cards/{id}`, never from the query that found it: every card on the
  effects page was judged on its own, and an earlier draft that trusted the
  query put a VMAX under `shiny-v`. The app's own rarity filter asks exactly
  (below).
- **An `eq:` prefix makes either filter exact, and case-sensitive**:
  `?rarity=eq:Shiny rare V` returns just the 9 (`eq:shiny rare v` none), and
  `?set.id=eq:swsh1` just swsh1's 216 cards (verified 2026-09-24).
  `buildCardUrl` sends every rarity with it, so the set and search views'
  rarity filter is exact: `Common` no longer brings the Uncommons, nor `Rare`
  most of the catalogue. The filter bar offers only `CARD_RARITIES`, the API's
  own spellings, whose 42 exact matches partition all 23,736 cards (checked
  2026-09-25); refresh it from `GET /rarities` if TCGdex adds one. A
  hand-typed `?rarity=rare` now finds nothing. `set.id` goes out the same
  way, always a set document's own id, so a mis-cased URL still works: 33 of
  the 220 set ids bled bare (`swsh1`: 1,272 rows for its 216 cards), and the
  exact matches of all 220 partition the catalogue too. `wp` and `sp` list no
  cards at all; bare, they matched `bwp`'s and `hgssp`'s.
- **A brand-new set's `variants` can be placeholders.** Every card of `30th`
  (30th Celebration, released 2026-09-16) reads
  `normal: true, holo: false, reverse: false`, Double rares and Special
  illustration rares included, where the curated `me02` and `sv08` read
  `holo: true` for all of those. Selection reads no variant flag for that
  reason (select.ts says so where the era rule lives), and a card page
  offers no reverse toggle on such a set until TCGdex curates it. The one
  variant datum it reads is a listed Poké Ball printing (below), which is
  safe: absent, it means a plain reverse, never a wrong pattern.
- **`variants_detailed` names each printing's `foil`**, and `/cards` cannot
  filter on it (`?variants_detailed.foil=pokeball` returns `[]`), so finding
  the sets that list one took a scan of card details (2026-09-25). Prismatic
  Evolutions (`sv08.5`), Black Bolt and White Flare (`sv10.5b`/`sv10.5w`)
  list a `pokeball` reverse for every Common, Uncommon and Rare, and a
  `masterball` one for most. Ascended Heroes (`me02.5`) lists an `energy`
  reverse plus one ball for most of its Commons, Uncommons and Rares:
  `pokeball`, `friendball`, `loveball`, `quickball`, `duskball` or
  `team-rocket` (38 list only a plain reverse). The English 151 lists none (plain,
  four with a `cosmos` one besides): its ball patterns are the reference
  demo's, kept by set.
- **~20% of card briefs have no `image`.** `lib/images.ts` returns `null` for a
  missing base and `CardImage` renders a placeholder at the same `63/88`
  aspect ratio so the grid never reflows.
- **A subset set's cards never carry `image`, though their art exists.** All
  312 cards of `swsh4.5sv` (Shining Fates' Shiny Vault), `swsh9tg`–`swsh12tg`
  (the Trainer Galleries) and `swsh12.5gg` (Crown Zenith's Galarian Gallery)
  come back without one, while each asset sits under the _parent_ set's path
  (`swsh12tg-TG23` → `en/swsh/swsh12/TG23`). `lib/images.ts#cardImageBase`
  recovers exactly those six sets, and every place that draws a card's art
  (`CardTile`, `HoloCard`, the effects page) reads it through that function,
  never `card.image` directly. Its doc comment holds the verification and why
  `cel25cc` is deliberately left out: do not widen the rule to cases nobody
  has checked.
- **There is no total-count header** — `Content-Length`/`Content-Range` are the
  only exposed headers. Global search (and the unfiltered-set fallback) ask
  for `perPage + 1` rows: if the extra row comes back, `hasNext = true` and it
  is sliced off — the pager shows "prev · page N · next", never a total. The
  set view, having materialised the whole set in memory, _can_ show an exact
  total and page count.
- Page overflow is not an error (`?pagination:page=99999` → `200 []`), so an
  out-of-range page just renders an empty grid rather than throwing.

## Grid tiles are CSS; the card detail is WebGL

Dozens of tiles can be on screen in a set/search grid at once, so `CardTile`
uses a pointer-driven `rotateX`/`rotateY` transform plus a CSS
`linear-gradient` sheen — no GL context, cheap at any tile count. The full
three.js holo shader (refraction, moving glare, rarity-keyed foil texture,
device-tilt input) only exists on the **card detail page** and the **effects
page** (`/effects`, whose selected tile is the one live `HoloCard`) — one live
canvas at a time — and only when `holo/capability.ts#supportsHolo` says the visitor's
device qualifies (WebGL2 available, no `prefers-reduced-motion: reduce`,
`hardwareConcurrency > 2`) — otherwise `HoloCard` stays on the plain `<img>`.

**30 rarity-keyed effects, not four tiers.** `holo/select.ts#selectHolo(card,
options)` maps all 42 TCGdex rarities onto 30 `EffectId`s. Two tables do it:
`EFFECT_BY_RARITY` for every rarity, and `MODERN_EFFECT_BY_RARITY` for the two
whose look changed with the Scarlet & Violet era — a `Rare` (plain before,
printed holo in SV and Mega: `sv-rare-holo`) and an `Ultra Rare` (the full-art
V or GX before, the full-art ex after: `ex-full-art`). `eraOf(card)` reads the
era off the set id (the card id less `-${localId}`): `/^sv(\d|p$)/i`,
`/^me(\d|p$)/i`, and by exact id `30th` and `30th-c`, the two Mega Evolution
sets whose ids do not start with `me` (checked against `GET /series/me`; a
new set with an odd id needs the same check against its series). Three
overrides apply on top, in order: (1) a `Promo` with a `suffix` (V, ex, GX…)
is a holo chase card, `ex-regular` in the modern era and `v-regular` before;
(2) a card number matching `/^[tg]g/i` is a trainer-gallery printing and
remaps its base effect to one of four gallery variants (`galleryEffect`); (3)
`options.variant` — the printing shown, an explicit choice never read off the
card — on a card whose effect is `basic`, `regular-holo` or `sv-rare-holo`
becomes a reverse foil with `invert: true`. `masterball` is `masterball-holo`;
`reverse` is `reverse-holo`, except on 151 (`sv03.5`), whose reverse
holos are Poké Ball patterned (`poke-ball-holo`), or Master Ball for the
reference's fixed card numbers 1, 4, 7, 25, 133, 144, 146 and 161
(`masterball-holo`) — never its random 20% promotion, so a card renders the
same every time — and except where TCGdex lists a Poké Ball printing of the
card (a `reverse` in `variants_detailed` with `foil: 'pokeball'`), which is
`poke-ball-holo` too. A Master Ball printing listed beside it is its own
printing (`masterball`), and an Ascended Heroes card whose ball is another
kind (Friend, Love, Quick, Dusk, Team Rocket) stays `reverse-holo`, since only
the Poké Ball has a pattern here.
`options.variant` has exactly two sources: the card page's printing toggle
(`views/CardView.tsx`: Normal, Reverse holo, and Master Ball where TCGdex
lists that printing, `listsReverseFoil`), deep-linked as `?variant=reverse` or
`?variant=masterball`, and the effects page's three reverse sections
(`views/EffectsView.tsx`, via each gallery entry's `variant`).
`card.variants?.reverse` means "a reverse printing of this card exists in
TCGdex's data," not "show it," and only decides whether the toggle is offered
at all — and so whether the card page honours a `?variant=`, which it ignores
on a card without that printing. An earlier version of
`selectHolo` read `card.variants?.reverse` directly instead of taking the
caller's choice — conflating "exists" with "show it" — and mis-rendered
roughly half of TCGdex (~12,500 cards, every one whose reverse printing
exists but isn't what a visitor is looking at) with inverted or unwarranted
foil. An unmapped rarity falls back to `basic`,
but never silently: a coverage test asserts every one of the 42 rarities has
a table entry and that the seven override-only effects (the three reverse
foils and the four gallery variants) never appear as a table value. `selectHolo` also
picks the card's `ClipShape` (`clipShape()` in the same file) from the
resolved effect, the card's `category`/`stage`, and whether its rarity is
literally `Full Art Trainer` — order matters, since `radiant-holo`,
`illustration-rare` and the gallery effects must claim `borders` before the
full-art and trainer rules would otherwise take them. `ex-regular` (a
`Double rare`, the standard-layout ex) must never be `full`: its reference
confines its foil with a per-card mask we do not have, and the geometric art
window stands in for it.

**Two families of effects.** The 22 older effects were _derived_ from
[simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)
by eye, their numbers carried across as they stood. The eight Scarlet & Violet
ones (`ex-regular`, `ex-full-art`, `illustration-rare`,
`ex-special-illustration-rare`, `hyper-rare`, `poke-ball-holo`,
`masterball-holo`, `sv-rare-holo`) are _ported_ from
[simeydotme/pokemon-cards-151](https://github.com/simeydotme/pokemon-cards-151)
through `effects/css.ts`, which converts CSS instead of copying numbers (a CSS
`200%` makes an image bigger where a DSL size makes it repeat) and lists the
approximations every port shares; each port lists its own. The reference's
per-rarity CSS is not the whole of it: `public/css/cards.css` holds
`--angle`, `--space`, every texture variable and 151's clip regions, and
`src/lib/components/Card.svelte` the pointer maths. **The 22 older effects'
glares are ported too** (2026-09-25, the owner's call; their shines stay
derived by eye): each is its rarity's `.card__glare` (and `:after`) from
pokemon-cards-css, through `css.ts` and `effects/legacy-glare.ts` (base.css's
radial, the neutral a transparent glare folds toward, source-over for
reverse-holo's unblended `:after`), drawn with CSS's own `farthest-corner`
geometry (the Source's `cssBox`, which grows as the pointer leaves the
middle) and stacked beneath the shine (below). `legacy-glares.test.ts` holds
each to a table copied by hand from its CSS. `basic`'s port shows only as the
fallback material: `HoloCard` draws no scene for a `basic` card, so Commons
and Uncommons stay plain art. Per-card masks, the reference's realism
ceiling, are out of reach for both families.

**Glare stacks by z-index, as the reference's does.** poke-151 paints a
card's layers in z-index order — `.card__glitter` 2, `.card__shine` 3
(base.css) — not in markup order and not by `translateZ`. So a `.card__glare`
or `.card__glare2` that its rarity's CSS gives no z-index paints _beneath_
the shine, which then dodges or overlays a card the glare has already lit or
darkened: a different picture from the same glare laid over the top. An
`Effect` carries such glare in `beneath` (counted in glare's budget of two),
and `glare` holds only what paints above; the shine's clip keeps whatever lies
beneath it. Only `ex-regular` (both glares `z-index: 4`) and the balls' glare
(`z-index: 5`) paint above; every one of the 22 older effects' glares lies
beneath, as pokemon-cards-css gives `.card__shine` the same `z-index: 3` and
`.card__glare` none. Checked in a headless browser: lifting the Poké Ball's
glare2 to `z-index: 4` in the shipped reference reproduced exactly the olive
text box this port showed while it painted every glare above; and on
poke-holo.simey.me, with a card's pointer variables pinned (two captures of
one state differ by 0.00), lifting `.card__glare` to `z-index: 4` changed
every one of 11 rarities, from 0.4% of the card's pixels (cosmos) to 17.8%
(radiant). `sv-effects.test.ts`'s stacking table holds every port to its CSS,
and `legacy-glares.test.ts` the 22.

**Clip regions, and why reverse holo inverts.** `holo/regions.ts` maps each
`ClipShape` (`regular`, `stage`, `trainer`, `borders`, `full`) to an inset
`RegionRect` — fractions of the card copied straight from the reference's CSS
`inset()` percentages — plus `stage`'s extra step-cut for an evolution card's
"evolves from" box. `coversPoint(shape, x, y, invert)` is the tested twin of
the GLSL `coverage()` function in `shader/base.ts`: same constants, same
result, one in TypeScript for the test suite and one in GLSL for the shader.
Everything else (basic, regular-holo, full-art effects, …) confines its
foil _inside_ the region — a window over the art. `reverse-holo` is the one
case that flips `invert` to `true`, painting the foil _outside_ the region
instead (the card's border and text box), because that is what a real
reverse-holo print actually looks like: foil everywhere except the art. The
151 ball foils invert the same way.

An element can also carry a **clip of its own** (`Element.clip`, a region's
rect, never inverted, never `stage`), which gates that element alone inside
whatever the effect's region allows: the reference clips some
pseudo-elements apart from their shine. The balls keep their glyphs inside
the silver border (`borders`) while the shine's own dodge reaches it, and
`illustration-rare`'s glare keeps to the border polygon. `insideRect()` in
`shader/base.ts` draws it, and `compile.test.ts` runs the emitted GLSL
against `coversPoint` as it does `coverage()`.

**The effect DSL and the generator.** Each of the 30 effect files under
`holo/effects/` (e.g. `cosmos-holo.ts`) is a declarative `Effect`
(`holo/shader/types.ts`): 1-3 `shine` elements and up to two glare elements,
painted above the shine (`glare`) or beneath it (`beneath`), each
a stack of `Layer`s (a `Source` — solid, linear/repeating-linear/conic/radial
gradient, `card`, `scanlines`, or one of the generated textures: `glitter`,
`grain`, `iri`, `birthday`, and the 151 set's `pokeball` / `pokeball-inner` /
`masterball` / `masterball-inner` patterns — plus a `BlendMode`, and
optionally an `opacity` of its own, as a pseudo-element fades inside its
element: cosmos-holo's `:after`), an
optional pointer-driven `Filter`, its own `mixBlend`, and optionally its own
`clip`. A radial converted from CSS also carries its `cssBox` (its centre
and image size), and draws with CSS's `farthest-corner` geometry
(`radialCssDistance` in `sources.ts`, twin `css.ts#radialT`). Numbers can be
plain, or `PointerDriven` (a base plus coefficients over pointer-from-center /
from-left / from-top, evaluated per fragment). `holo/shader/compile.ts`'s
`compileEffect()` turns one `Effect` into one complete fragment shader —
concatenating `base.ts` (varyings, clip uniforms, `coverage()`, `insideRect()`), `blend.ts`
(16 blend modes as GLSL functions: CSS's own but `color`, including the three
non-separable HSL ones, and `plus-lighter`, strictly a compositing operator) and `sources.ts`
(one GLSL expression per `Source` kind) around
per-effect layer/filter code generated from the `Effect` data. This is a
declarative-description-compiled-to-GLSL design, not the hand-written GLSL
chunks the original plan sketched — the one deviation from the plan, also
recorded in the spec's Status line.

**A material per scene.** `holo/material.ts#createMaterial(id)` builds a fresh
`ShaderMaterial` for an effect on every call (`compileEffect` plus the shared
`VERTEX_SHADER`), and the scene that asked owns it: `setSelection` swaps it in
and frees the one it replaces, and `dispose()` frees the last. Nothing is
cached, because nothing would be saved: three.js keeps its program cache on
the `WebGLRenderer`, every scene builds its own renderer and force-loses its
context on `dispose()`, so each card links its program anyway, and
`compileEffect()` costs about 0.016 ms. The module-level cache this replaced
(`program-cache.ts`, until 2026-09-25) shared one material, and so one set of
uniforms, across every scene on an effect, and outlived them all, so the
remote had to free it on unmount through a three-free shim. A build failure
logs `holo.compile-failed` and falls back to `basic`; if `basic` itself fails,
`createMaterial` returns `null` and `HoloCard` drops to the plain image.

**Four gotchas that cost real time on this branch** — none of them are
caught by any unit test, and each one is silent to a visitor (wrong colors, a
black screen, or a foil that quietly drops to the plain image) rather than an
error if you get it wrong:

- `shader/compile.ts` emits **no `#version` directive**. three.js prepends
  `#version 300 es` itself whenever `glslVersion: '300 es'` is set on the
  `ShaderMaterial` (`material.ts`'s `buildMaterial()` sets it). Emitting one too
  produces a duplicate directive — a GPU compile error, and one nothing in
  this plan's test suite can catch, because a `ShaderMaterial` is an inert JS
  object until a real GPU compiles it. `shader/compile.test.ts` pins this by
  asserting `compileEffect(...)` never contains `'#version'`.
- An element's **first layer's `blend` is ignored** by the generator
  (`shader/compile.ts#layerCode`): layer 0 seeds the stack (`stack = src`),
  every later layer blends onto it (`stack = blendWith(layer.blend, stack,
src)`) — there is nothing beneath the first layer within its own element to
  blend _with_. This mirrors CSS `background-blend-mode`, where the bottom
  image's blend mode is likewise a no-op. `holo/effects/index.test.ts`'s
  registry test enforces the convention anyway, asserting
  `layers[0].blend === 'normal'` for every effect, so a non-`'normal'`
  first-layer blend — which would silently do nothing — is at least a
  failing test instead of a wrong picture.
- The vertex shader **flips `vUv` to y-down** (`shader/base.ts`'s
  `VERTEX_SHADER`: `vUv = vec2(uv.x, 1.0 - uv.y)`), because three.js's
  `PlaneGeometry` is y-up but every consumer of `vUv` — the clip insets and
  stage cut-out in `regions.ts`, every effect's `fromTop` offset, and the
  CSS-derived gradients they all come from — is authored y-down. Every
  texture the generated shaders sample therefore has to agree: both the
  shared generated textures and the per-card art texture set
  `flipY = false` through `scene.ts`'s `orientTexture()` helper, undoing
  three.js's own default of `flipY = true`. Get either half of this wrong —
  the vertex flip, or a texture's `flipY` — and every effect mirrors
  vertically, or the card art does; no unit test renders a frame, so nothing
  catches it but eyes on a real card.
- **A canvas never hosts a second scene.** A scene's `dispose()` calls
  `renderer.forceContextLoss()` (it must: browsers cap live contexts near
  16), and from then on `getContext()` on that canvas returns the same dead
  context. three.js's `WebGLRenderer` constructor throws on it (`Cannot read
properties of null (reading 'precision')`), `HoloCard` logs
  `holo.unavailable`, and the foil is gone. The normal/reverse toggle shipped
  like that, dying on the first click, and the context-restore path had done
  it since v1. So `HoloCard` keys its `<canvas>` on `holoCanvasKey` — every
  input a scene is built from — and its scene effect re-runs on that key
  alone: every rebuild (toggle, restore) mounts a fresh canvas. Its
  context-loss listeners live in that same effect run, on that run's canvas,
  closing over that run's scene, and come off before `dispose()`. The
  force-lost canvas's `webglcontextlost` is delivered a task later, after the
  next scene already exists, and must reach nothing. `canvas-key.test.ts`
  pins the key; the lifecycle needs a GPU smoke pass: toggle
  `/card/swsh3-25` (a scene on both sides) and `/card/swsh3-3` over and over,
  and lose/restore a live context with `WEBGL_lose_context`.

**The holo chunk is lazy** — `HoloCard.tsx` only ever imports `./scene`
dynamically (`void import('./scene')` inside an effect, gated by
`supportsHolo`); the only _static_ reference to it anywhere is
`import type { HoloScene } from './scene'`, which `verbatimModuleSyntax`
erases at compile time. That keeps three.js out of every grid and list
page — it loads only when a visitor actually opens a card that qualifies
for holo. The cost: a visible beat on first card-open while the chunk fetches
(mitigated by the plain `<img>` staying visible underneath until the scene
reports `active`) and a second WebGL/three.js dependency graph to keep an eye
on when bumping the `three` version.

**Verifying the split hasn't regressed:** nothing in the build warns you if
three.js gets folded back into the entry — nobody would notice until every
grid page got slow. Check after any change under `src/holo/` or `src/App.tsx`:

```bash
pnpm --filter @ncam/holodex build
grep -l -F 'THREE.WebGLRenderer' dist/assets/*.js
```

The marker is a string inside three.js's own error messages, so only three.js
itself carries it. The class names alone (`ShaderMaterial`, `WebGLRenderer`)
are not safe to grep for: the SSR build is not minified and keeps doc
comments, and `canvas-key.ts`'s mentions `WebGLRenderer`, which made that
pattern match a third, three-free chunk.

**Expect exactly two matches, not one.** `dist/assets/` holds both build
targets: every file `dist-ssr/assets/` produces also lands, byte-for-byte
identical, inside `dist/assets/` alongside the client build's own chunks
(verified by diffing every `dist-ssr/assets/*` file against its same-named
`dist/assets/` copy — content matched in every case). So a clean build always
matches the client's own lazy chunk (e.g. `scene-CV7FdEfe.js`) _and_ the copy
of the SSR build's own, much larger lazy chunk that `dist/assets/` also holds
(e.g. `scene-BdTnh01B.js` — the SSR build is not code-split the same way).
Two is healthy; a count that is not two, after a change under `src/holo/` or
`src/App.tsx`, is the signal to chase. To check only the client's own
bundle — the one that actually matters for "never loads for a grid/list
visitor" — exclude the SSR copies by filename:

```bash
comm -23 <(grep -l -F 'THREE.WebGLRenderer' dist/assets/*.js | xargs -n1 basename | sort) \
         <(ls dist-ssr/assets | sort)
# exactly one file: the client build's own scene-*.js
```

If either count changes, something started importing `holo/scene`,
`holo/shader/*` or `holo/effects/*` at module scope (outside a dynamic
`import()`) — trace it from there.

## Bundle budget (§10) — measured 2026-09-22 at `d12c296`, fresh `pnpm --filter @ncam/holodex build`

**Lazy chunk re-measured 2026-09-25 at `618d32c`**, after the eight Scarlet &
Violet effects and their shaders landed: `scene-*.js` is 545.22 kB raw,
**139.60 KB gz** against the 170 KB budget — a pass with 30.4 KB of headroom,
up 8.20 KB from the 131.40 below. The main chunk was not re-traced; the
change that made the new effects selectable reported it 0.61 KB gz larger.
The rest of this section is the full measurement as of `d12c296`.

(`dist/` and `dist-ssr/` deleted before the build below, so this is not a
stale-cache figure — see the bundle-history note further down for exactly
why that matters on this branch.)

| Chunk                                                                                                         | Gzip          | Budget      | Verdict                     |
| ------------------------------------------------------------------------------------------------------------- | ------------- | ----------- | --------------------------- |
| Lazy holo chunk, client build (`scene-*.js`: three.js + `holo/scene` + `shader/*` + `effects/*` + `textures`) | **131.40 KB** | < 170 KB gz | **Pass** (38.6 KB headroom) |
| Main remote chunk, excluding React                                                                            | **68.96 KB**  | < 90 KB gz  | **Pass** (≈21 KB headroom)  |

Both read straight off the Vite build report — the same method the
pre-branch baseline used, so the comparison below is apples to apples. Raw
size of the lazy chunk: 520,155 bytes, unchanged to the byte from a prior
measurement of this exact commit. The "main chunk" still is not one physical
file: this measurement re-traced the actual import graph out of
`remoteEntry.js` (not a guess — every `from"./…"` edge between the built
chunks was followed by hand) and found exactly 14 chunks reachable through
`mount()`/`hydrate()`, matching the count this note has always claimed,
excluding the lazy holo chunk, both React chunks, and anything reachable
only through the `./ssr` expose or the standalone `index.html` bootstrap
(neither is `mount()`/`hydrate()`):

| Piece                                                                                                                                                                                                                                                              | Gzip     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| App code — `App.tsx`, views, components, `lib/tcgdex.ts`, `lib/queries.ts`, route parsing/control, react-query, React itself, and the eagerly-imported `holo/select.ts` + `regions.ts` + `capability.ts` + `showcase.ts` + `use-reduced-motion.ts` + `teardown.ts` | 36.02 KB |
| `@module-federation/runtime` + remoteEntry/exposes/shared-scope glue                                                                                                                                                                                               | 26.32 KB |
| Inlined compiled Tailwind CSS + the `mount.tsx` _and_ `hydrate.tsx` entries + `lib/ssr-state.ts` (hydrate needs it to read the dehydrated cache) + `teardown.ts`'s tiny wrapper                                                                                    | 6.62 KB  |

(Gzipping each chunk separately and summing is a conservative overestimate —
served together they'd compress a little better than this.) The remote's own
React copy (`react-dom/client` + its small facade chunk) is **66.36 KB gz**,
not itself budgeted by §10 and effectively flat against the ≈66.4 KB gz
figure recorded before this branch.

**Bundle history on this branch, so nobody chases a ghost.** The lazy-chunk
number moved twice, and both moves are fully explained — neither is drift:

1. At `62e91f5` (Task 11) it appeared to _drop_ to 82 KB gz — a large
   improvement in a branch that had just added 22 shader strings. It had not
   shrunk; it had **split**. That commit reached `disposeMaterials` through
   `void import('./holo/program-cache')`, which gave `program-cache.ts` its
   own chunk, and Rollup made that chunk the shared three.js core instead of
   folding it into `scene.ts`.
2. At `d12c296` (this task's starting commit) the split is gone: the
   teardown fix routes disposal through the three-free `teardown.ts`
   instead, so `program-cache.ts` is once again reachable only from
   `scene.ts`, and Rollup merged them back into one chunk. If a future
   measurement here shows roughly 82 KB, or two three.js-shaped chunks in
   the client build, that is this split recurring — or a stale `dist/` from
   before `d12c296`. Delete `dist/` and `dist-ssr/` and rebuild before
   trusting any number that looks like either.

Neither shim is left: since 2026-09-25 each scene owns its material ("A
material per scene"), so there is no cache to free on unmount and
`teardown.ts` is gone. Nothing outside `scene.ts` reaches the holo chunk's
modules any more, statically or dynamically. The measurements above still
name it because they describe the build as it was.

Against the pre-branch baseline (126.49 KB gz lazy, ≈69 KB gz main, both by
the same Vite-build-report method) this measurement is +4.91 KB on the lazy
chunk — consistent with "expect it to grow by a few KB" from 22 compiled
shader strings — and flat on the main chunk. Gzip size is somewhat
tool-dependent: re-gzipping the identical 520,155-byte lazy-chunk file with
`gzip -9` (129,316 bytes), Node's `zlib.gzipSync` at level 9 (130,019 bytes)
and at level 6 (130,439 bytes) each landed within about 1 KB of each other
but none reproduced Vite's own reported 131.40 KB exactly. That is expected —
different DEFLATE implementations are not required to produce byte-identical
output — and it does not reflect any actual code difference, since the raw
byte count of the file matches exactly regardless of which measurement made
it in. This note uses Vite's own report throughout, because that is what
running the command above actually prints, with no extra tooling required to
reproduce it.

If a budget is ever missed here, the fix is a spec-level decision (three.js
vs. OGL vs. raw WebGL2 behind the same `HoloScene` interface, design §2) —
report it, don't just swap the library.

## Tests are DOM-free

The repo has **no jsdom dependency anywhere**; the root `vitest.config.ts` runs
everything under `environment: 'node'`. Rather than add jsdom for this one app,
every tested module takes its browser dependency as an **injected parameter**
instead of reaching for a global:

- `lib/collection.ts` takes a `Storage` (so a test can pass an in-memory fake,
  including one that throws on write).
- `holo/capability.ts#supportsHolo` takes a `HoloProbe`
  (`matchMedia` / `hardwareConcurrency` / `createContext`) instead of touching
  `window`/`navigator` itself; `browserProbe()` is the one real implementation,
  itself untested (it's a one-line adapter, not logic).
- `fetch` is `vi.stubGlobal`-mocked in `lib/tcgdex.ts` tests — nothing touches
  the network.
- `holo/textures.ts` splits _what_ it paints from the painting. Pure, tested:
  the seeded PRNG (`mulberry32`), the whole `iri` texture as bytes, the
  `birthday` stars' shape, sizes and hues, the ball lattice, and the wrapped
  copies that make each texture tile. Browser-only and untested: the canvas
  calls, including the ball glyphs' internal drawing, whose geometry
  (`GLYPH` and `BALL_RADIUS`) was measured off the reference's
  pokeball/masterball mask images and checked by scanning the rendered
  textures the same way in a headless browser. `scene.ts` binds a
  generated texture only when the selected effect samples it
  (`texturesUsedBy`), through `SHARED_TEXTURE_UNIFORM`, which `scene.test.ts`
  holds against the samplers `shader/sources.ts` declares.
- Views are tested as markup. `views/*.test.ts` render a view with
  `renderToString` under node — no DOM needed, since no effect runs —
  through `views/render-view.test-util.ts`, which wraps it in App's two
  providers and seeds cards straight into the query cache. That is how the
  effects page is held to rendering every (rarity, era arm) once, to exactly one
  `HoloCard` among its 90 cards whichever is live, and to handing `variant` on
  to it (each read back off the HoloCard root's `data-effect`), and the card
  page to ignoring a `?variant=` for a printing the card lacks: `reverse` on a
  card with no reverse printing, `masterball` on one TCGdex lists no Master
  Ball printing for.

**Not unit-tested, by design:** the three.js scene, the GLSL shaders and
`HoloCard`'s canvas lifecycle (a fresh canvas per scene; context loss and
restore) — jsdom has no WebGL2 and this repo has no jsdom regardless. They sit behind
`capability.ts` (which is tested) so a visitor who can't run them never loads
them, and they're checked by hand (`pnpm --filter @ncam/holodex dev`, open a
card, confirm the holo reacts to the pointer). `/effects` puts every effect's
three example cards on one page for that: click through the tiles. A selected
tile whose card TCGdex serves without an image says so, since there is no art
for the foil to render on.

**Comparing an effect with the reference** is done headless, not by eye in a
pane: Playwright 1.58 from the pnpm store (1.63 is there too, but 1.58's
Chromium, build 1208, is the one cached) renders WebGL2 with no window. For
each card, screenshot this app's card page (`/card/<id>`, plus
`?variant=reverse` for a ball holo, after checking the root's `data-effect`)
and `https://poke-151.simey.me/?poke=<card number>` (`?poke=` takes
comma-separated numbers) at the same fractions of the card. What made the
numbers trustworthy on this branch:

- **Swap the reference's `<img>` for TCGdex's art** (`.card__front img`)
  before the capture, so the two differ in effect and nothing else.
- **Keep the pointer moving** while the springs settle: the reference's
  `interactEnd` fires 500 ms after any bubbled `mouseout` and is never
  cancelled, so a parked pointer lets its card snap back to rest.
- **Decompose with injected CSS** (`display: none` on `.card__glare2`,
  `.card__shine::after`…, or a z-index override) to find which layer
  differs, and compare region statistics (10th percentile, median, 97th of
  luminance) rather than eyeballing. A region that saturates at 255 in both
  says nothing about contrast.
- Expect ~6/255 of run-to-run noise in the reference: its `--seedx/--seedy`
  are random per page load. So is a Poké Ball: the demo reverses a Common or
  Uncommon on half its loads, and makes one reverse in five a Master Ball,
  so reload until `.card`'s `data-rarity` ends in `pokeball holo`. Only 1,
  4, 7, 25, 133, 144, 146 and 161 are Master Ball every time.

**For the 22 older effects, the reference is poke-holo.simey.me**
(pokemon-cards-css), and every foil card there is `.masked`: it draws the
card's own foil mask, which ours never has. So take any one of its cards,
remove `masked`, pin `--mask`/`--foil` to `none`, set its `data-rarity`,
`data-subtypes` and `data-supertype` to the effect and card being compared,
and put our card's art in its `<img>`: it then draws exactly the unmasked CSS
the ports come from. Pin its pointer variables with `!important` rather than
hovering (two captures then differ by 0.00, where hovering ones differ by
~11), at its own tilt for that pointer (Card.svelte:
`rotateY(-(x - 50) / 3.5)`, `rotateX((y - 50) / 3.5)`). And address it by a
mark of your own: a Playwright locator by `data-rarity` re-queries on every
use, and finds the next card once you change it.

What the glare ports showed (2026-09-25): a whole-card gap measures the
derived shines far more than the glares, and luminance statistics cannot see
saturation (a washed-out card can score close). Compare **glare only**
(`.card__shine { display: none }` on the reference, `shine: []` on ours) and
against a **floor** with the glare hidden too. Across six samples the floor
was 2.40 and the glare-only gap 3.09: five match within the floor, and
cosmos-holo sits 3 to 6 over it, the cost of soft-lighting its `:after` onto
a radial whose transparency is already folded (a DSL layer has no alpha).
Porting made secret-rare's and radiant-holo's whole-card gaps grow (to about
30 and 23), though their glares alone match the reference: those two
effects' by-eye shines differ from the reference's. secret-rare's
desaturated `lighten` erases the ported glare's darkening, whatever the
stacking (painted above instead, it still measured 27); radiant's
colour-dodge amplifies the glare it now lies beneath (above, 15 to 18). A
shine re-port is what would close either.

Computed layout and scrolling need a browser too, so these are smoke-pass
checks, not unit tests: every effects tile the same height across all 30
sections (a fixed caption — the name clamped to two lines and always two lines
tall — under the fixed 63/88 art); a section the URL names scrolling into view
on navigation, instantly on the landing and under reduced motion, and never for
a card clicked on the page; and every page at least one viewport tall, footer
at the bottom (Shell's `min-h-screen`).

## Run standalone

```bash
pnpm --filter @ncam/holodex dev        # http://localhost:9007, mounts #app
pnpm --filter @ncam/holodex typecheck
pnpm --filter @ncam/holodex build      # dist/remoteEntry.js + dist-ssr/remoteEntry.ssr.js
pnpm --filter @ncam/holodex preview
```

Standalone dev exercises the real `mount`/`routes` code path end to end
(`standalone.tsx` wires `window.history` + `popstate` itself), so sets → set →
filter → page → card → holo → collection → back all work with no host running.

## Notes

- **Self-contained**: React is bundled, `shared: {}` via `@ncam/mf-remote`. Do
  not add react/react-dom to `shared`. React is pinned to exactly `19.3.0`
  (also `@types/react` / `@types/react-dom`) — a second copy at a different
  version is the one thing that breaks federation here.
- **MF remote name / project id / route are all `holodex`** (single word —
  already a valid JS identifier).
- **One `QueryClient` per mount / per SSR request** — never a module-level
  singleton, or a second visit (or a second concurrent SSR request) would
  inherit stale cache from the last one.

## Verify

```bash
pnpm --filter @ncam/holodex typecheck
pnpm --filter @ncam/holodex build   # emits dist/remoteEntry.js and dist-ssr/remoteEntry.ssr.js
pnpm --filter @ncam/holodex dev     # standalone on http://localhost:9007
pnpm run ci                         # lint, format:check, typecheck, test, build — whole workspace
```
