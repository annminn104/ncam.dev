# AGENTS.md — apps/holodex

Holodex — a **Pokémon TCG database explorer** on the TCGdex API: browse every
series, set and card, filter by type and rarity, search globally, track a
collection, and inspect a card rendered with a three.js WebGL holo foil keyed
to its rarity. React 19 + Vite 8 + Tailwind CSS v4 + TanStack Query + three.js,
packaged as a **self-contained** React Module Federation remote (same model as
`apps/bali` / `apps/viktor` / `apps/mindloop` / `apps/immersive-ocean`).

**Current state: implemented.** Mounted by the portfolio host at
`/projects/holodex/...` via the host-owned, route-aware remote contract (see
"What it exposes" below); also runs fully standalone on `:9007`.

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
- **In the host, every navigation resets the window's scroll.**
  `ProjectStage`'s `onNavigate` calls `router.navigate` with no `resetScroll`,
  which TanStack Router defaults to true (`resetScroll ?? true` in
  router-core), so state inside a view that goes through `onNavigate` jumps
  the page to its top: the effects page's card picks did, until they stopped
  navigating (2026-09-25). Standalone dev never shows it, as
  `standalone.tsx` only pushes history, so check scroll behaviour through the
  host.
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
  for `sets | set | search | card | collection | effects | not-found`, plus
  filter (`q`, `type`, `rarity`, `page`) parsing. The root is the effects
  page, the default (the logo goes there, `Shell`'s `HOME`), and the sets
  list is `/sets`.
- `src/route-controller.ts` — route store outside React (see above).
- `src/App.tsx` — one `switch` over `Route` into a view; wraps everything in
  `QueryClientProvider` + an error boundary keyed by route so a bad view can't
  wedge the whole app.
- `src/lib/tcgdex.ts` — the TCGdex client (gotchas below). `src/lib/queries.ts`
  — react-query keys/options, single source of query config. `src/lib/images.ts`
  — quality-suffixed asset URLs. `src/lib/asset-proxy.ts` — Holodex's own
  route to TCGdex's art for the WebGL texture (gotchas below), served by
  `api/tcgdex-asset.ts` deployed and by a plugin in `vite.config.ts` in dev
  and preview. `src/lib/collection.ts` — the localStorage
  owned/wishlist store. `src/lib/ssr-state.ts` — dehydrated-cache
  serialise/read for the `<script type="application/json">` handoff.
- `src/components/` — `Shell`, `FilterBar`, `Pager`, `CardGrid` / `CardTile` /
  `CardImage`, `StatPanel`, `PricePanel`, `CollectionToggle`, `ErrorBoundary` /
  `ErrorPanel`, `Skeleton`.
- `src/views/` — `SetsView`, `SetView`, `SearchView`, `CardView`,
  `CollectionView`, `EffectsView`, `NotFoundView` — one per `Route` case.
  `EffectsView` (the default page, at `/` or `/effects`, and
  `/effects/<effectId>`, `/effects/<effectId>?card=<cardId>`) gives every
  `EffectId` a section of its own, with the rarities that select it and three
  real cards — 30 sections, 90 cards; exactly one card on the whole page
  renders a live `HoloCard` at a time, the other 89 are plain art. The route
  names the live card on arrival; hovering a card (after a 150 ms rest, so a
  sweep across the grid builds no scene per tile), focusing it or tapping it
  makes it live without changing the URL (`effect-gallery.ts#liveSelection`,
  and see the scroll note above). A rarity whose effect depends on the
  card's era appears in both its sections, each chip qualified by era
  ("Rare · Scarlet & Violet, Mega", "Rare · before Scarlet & Violet").
  `basic`'s section says in a note beside its rarities that it draws no foil.
  A section fetches its three cards only once it comes within 600px of the
  viewport (the live section at once): landing on `/` asks TCGdex for nine
  cards, where all 90 at once, reloaded a few times, got the visitor refused
  (every request a 404 without CORS headers) for about 20 minutes.
- `src/holo/` — eager (statically imported by `HoloCard.tsx`, so part of the
  main chunk): `select.ts` (rarity/layout/printing → `HoloSelection`),
  `regions.ts` (`ClipShape` and the card's `CardLayout` → inset rect, cut-out
  boxes and `coversPoint`), `capability.ts`
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
  per `EffectId`, plus the `index.ts` registry; `css.ts`, which converts the
  reference CSS every effect is ported from; and `legacy-glare.ts`,
  `v-family.ts` and `rainbow-family.ts`, what the older effects share — see
  "Two families of effects" below).
- `src/styles/globals.css` — Tailwind v4 entry: `@theme` holo palette tokens
  (`--color-holo-bg/panel/line/text/muted/accent`) and the `.holodex` root
  class, applied instead of `<body>` so the remote never repaints the host page.
- `src/mount.tsx` / `ssr.tsx` / `hydrate.tsx` / `standalone.tsx` + `index.html`.
- `api/tcgdex-asset.ts` — the one Vercel Function, the asset route deployed.
  `vercel.json` is the other remotes' (static Vite build, `dist`, a blanket
  `Access-Control-Allow-Origin: *`) with `/api/` left out of that header: the
  route sets its own, and one more would double it.

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
- **The asset CDN doubles its CORS headers, so the texture goes through our
  own route.** Since 2026-09-25 `assets.tcgdex.net` sends every file with two
  `Access-Control-Allow-Origin: *` headers (two Cache-Controls as well; a
  missing file comes back typed `text/html, image/webp`), and a browser
  refuses a doubled Allow-Origin outright. A plain `<img>` asks without CORS
  and never notices, but a WebGL texture must load with `crossOrigin`
  (three.js's loaders ask `anonymous`), so every scene failed its texture:
  `holo.unavailable`, no foil on any card. `scene.ts#setCard` therefore asks
  `GET /api/tcgdex-asset?path=<path under assets.tcgdex.net>` at the root of
  Holodex's own origin first (`BASE_URL` against the scene chunk's own URL,
  so a hosted page, the portfolio's, still asks Holodex), and TCGdex
  directly only if that fails. Each way it asks for the WebP, then the PNG,
  as CardImage does (`HoloCard` hands the scene `imageUrls(base, 'high')`),
  and the route takes both formats before TCGdex takes either
  (`lib/asset-proxy.ts#textureUrls`): a card whose WebP is missing loads its
  PNG on the second request, and only a card with no art at all asks four
  times before `holo.unavailable`. The route
  (`handleAssetProxy`, one handler in both places) fetches the file with
  nothing of the visitor's request and answers with headers of its own:
  one Allow-Origin, the type the path's extension names (never TCGdex's),
  `nosniff`, a year's cache; 404 for a missing file (cached an hour), 400
  for any path that is not a TCGdex image (a language, then segments that
  start with a letter or digit, so no `..`, then `.webp`, `.png` or `.jpg`),
  502 when TCGdex fails. Card tiles, CardImage and the LQIPs stay on TCGdex
  itself. Check the header yourself with an Origin on the request, since
  what TCGdex sends has changed under us before:

  ```bash
  node -e "fetch(process.argv[1],{headers:{Origin:'http://x'}}).then(r=>console.log(r.status,r.headers.get('access-control-allow-origin')))" 'http://localhost:9007/api/tcgdex-asset?path=en/swsh/swsh1/14/high.webp'
  ```

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
new set with an odd id needs the same check against its series). Four
overrides apply on top, in order: (1) a `Promo` with a `suffix` (V, ex, GX…)
is a holo chase card, `ex-regular` in the modern era and `v-regular` before;
(2) an `Ultra Rare` Supporter before Scarlet & Violet is a full art trainer,
`trainer-full-art`, as pokemon-cards-css draws every rare ultra Supporter
with `trainer-full-art.css` (loaded after `v-full-art.css`, whose Supporter
rules it overrides), in a gallery or out of one: TCGdex files Sword &
Shield's full-art Supporters as Ultra Rare, Marnie's and the Trainer
Gallery's alike, and only six as `Full Art Trainer`; (3) a card number
matching `/^[tg]g/i` is a trainer-gallery printing and remaps its base
effect to one of four gallery variants (`galleryEffect`), which keeps a
full art trainer as it is and gives an `Ultra Rare` Pokémon its V family's
gallery look by its name, as the reference draws the Rare Holo V, VMAX and
VSTAR that pokemontcg.io, its data, files these cards as: a V
`trainer-gallery-v-regular`, a VMAX `trainer-gallery-v-max`, and a VSTAR
`v-star`, as no gallery stylesheet names a VSTAR; (4)
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
resolved effect and the card's `category`/`stage` — order matters, since `radiant-holo`
must claim `borders`, and `amazing-rare` the art
window (`regular`, whatever the card's stage, as its unmasked CSS sets
`--clip`), before the full-art and trainer rules would otherwise take them.
`trainer-gallery-holo` takes `regular` or `stage` on a Pokémon, by its
stage, on a gallery holo's frame (below), and `borders` on anything else.
`illustration-rare` takes `regular` or `stage` by the card's stage, on its
rarity's own full-art frame (below), and `trainer-gallery-v-regular` and
`trainer-gallery-v-max` `regular` on a gallery V's or VMAX's (below). The
other gallery effect, `trainer-gallery-secret-rare`, is full art, as its
CSS's shine covers the whole card, and so is `cosmos-holo`, by the owner's
choice (2026-09-25), though its CSS keeps the shine to the card's own region:
a Black White Rare is foiled over the whole card. `ex-regular` (a
`Double rare`, the standard-layout ex) must never be `full`: its reference
confines its foil with a per-card mask we do not have, and the geometric art
window stands in for it, inverted (below).

**Two families of effects, both ported.** The 22 older effects come from
[simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)
(poke-holo.simey.me), the eight Scarlet & Violet ones (`ex-regular`,
`ex-full-art`, `illustration-rare`, `ex-special-illustration-rare`,
`hyper-rare`, `poke-ball-holo`, `masterball-holo`, `sv-rare-holo`) from
[simeydotme/pokemon-cards-151](https://github.com/simeydotme/pokemon-cards-151).
Every port goes through `effects/css.ts`, which converts CSS instead of
copying numbers (a CSS `200%` makes an image bigger where a DSL size makes it
repeat) and lists the approximations every port shares; each port lists its
own. The reference's per-rarity CSS is not the whole of it: 151's
`public/css/cards.css` holds `--angle`, `--space`, every texture variable and
its clip regions; each reference's `src/lib/components/Card.svelte` holds
the pointer maths; and pokemon-cards-css's sets `--foil`, `--mask`,
`--cosmosbg` and the seeds inline on `.card__front`.

The 22 were first _derived_ by eye, their numbers carried across as they
stood; on 2026-09-25 (the owner's call) both their halves were ported
instead. **Glares:** each is its rarity's `.card__glare` (and `:after`),
through `css.ts` and `effects/legacy-glare.ts` (base.css's radial, the
neutral a transparent glare folds toward, source-over for reverse-holo's
unblended `:after`), drawn with CSS's own `farthest-corner` geometry (the
Source's `cssBox`, which grows as the pointer leaves the middle) and stacked
beneath the shine (below); `legacy-glares.test.ts` holds each to a table
copied by hand from its CSS. **Shines:** each is its rarity's `.card__shine`
with its `:before` and `:after`, on the reference's unmasked path (the CSS a
card with no foil mask draws, since ours never has one), as one group with
children, exact gradients and CSS's own filters (the DSL, below), over
textures drawn here (`textures.ts`: by the owner's licence terms, none of the
reference's images is copied). `v-family.ts` builds the shine the V family
shares, and `rainbow-family.ts` the rainbow rares' colours and glitter box;
`legacy-shines.test.ts` holds every shine to values copied by hand from its
CSS, and `unchanged.test.ts` pins the shaders a port must not move. Measured
against the reference, 13 of the 21 that draw a scene match it within the
floor (the gap left between two cards that draw no effect at all); with the
glare hidden on both sides 19 do, and the other two miss by 0.2 or less. The
rest is glare (see "Comparing an effect with the reference"). The Scarlet
& Violet ports predate groups and fold their pseudo-elements into flat
layers on the RGB path; moving them onto groups, re-checked against
poke-151, is a sub-project of its own. `basic`'s port shows only as the
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
`RegionRect` — fractions of the card — plus up to four boxes cut out of it
(`cutsFor`, `MAX_CUTS`; two until a gallery VMAX's frame needed a third, three
until an illustration rare evolution's ring, tab, band and the ring's flare
into the band needed a fourth). `borders` and `full` are the reference's CSS `inset()`
percentages on every card, and `trainer` too but where a layout measured its
own (Scarlet & Violet's). `regular` and `stage` are the art
window of the card's **layout** (`CardLayout`), the frame it is printed in,
which `select.ts#layoutOf` reads off its set (a table checked against all
220 TCGdex sets: each series' in its own frame, the trainer kits, POP Series
and McDonald's collections in their era's) or, for the three frames a rarity
brings, its rarity (LV.X, Prime, LEGEND), and Platinum's SP Pokémon by the
title their names end in, and a Scarlet & Violet, Mega or Pocket ex by the
` ex` its name ends in (`modern-ex`; TCGdex's `suffix` misses some). The
boxes are what that frame prints over the art: the evolution badge, disc or
banner of a `stage` card, a Diamond & Pearl or HGSS Basic's BASIC banner, an
SP's owner portrait. Every window and box was measured off TCGdex's scans
(2026-09-25; regions.ts says how) — the reference's `--clip` is a Sword &
Shield card's, and on an HGSS card, say, left the art's outer 3% and bottom
4.6% bare. Sword & Shield keeps it, with its `--clip-stage` polygon as two
boxes, banner and picture. Scarlet & Violet and Mega share one frame
(`sv`), whose art sits within half a percent of that `--clip` (pokemon-
cards-151 kept it for them) but whose evolution picture and band are much
smaller than the `--clip-stage` cut, which had taken the art's top-left.
Its picture is cut as the **circle** its silver ring is, not a box
(`CutBox.oval`, the ellipse its box holds; `uCutOval` in `coverage()`):
151's masks (Raichu's, Beedrill's) leave the ring out and foil the art right
up to it, where the box took the art in its corner, a square patch beside the
ring (Raichu, 2026-09-26). The ring's outer edge, off the averaged edges of
fourteen 151 evolutions' scans, is a circle of 47.75 px on a 600 by 825
scan, within 1.3 px of every ray where the art meets it. The ring also
overlaps the silver border, which the masks leave bare there too, so an
oval takes a bordered foil's border off as well, where a box, a banner,
stops at the art. `compile.test.ts` walks each oval's box on a fine grid,
border and all; the card-wide one is too coarse to be sure of its curve.
Its "evolves from" band is cut to its **slanted end** (`CutBox.slant`, the
box's right edge leaning from x1 at its top to x1 + slant at its bottom;
`uCutSlant`) and no lower than its underside (`SV_BAND`: 9.3% to 11.55% of
the card down, its end leaning from 68.5% to 65.4% across, off the averaged
edges of both frames' scans and the masks). The square box before it missed
the band's top-right tip, took the art past its slant, and a strip of art
0.75% of the card tall under all of it: over the band's surroundings the
masks now agree on 92.7%, from 83.1% (96.4% from 87.9% on the illustration
rares, which share the band). Where the ring meets the band's underside its
rim flares past `SV_RING`, 0.9% of the card wide at the band and narrowing to
nothing 1.55% lower, which the band's box hid while it reached too low:
`SV_JUNCTION`, a slanted box whose end follows the flare's edge and whose
bottom corner sits on the ring's, so it leaves no corner of its own. Over
that corner of the art the masks agree on 96.9% and 98.0%, from 94.5% and
93.2%, and none of the rim takes foil.
Pocket's (`pocket`) is the same window with an octagon, and its band, the
One Star's too, is cut to its own slanted end and underside (`POCKET_BAND`,
off the averaged edges of 24 Genetic Apex evolutions' scans, no mask showing
a Pocket card), where the square boxes took the art past the slant and
under the band (2026-09-26). `other` (Pokémon
Rumble, the energies, the sets without art) keeps the reference's clip and
the one step-cut every evolution had before. A LEGEND half, all art, keeps
its foil to the border. `coversPoint(shape, x, y, invert, layout)` is the tested twin
of the GLSL `coverage()` in `shader/base.ts`, which reads the same numbers
as uniforms (`uClipRect`, `uCutA` to `uCutD`, `uCutOval`, `uCutSlant`, set by `scene.ts`, all zeros for
a box the region lacks): `compile.test.ts` runs the emitted GLSL itself
against it on every layout. The layout rides on `HoloSelection`, so
`holoCanvasKey` reads it. Measure a new frame the same way — averaged edge
maps, then the zoomed corners by eye — rather than copying another's
numbers: the frames differ by several percent, and a stage box that fits
one cuts art out of the next.
Everything else (basic, regular-holo, full-art effects, …) confines its
foil _inside_ the region — a window over the art. `reverse-holo` is the one
case that flips `invert` to `true`, painting the foil _outside_ the region
instead (the card's border and text box), because that is what a real
reverse-holo print actually looks like: foil everywhere except the art. The
151 ball foils invert the same way, and so does `ex-regular`, whatever the
printing (`select.ts#INVERTED`, the owner's call, 2026-09-25): its
reference's per-card masks, a Double rare's own foil layer, let the foil
through everywhere but the Pokémon, and against six of 151's the card less
its ex frame's art matched two thirds of each mask, where the art window
alone, which it took until then, matched a fifth (`modern-ex`: the
illustration border to border down to the silver bar over the text).
Measured against the masks the poke-151 demo loads
(`poke-holo.b-cdn.net/foils/151/foils/<set>_en_<number>_std.foil.webp`),
analysis only: none is kept or copied. The same masks foil a Scarlet &
Violet Rare holo's silver border besides its art (Beedrill's and Raichu's
`std`), so `sv-rare-holo` takes the border too, whatever its layout
(`select.ts#BORDERED`, the owner's call, 2026-09-25): `HoloSelection.border`
adds everything outside the `borders` rect to the region, `uBorder` in
`coverage()` (all zeros, a rect holding the whole card, for none), and
`coversPoint`'s `border` its twin. Toggling `uBorder` on a live card
changes the border alone (frame, art and text box by exactly 0), and the
reference's own Raichu darkens its border under the shine the same way.
That rect's corners are **rounded** as the card face's own
(`regions.ts#BORDER_ROUND`: 1.1% of the width by 1% of the height,
`uBorderRound`, zeros for none): the same two masks fill the wedge each
rounded corner of the face leaves inside the rect's square one, and a
square ring painted a square notch of foil into the face at every corner
(Raichu's, 2026-09-26). `compile.test.ts` walks each corner on a grid fine
enough to land in the wedge, which the card-wide one never does.

Every effect writes the **scan's own alpha** (`cardAlpha()` in
`sources.ts`), never an opaque 1.0: a TCGdex scan is transparent outside
its rounded corners (RGB black there), and an opaque fragment painted
those corners square, black or lit by the foil and glare. The canvas's CSS
`rounded-lg` cannot stand in for it once three.js tilts the card inside
the canvas.

An element can also carry a **clip of its own** (`Element.clip`, a region's
rect, never inverted, never `stage`), which gates that element alone inside
whatever the effect's region allows: the reference clips some
pseudo-elements apart from their shine. The balls keep their glyphs inside
the silver border (`borders`) while the shine's own dodge reaches it.
`insideRect()` in
`shader/base.ts` draws it, and `compile.test.ts` runs the emitted GLSL
against `coversPoint` as it does `coverage()`. An element's clip is
compiled in, so it knows no layout: its `regular` is the reference's
window, which fits the one element that takes it, radiant-holo's `:after`,
as every Radiant Rare is a Sword & Shield card. An element may also keep to
the effect's own region (`Element.withinRegion`: main()'s `cov`, layout and
inversion included), which a glare needs where its reference clips it: the
ball holos' glare (`--viewport-edge-clip`, the card inside its border less
its art) is `clip: 'borders'` and `withinRegion`, so it spares the art
window the shine spares, and no longer tints the art; `illustration-rare`'s
`.card__glare` shares its shine's `--clip`, so it is `withinRegion` alone.

**The illustration rares' full art.** An `Illustration rare` (Scarlet &
Violet and Mega, 511 cards) and a Pocket `One Star` (200), all Pokémon,
take a frame by their rarity (`sv-illustration`, `pocket-illustration`):
the whole card inside the border, less what the frame prints over the
illustration: the stage tab at the top-left, which pokemon-cards-151's
border polygon cuts as a notch, and on an evolution its pre-evolution
picture and "evolves from" band, which the reference's per-card masks leave
out on all sixteen of 151's Illustration rares (#166 to #181; #182 to #193,
whose masks foil the border, are the Ultra Rare ex). The border rect it took
until 2026-09-25 foiled the tab, and the picture and band; over those frame
parts it agreed with the masks on 90% of the card, the frame now on 99.5%.
The picture is its ring, the regular frame's `SV_RING` oval (the ring sits
within a quarter pixel of it on the averaged edges of the eight evolutions'
scans), not the box that took the art in its corner; the tab's box reaches
down to the band on an evolution, where the masks leave out the ring's rim
between the two (a slant a box edge can only split: x 0.17 scored best).
Over the card's top-left, 92.7% of the eight masks agree, from 88.0%
(2026-09-26). Its band is the regular frame's too (`SV_BAND`).

A `Special illustration rare` (232: 167 Pokémon ex and 65 Supporters)
takes its rarity's frame too (`sv-special-illustration`), but that frame
is the whole card: its reference has no clip-path, and all seven of 151's
masks (#198 to #204) foil the border, the tab, the band and the rule box
alike, leaving out the figure, which no box can follow, and on an
evolution the pre-evolution's picture inside its ring, which one cut can:
the disc itself (`SV_PICTURE`), off the twelve Ultra Rare and special
illustration rare evolutions' masks, which agree on it to a thousandth and
line up with TCGdex's scans. It sits up and to the right of the ring's
centre, whose rim is thicker below and to the left. The box it replaced
(2026-09-26) cut the ring's corners and missed the disc's left edge: over
the card's top-left the masks agree with the disc on 91.7%, the box 86.0%.
So `ex-special-illustration-rare` left `FULL_ART` for `regular`, `stage`
and `trainer` on that frame: the whole card, less that picture on a Stage
1 or 2. Over the frame parts the masks agree with it on 96.8% of the card,
where the whole card agreed on 94.5% (the four evolutions 91.6% to 95.6%);
the figure keeps the card as a whole at 80%.

`hyper-rare`, whose CSS is the special illustration rare's with one number
changed, left `FULL_ART` the same way. 151's three gold masks (#205 Mew ex,
#206 Switch, #207 an energy) foil the border and nearly all the gold, but
leave out the silver rule box (17% and 3% of it foiled), so a Scarlet &
Violet `Hyper rare` is the whole card less its rule box: an ex's
(`sv-hyper-ex`, by the ` ex` its name ends in, as every one of the 41
does) or a trainer's (`sv-hyper`, whose trainer region carries the cut:
`LayoutClip.trainerCuts`); an energy has none. Cut, the two agree with their
masks on 66.2% and 79.9% of the card, from 63.6% and 75.0%. A `Mega Hyper
Rare`, whose rule box is gold like the rest of it, and a Pocket `Crown`,
neither with a mask to measure against, take the whole card (`full-card`).

`ex-full-art`, the last of them, left `FULL_ART` too. All sixteen of 151's
Ultra Rare masks (#182 to #197: twelve ex, four Supporters) foil the border,
the tab and the band, but leave out the rule box (27% of an ex's foiled, 4%
of a Supporter's) and an evolution's pre-evolution picture (the same disc,
`SV_PICTURE`; 25% of the box it replaced was foiled). A
Scarlet & Violet or Mega `Ultra Rare` (363: 207 Pokémon, all ex, 155
trainers, one energy) is therefore the whole card less those: an ex's rule
box and picture (`sv-ultra-ex`) or a trainer's rule box (`sv-ultra`), the
cuts the hyper rare and special illustration rare frames measured, which
fit it too; the energy has none. It is the one rarity whose frame is split
by era (`MODERN_LAYOUT_BY_RARITY`): an older `Ultra Rare`, a V or GX full
art on `v-full-art`, keeps its set's frame and its whole-card foil. A Mega
Ultra Rare's rule box is gold, where Scarlet & Violet's is silver, and is
cut as the same frame's box, which no mask shows either way. Over the frame
parts the masks now agree with the region on 89.9% of the card, from 77.4%
(each Supporter 70% to 94.5%). A Pocket `Two Star`, with no mask, takes
the whole card (`full-card`), as before.

**A full art Pokémon's printed title is cut by its ink.** All of 151's
masks for its 34 illustration rare, Ultra Rare, special illustration rare
and Hyper rare Pokémon leave the title's letters out (the name, the HP and
its number) and foil the art round them, and letters differ on every card,
so no box can take them: the scene finds them on the card's own scan
instead. `LayoutClip.ink` lists where it is read, each `InkRead` a box and
how light its ink may run: `TITLE_INK`, from the stage tab to the border
over the title, and `TAB_INK`, the BASIC or STAGE tab, whose grey letters in
their white outline the masks leave out too while they foil the plate round
them, read with anything short of the outline's white as ink (`dark` 180:
the letters' grey runs as light as the plate's, and the plate, running off
the box's edges, is no letter). Both are on `sv-illustration`,
`sv-special-illustration`, `sv-ultra-ex` and `sv-hyper-ex`, for `regular`
and `stage` (the illustration rare's tab is cut whole already); the scene
composes the reads into one texture over the strip they span (`inkStripFor`);
a full art trainer's name, black on the light panel under its Supporter or
Item and TRAINER banner, has its own (`LayoutClip.trainerInk`,
`TRAINER_TITLE_INK`, on `sv-special-illustration`, `sv-ultra` and
`sv-hyper`, for `trainer`). Unlike a Pokémon's title, 151's masks for its
seven full art trainers foil the name with its panel, at about half their
art's foil; it is cut all the same, the owner's call (2026-09-26), so every
full art's printed title reads clean. `ink.ts#findInk` reads
it off the scan when the card or the selection changes (`scene.ts`), keeps
each blob of dark pixels that is a letter's size, stays off the strip's
edges and meets a white outline along most of its edge (a dark background
runs off the edges, and meets the art rather than an outline), and grows it
by its outline, as the masks do; `uInk` carries that mask and `uInkRect`
the strip, and `coverage()`'s `inkAt()` keeps the foil off it. Over the
strips the masks agree with it on 83.4%, from 64.3% with no cut, every card
by 13 points or more; a plain luminance cut took the dark background behind
Charmander's and Psyduck's titles with them, worse than no cut. A scan whose
pixels cannot be read (a tainted canvas) keeps its letters foiled. The
type's symbol at the title's right end is no letter, but a circle at the
same place on every one of the 34 masks, so it is painted into the same
texture rather than read (`InkRead.painted`, `ink.ts#paintInk`), and the
title's read stops 2 px past the HP number, short of it (`SYMBOL`). An
illustration rare's masks leave the whole symbol out, the others' its white
ring alone, 2.4 px wide, foiling the disc inside, glyph and all; painting
that ring (`painted.hole` 0.905) brought the symbol's corner to 84.9% of the
Ultra Rare, special illustration rare and Hyper rare masks, from 65.8%, and
the whole disc the illustration rares' to 84.0%, from 47.6%. The whole disc
is painted on all four frames all the same, the owner's call (2026-09-26),
so no full art's symbol takes foil. A painted shape needs no pixels, so it
stands where a scan cannot be read. A letter can be as short as an i's
dot (`INK.minHeight` 4 px of a 600 px scan), which a trainer's name, with no
outline to grow over its gap, would otherwise leave foiled.

`v-full-art`, the older `Ultra Rare`'s, left `FULL_ART` as well, on the
same evidence from the older reference: `v-full-art.css` has no clip-path,
and poke-holo.simey.me draws its cards with per-card masks
(`poke-holo.b-cdn.net/foils/<set>/masks/upscaled/<number>_foil_etched_sunpillar_2x.webp`),
which keep their foil in **alpha** (their colour is dark throughout), where
151's keep it in luminance: read the right channel, or every pixel reads
bare. Its six V full arts' and three Supporters' masks foil the whole card,
the border included, but leave out the frame's bars: a V's dark weakness
bar and V rule box (89% and 86% of them bare, where the etching leaves
about half of a foiled part bare), and a Supporter's silver TRAINER header
and orange rule box (94% and 92%). So a Sword & Shield `Ultra Rare` is the whole card
less those (`swsh-ultra-v`, by the ` V` its name ends in, or `swsh-ultra`,
whose trainer region carries the Supporter's cuts); a VMAX, VSTAR or energy
there takes the whole card. The black V over a V's top-left is left out by
the masks too, but it is a triangle whose silver outlines do take foil, and
a colour-dodged shine leaves black black, so it keeps the region. Over the
frame's top and bottom bands the nine masks agree with the region on 71.4%
of the card, from 45.7%. An Ultra Rare of the frames before Sword & Shield
(XY's EX, Sun & Moon's GX, Black & White's full arts), with no mask, takes
the whole card (`full-card`), as before. TCGdex's older `Ultra Rare` is not
only full arts: it files some regular EX, GX and V there too (xy1's Venusaur
EX, sm9's Celebi & Venusaur GX, swsh10's Starmie V), which therefore foil
their whole card; a Sword & Shield V's frame is laid out like its full art,
so its cuts land there as well. An `Ultra Rare` Supporter is not
`v-full-art`'s at all but `trainer-full-art`'s (the overrides above), on
the same frames: `swsh-ultra`'s trainer region for a Sword & Shield one,
the Trainer Gallery's included, and the whole card for an older one. A
`Full Art Trainer` takes `swsh-ultra` too, by its rarity: until 2026-09-25
it took the whole card, clipShape's one rule by rarity, now gone.
`trainer-full-art.css` takes no mask off the shine (only v-full-art.css's
`:before`, which the shine's own mask still bounds: its `mask-image`
computes to the card's mask on poke-holo.simey.me's Marnie and Nessa), so
the masks are evidence here, and all 113 Sword & Shield full-art
Supporters' bear the frame out (2026-09-26): the 81 of the main sets leave
out the header and rule box (94% and 92.5% bare), and the region agrees
with them on 79.7% of the frame, from 53.2% for the whole card; the Trainer
Gallery's 16 Ultra Rare Supporters and six Full Art Trainers the same (95%
and 93%; 76.6% and 76.0%, from 50.3% and 49.9%). The Galarian Gallery's ten
are the exception: the same silver header takes foil on their masks (46%
bare), so by its card number (`galleryFrame`) a Galarian Gallery trainer
cuts the rule box alone (`swsh-galarian-trainer`, 71.8% of the frame, where
both cuts made 69.3% and the whole card 56.3%). A gallery `Ultra Rare` Pokémon is not `v-full-art`'s either:
TCGdex files the V, VMAX and VSTAR of three Trainer Galleries and the
Galarian Gallery as Ultra Rare (55 cards; `swsh12tg`'s are Holo Rare V and
VMAX), which pokemontcg.io files as Rare Holo V, VMAX and VSTAR, so each
takes its V family's gallery look (the overrides above). Until 2026-09-26
they took `trainer-gallery-holo`. A gallery V, whatever TCGdex files it as,
then left `FULL_ART` as `v-full-art` had, since `v-full-art.css` styles it
too: all 38 gallery V's masks leave out the full-art V's bars (96% and 98%
bare on the Trainer Galleries' 29, 87% and 85% on the Galarian Gallery's
nine), and the Trainer Galleries' their black border besides (96% to 100%).
That border's inner edge on TCGdex's scans is the `borders` inset (2.8%
4%) to 0.15%, and it is not quite black (about 6 in 255), which a
colour-dodged shine lifts towards grey. So by its name and card number
(`galleryFrame`) a Trainer Gallery V takes the inside of that border less
the bars and the black strip its HP is printed on (`swsh-gallery-v`; the
strip is 100% bare on all 29, and was cut once the shader took a third
box), and a Galarian Gallery V, whose silver border its masks foil, the
whole card less the bars (`swsh-ultra-v`). Over the frame (the border
ring, the top 10% and the bottom 16%) the masks agree with the region on
80.4% and 70.6% of its pixels, where the whole card agreed on 17.0% and
55.0%; over the whole card, whose figures they leave out and no box
follows, on 49.0% and 67.6%, from 28.8% and 62.6%.

A gallery VMAX left `FULL_ART` the same way. `rainbow-alt.css`, which
styles it, has no clip-path, and all 18 gallery VMAX's masks foil the
border, which on a VMAX is no black one, but leave out the header's silver
panels, the VMAX mark over the picture of the V it evolves from (97% bare
on the Trainer Galleries' 15) and the bands naming that V and its Dynamax
(92%), and the same weakness bar and rule box, the VMAX's silver (96% and
98%). So in either gallery it takes the whole card less a box around those
panels, as TCGdex's scans have them, and the bars (`swsh-vmax`):
three boxes, one more than the shader cut before (`uCutC`). Over the frame
the masks agree with it on 58.5% and 63.9%, from 26.5% and 43.0%; over the
whole card on 36.9% and 45.7%, from 24.1% and 38.1% (the Galarian
Gallery's three masks foil its bands, but the box still suits them best of
those tried). The shine's `:after` sets `mask-image: none !important`,
which reads as if it escaped the mask, but the mask on `.card__shine`
itself still confines it: with the `:after` hidden on poke-holo.simey.me,
the pixels its mask leaves bare changed by 0.07 and 0.11, the ones it foils
by 0.99 and 1.06, so the region stands in for the whole shine, as ours
applies. `v-max` left `FULL_ART` for the same frame: `v-max.css` has no
clip-path, takes no mask off its shine (the shine and both pseudo-elements
compute the card's mask on poke-holo.simey.me's Evolving Skies #29), and 82
of the 88 `Holo Rare VMAX` masks (the CDN has no mask for the other six)
leave out the same panels, bands and bars (96%, 83%, 94% and 97% bare),
for which the same header box scored best of those tried. So a `Holo Rare
VMAX` takes `swsh-vmax` by its rarity, and the masks agree with it on 65.7%
of the frame (the border ring, the top 16% and the bottom 16%), where the
whole card agreed on 38.4%; over the whole card on 74.9%, from 64.6%.

A gallery secret rare keeps the whole card (`FULL_ART`), and here the
reference agrees on either path: `trainer-gallery-secret-rare.css` sets
`mask-image: none !important` on the shine and both its pseudo-elements,
so its masks (`…_foil_etched_swsecret_2x.webp`) bound nothing. On
poke-holo.simey.me all three compute `none` on the gallery's Mew VMAX
(`swsh11tg-TG30`), whose mask is loaded, and hiding the shine changes the
pixels that mask leaves bare by 4.42 on average (20.15 where it foils): the
shine lights them. Its masks are no evidence for its region, then, as
they are for every other full art's.

A gallery holo, the galleries' Pokémon that are no V (TCGdex's `Rare`, and
`swsh12tg`'s `Holo Rare`: 80 cards), is clipped by `trainer-gallery-holo.css`
to `--clip-borders` and masked with its card's mask as well (the shine and
both pseudo-elements compute the mask on poke-holo.simey.me's Charizard,
and hiding the shine moves the pixels it leaves bare by 0.45, the ones it
foils by 10.46). Its masks (`…_foil_holo_rainbow_2x.webp`) are solid where
they foil, and all 80 leave out, besides the border the clip takes, the
weakness bar (90% and 91% bare), a Basic's BASIC tab, and an evolution's
picture of what it evolves from (99%) and the "evolves from" band beside
it. So on a Pokémon it takes its stage's window of a frame of its own
(`swsh-gallery-holo`, by `galleryFrame`): the border rect less the tab and
the bar on a Basic, the picture, the band and the bar on an evolution,
each measured off the masks' average. Over the frame (the border ring, the
top 16% and the bottom 16%) the masks agree with it on 85.3% of the
pixels, where the border rect agreed on 76.0% (the Trainer Galleries' Basics
82.1% from 75.2%, their evolutions 83.6% from 71.6%, the Galarian Gallery's
88.8% from 82.2% and 86.9% from 75.3%); over the whole card on 67.7%, from
64.1%. A gallery trainer on it, of which TCGdex has none, keeps the border
rect.

`v-star` left `FULL_ART` too. `v-star.css` has no clip-path, and on its
masked path adds a radial about the pointer to the card's mask (both
layers compute on poke-holo.simey.me's Charizard VSTAR), which lends the
parts the mask leaves bare some foil away from the pointer: hiding the
shine moved them by 0.48, the parts it foils by 4.79. All 32 `Holo Rare
VSTAR` masks (Sword & Shield's, 2026-09-26) foil the card between its
header and its weakness bar alone, inside the pastel border: the header,
its band naming the V it evolves from and the column of its VSTAR mark,
and everything from the weakness bar down, rule box and illustrator's
corner included, are left out. So a `Holo Rare VSTAR` takes a frame by its
rarity (`swsh-vstar`: that rect, less the band and the column), and over
the frame (the border ring, the top 16% and the bottom 16%) the masks agree
with it on 89.9% of the pixels, where the whole card agreed on 10.4%; over
the whole card on 53.6%, from 23.6%. Its gold VSTAR Power bar is left out
too, but sits at one of two heights by the text above it, which no one box
follows. The Galarian Gallery's ten VSTAR foil their silver border like its
V's and leave out the same bars, so they take a Galarian Gallery V's frame
(`swsh-ultra-v`, by `galleryFrame`): 70.7% of the frame, from 59.1%.

**The effect DSL and the generator.** Each of the 30 effect files under
`holo/effects/` (e.g. `cosmos-holo.ts`) is a declarative `Effect`
(`holo/shader/types.ts`): 1-3 `shine` elements and up to two glare elements,
painted above the shine (`glare`) or beneath it (`beneath`), each
a stack of `Layer`s (a `Source` — solid, a gradient, `card`, `scanlines`, or
one of the textures `textures.ts` generates: `glitter`, `grain`, `iri`,
`birthday`, `geometric`, `trainerbg`, `illusion` / `illusion-mask`,
`ancient`, `vmaxbg`, `cosmos-bottom` / `cosmos-middle` / `cosmos-top`, and
the 151 set's `pokeball` / `pokeball-inner` / `masterball` /
`masterball-inner` patterns — plus a `BlendMode`, and optionally an `opacity`
of its own, as a pseudo-element fades inside its element: cosmos-holo's
glare `:after`), an optional pointer-driven `Filter`, its own `mixBlend`,
optionally its own `opacity` and `clip`, and optionally `children`. A radial
converted from CSS also carries its `cssBox` (its centre and image size), and
draws with CSS's `farthest-corner` geometry (`radialCssDistance` in
`sources.ts`, twin `css.ts#radialT`). Numbers can be plain, or
`PointerDriven` (a base plus coefficients over pointer-from-center /
from-left / from-top and the card's foil brightness, evaluated per
fragment). `holo/shader/compile.ts`'s `compileEffect()` turns one `Effect`
into one complete fragment shader — concatenating `base.ts` (varyings, clip
uniforms, `coverage()`, `insideRect()`), `blend.ts` (17 blend modes as GLSL
functions: CSS's sixteen, including the four non-separable HSL ones, and
`plus-lighter`, strictly a compositing operator; and `compositeOver`, CSS's
compositing of a colour with alpha onto another) and `sources.ts` (one GLSL
expression per `Source` kind) around per-effect layer/filter code generated
from the `Effect` data. This is a declarative-description-compiled-to-GLSL
design, not the hand-written GLSL chunks the original plan sketched: the
one deviation from that plan.

**Two compile paths.** An element compiles on the **RGB path** — its layers
blended as opaque colour, each stop's alpha folded toward the colour its
blend leaves unchanged (`css.ts#colorAt`), filtered by `applyFilter` —
unless it needs alpha: children, an exact gradient or a texture with alpha
(`compile.ts#needsRGBA`, `ALPHA_TEXTURES`) put it on the **RGBA path**,
which draws as CSS does. Every layer keeps its alpha and composites by the
W3C rule (the blend weighted by the backdrop's alpha, then source-over); a
group paints its layers, then each child whole (its layers, its filter, then
its opacity and clip on its alpha) by its own `mixBlend`, then filters the
lot and composites it onto the card. The exact gradients (`css-linear`,
repeating or not, `css-radial` and `css-conic`, built by `css.ts`'s
`exact*` converters) put up to 32 stops where CSS puts them, hard edges
included, interpolate premultiplied, and measure a radial's farthest corner
(circle or ellipse, reaching stops past 100%) and a conic's angle (clockwise
from the top, in the card's true proportions) as CSS does. The filter is
`applyCssFilter`, CSS's chain as Chrome applies it: clamped after each of
brightness, contrast and saturate, saturating about CSS's own luma (0.213,
0.715, 0.072). A stop can be the card's type glow (`--card-glow`,
`uCardGlow`: radiant-holo's) and a number its foil brightness
(`--foil-brightness`, `uFoilBrightness`: reverse-holo's), both resolved per
card type by `select.ts` into `HoloSelection`. The RGB path stays as it was:
`effects/unchanged.test.ts` pins by hash the whole shader of the nine
effects the shine ports left alone (the eight Scarlet & Violet and `basic`)
and the 21 ported glares. Its `applyFilter` is not CSS's filter (against
Chrome, 8 off in 0..255 on average and 55 at worst), which the Scarlet &
Violet sub-project is to settle by moving those ports onto groups.

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
  cut-out boxes in `regions.ts`, every effect's `fromTop` offset, and the
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

## Bundle budget — measured 2026-09-22 at `372ddba`, fresh `pnpm --filter @ncam/holodex build`

**Lazy chunk re-measured 2026-09-25 at `433e8fe`**, after the eight Scarlet &
Violet effects and their shaders landed: `scene-*.js` is 545.22 kB raw,
**139.60 KB gz** against the 170 KB budget — a pass with 30.4 KB of headroom,
up 8.20 KB from the 131.40 below. The main chunk was not re-traced; the
change that made the new effects selectable reported it 0.61 KB gz larger.
**Again at `faae39e`**, after the 22 older effects' shines were ported (the
RGBA path, 21 group shaders and the textures drawn for them): 570.64 kB raw,
**148.72 KB gz**, a pass with 21.3 KB of headroom, up 9.12 KB from 139.60.
The rest of this section is the full measurement as of `372ddba`.

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
not itself budgeted and effectively flat against the ≈66.4 KB gz
figure recorded before this branch.

**Bundle history on this branch, so nobody chases a ghost.** The lazy-chunk
number moved twice, and both moves are fully explained — neither is drift:

1. At `20a028c` (Task 11) it appeared to _drop_ to 82 KB gz — a large
   improvement in a branch that had just added 22 shader strings. It had not
   shrunk; it had **split**. That commit reached `disposeMaterials` through
   `void import('./holo/program-cache')`, which gave `program-cache.ts` its
   own chunk, and Rollup made that chunk the shared three.js core instead of
   folding it into `scene.ts`.
2. At `372ddba` (this task's starting commit) the split is gone: the
   teardown fix routes disposal through the three-free `teardown.ts`
   instead, so `program-cache.ts` is once again reachable only from
   `scene.ts`, and Rollup merged them back into one chunk. If a future
   measurement here shows roughly 82 KB, or two three.js-shaped chunks in
   the client build, that is this split recurring — or a stale `dist/` from
   before `372ddba`. Delete `dist/` and `dist-ssr/` and rebuild before
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

If a budget is ever missed here, the fix is a design decision (three.js vs.
OGL vs. raw WebGL2 behind the same `HoloScene` interface) — report it, don't
just swap the library.

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
  `birthday` stars' shape, sizes and hues, the ball lattice, the wrapped
  copies that make each texture tile, and every texture the legacy shines
  sample, whole, as bytes too (`glitter`, `geometric`, `trainerbg`,
  `illusion` and its mask, `grain`, `ancient`, `vmaxbg` and the three cosmos
  layers: `*Pixels()`). Each of these stands in for one of the reference's
  images, none of which is copied (the owner's licence terms): it
  is drawn at that image's natural size (`TEXTURE_SIZE`, which the ports'
  `background-size: auto` and `cover` read) to the motif, feature size,
  density and tone measured off it headless, and `textures.test.ts` holds
  those measurements (tone bounds and shares, crossings, counts), its
  determinism, its tiling and its own structure (the cosmos layers draw one
  list of objects, the mask draws illusion's bands). Browser-only and
  untested: the canvas calls (`fromPixels` and the ball glyphs' drawing,
  whose geometry, `GLYPH` and `BALL_RADIUS`, was measured off the
  reference's pokeball/masterball mask images and checked by scanning the
  rendered textures the same way in a headless browser). `scene.ts` binds a
  generated texture only when the selected effect samples it
  (`texturesUsedBy`, children included), through `SHARED_TEXTURE_UNIFORM`,
  which `scene.test.ts` holds against the samplers `shader/sources.ts`
  declares.
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
card, confirm the holo reacts to the pointer). The effects page (the default,
`/`) puts every effect's three example cards on one page for that: hover
through the tiles. A live tile whose card TCGdex serves without an image says
so, since there is no art for the foil to render on.

**Comparing an effect with the reference** is done headless, not by eye in a
pane: Playwright 1.63 from the pnpm store, launched on the cached Chromium
1208 headless shell (`executablePath`; 1.63's own Chromium is not cached, and
1.58, whose it is, has left the store), renders WebGL2 with no window. For
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
remove `masked`, set its `data-rarity`, `data-subtypes` and `data-supertype`
(and `data-trainer-gallery`, `data-set` and `data-number`, which some
rarities' CSS reads) to the effect and card being compared, give it that
card's type class in place of its own (`.card.lightning` and the rest set
`--card-glow` and `--foil-brightness`: the probe card was `.water`, and drew
radiant's glow blue on a Grass card), and put our card's art in its `<img>`:
it then draws exactly the unmasked CSS the ports come from. Pin `--foil`,
`--mask` and `--cosmosbg` to `none` on `.card__front`, where Card.svelte sets
them inline; pinned on `.card`, the inline values win, and amazing-rare drew
the probe card's own foil. Pin its pointer variables with `!important`
rather than hovering (two captures then differ by 0.00, where hovering ones
differ by ~11), at its own tilt for that pointer (Card.svelte:
`rotateY(-(x - 50) / 3.5)`, `rotateX((y - 50) / 3.5)`). And address it by a
mark of your own: a Playwright locator by `data-rarity` re-queries on every
use, and finds the next card once you change it. Two more things the shine
ports needed:

- **Read the cascade off the browser**, not the CSS text alone: the text
  says what a rule computes, but which rule wins and what each `var()`
  resolves to on the probe card is `getComputedStyle`'s to say, on
  `.card__shine` and on its `::before` and `::after`. regular-holo's
  `--scanlines-space: .5px` sits in a media query (the probe computes 1px),
  `.card.card[data-rarity…]` rules outrank a rarity's own (shiny-v's
  `:after` is shiny-rare's), and the sunpillar rotation differs per
  element. Dump each rarity's computed styles once and port from them
  wherever they and the text disagree about the cascade.
- **Feed the reference our textures** for the verdict: answer its requests
  for `/img/glitter.png`, `/img/grain.webp` and the rest with ours, as PNGs
  exported from the `*Pixels()` functions (`page.route`), so the two differ in
  the effect alone; a capture with its own images then shows what the
  textures add. Over the 21 the two means differed by less than 0.05.

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
shine re-port is what would close either, and did (below).

What the shine ports showed (2026-09-25), with the reference fed our
textures and the pointer at (0.3, 0.3) and (0.7, 0.7): over the 21 that draw
a scene, the mean whole-card gap was 17.25 in luminance and 20.77 in chroma
with only the pilot's two ported, and is 3.93 and 3.70 with all of them
(3.94 and 3.74 against the reference's own images), where two cards drawing
no effect differ by 2.74 and 2.34. Held at each point to
max(1.5 × floor, floor + 2), 13 pass whole, and 19 with the glare hidden on
both sides; shiny-vmax and swsh-pikachu miss by 0.1 and 0.2 on chroma at
(0.3, 0.3), on floors of 0.6 and 1.8, and look alike by eye. For the other
six, what is left is the earlier glare port. Glare only, reverse-holo's
luminance gap is 5.8 and 12.8, trainer-gallery-holo's 6.6 and 7.6 and
trainer-full-art's 11.8 and 4.7; cosmos-holo's glare was already 3 to 6
over; and two galleries draw a glare other than the reference's. On
`trainer-gallery-v-regular` it computes to v-regular.css's radial (white
0%, rgba(134, 138, 141, .33) 45%, rgba(51, 51, 51, .9) 130%), hard-light
through brightness(.9) contrast(1.75) at opacity .4, where the port
overlays base.css's; on `trainer-gallery-v-max` it is hard-lit, where the
port overlays it. The shine ports left every glare as it was. cosmos-holo
was measured on the reference's clip; its shine has since moved onto the
whole card (the owner's call), so outside the card's own region it now
differs from the reference by design.

Computed layout and scrolling need a browser too, so these are smoke-pass
checks, not unit tests: every effects tile the same height across all 30
sections (a fixed caption — the name clamped to two lines and always two lines
tall — under the fixed 63/88 art); a section the URL names scrolling into view
on navigation, instantly on the landing and under reduced motion, and the page
never moving for a card picked on it, hovered, focused or tapped, in the host
as well as standalone; and every page at least one viewport tall, footer at
the bottom (Shell's `min-h-screen`).

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
The dev and preview servers answer the asset route themselves (the
`holodex:tcgdex-asset-proxy` plugin), so the foil draws on both; a static
server of `dist` alone has no route, and falls back to TCGdex's own URL.

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
