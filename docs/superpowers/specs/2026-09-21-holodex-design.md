# Holodex (Pokémon TCG explorer + WebGL holo cards) — design

Date: 2026-09-21
Status: designed, not implemented
Scope: a new federated remote `apps/holodex` (port 9007) plus the host changes
needed to give a remote its own nested URLs. Data comes from the public
[TCGdex](https://tcgdex.dev) REST API (`https://api.tcgdex.net/v2/en`).

## 1. Summary

A Pokémon TCG database explorer packaged as a self-contained Module Federation
remote and mounted by the portfolio shell at `/projects/holodex`. It browses
series → sets → cards, searches and filters, shows a full card detail page with
attacks / weakness / evolution and market pricing, and lets the visitor mark
cards as owned or wishlisted in browser storage.

The headline is the card itself: on the detail page the card is rendered by a
three.js shader layer that adds pointer/gyroscope tilt, prismatic refraction, a
moving glare and a rarity-keyed foil texture — flat for a Common, cosmos for a
Secret Rare.

### Goals

- Browse the full TCGdex catalogue: 21 series, 220 sets, ~20 000 cards.
- Search by name and filter by type, rarity and set, with working pagination
  even though the API exposes no total-count header.
- Card detail page: holo render, stats (HP, types, attacks + energy costs,
  weakness, resistance, retreat, illustrator, legality, regulation mark),
  evolution link, and cardmarket/tcgplayer pricing with a 30-day trend.
- Collection: mark cards owned or wishlisted, persisted in `localStorage`, with
  per-set completion counters.
- Every view has its own URL under `/projects/holodex/...`, owned by the host
  router — shareable, refresh-safe, back/forward works, SSR'd for SEO.
- The host learns a **generic** route-aware remote contract, not a
  holodex-specific one; the other five remotes keep working untouched.
- `pnpm run ci` stays green. The data layer, rarity mapping, route matcher and
  collection store are unit-tested.

### Non-goals

- Deck builder, battle simulator, booster-pack opening, trading, auth, accounts.
- Non-English locales (TCGdex supports them; we ship `en` only).
- Per-card hand-authored foil masks (TCGdex ships none; see §6.3).
- Server-side persistence of the collection — browser storage only.
- Price history beyond the three points the API already returns.

## 2. Decisions

| Decision      | Choice                         | Why                                                                                |
| ------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| App id / name | `holodex` / "Holodex"          | No Nintendo trademark on a public portfolio; names the effect, which is the point. |
| Port          | 9007                           | 9001–9006 are taken (toonhub, mindloop, immersive-ocean, viktor, bali, profile).   |
| Routing       | Host-owned nested routes       | Chosen by the owner over hash routing. Mitigated by a generic contract (§4).       |
| Holo renderer | three.js                       | Chosen by the owner over raw WebGL2 / OGL. Mitigated by lazy-chunking (§6.4).      |
| Foil source   | Rarity-tier generated textures | No per-card masks exist; procedural-from-art was declined.                         |
| Data layer    | `@tanstack/react-query`        | Chosen by the owner over a hand-rolled client. Gives dedupe, retry, SSR dehydrate. |
| SSR           | Full — list and card views     | Chosen by the owner. Real HTML for crawlers and first paint.                       |
| Framework     | React 19 + Vite 8 + Tailwind 4 | Same stack as `apps/bali`, copied as the template.                                 |

### Accepted cost

`shared: {}` is inert in this repo — every React remote already bundles its own
React (~55.8 KB gz, measured 2026-09-18). three.js (~150 KB gz) and react-query
(~13 KB gz) sit on top of that. Mitigation: three.js and the whole holo module
live in a lazily-imported chunk that only loads on a card detail page; grid and
list views never download it. Budget in §10.

## 3. App layout

```
apps/holodex/
  package.json          @ncam/holodex
  vite.config.ts        defineRemote({ name: 'holodex', port: 9007, ... })
  index.html            standalone dev page
  AGENTS.md
  src/
    mount.tsx           mount(target, config?) -> MountHandle
    hydrate.tsx         hydrate(target, config?) -> MountHandle
    ssr.tsx             renderHeroSSR({ config: { route } }) -> { html, css }
    standalone.tsx      dev entry (reads window.location, own history)
    App.tsx             RouterContext + QueryClientProvider + view switch
    routes.ts           parse/format the remote's own route strings
    views/
      SetsView.tsx      series accordion + sets grid (home)
      SetView.tsx       cards grid for one set + filter bar
      SearchView.tsx    global card search results
      CardView.tsx      card detail: holo + stats + pricing + collection
      CollectionView.tsx owned / wishlist
      NotFoundView.tsx
    components/
      CardTile.tsx      grid tile: image + CSS-only tilt, no WebGL
      CardImage.tsx     quality-aware <img> + missing-image placeholder
      FilterBar.tsx     name / type / rarity controls
      Pager.tsx         prev / next (no total count)
      StatPanel.tsx     HP, attacks, weakness, retreat, legality
      PricePanel.tsx    cardmarket + tcgplayer + sparkline
      CollectionToggle.tsx
      ErrorPanel.tsx    per-view retry
    holo/
      HoloCard.tsx      wrapper: <img> always, canvas attached after mount
      scene.ts          three.js renderer, camera, plane, ShaderMaterial
      shaders.ts        vertex + fragment source
      textures.ts       runtime-generated tier foil textures
      tiers.ts          rarity -> tier mapping
      capability.ts     WebGL support + reduced-motion detection
    lib/
      tcgdex.ts         typed endpoints + strict param whitelist
      queries.ts        react-query keys + options
      collection.ts     localStorage store
      images.ts         asset URL builder + fallback
      utils.ts          cn()
    styles/globals.css
```

Dependencies: `react`, `react-dom`, `three`, `@tanstack/react-query`, `clsx`,
`tailwind-merge`, `lucide-react`, `@ncam/logger`, `@fontsource-variable/…` (one
display face). Dev: `@ncam/mf-remote`, `@ncam/tsconfig`, `@types/three`,
`@vitejs/plugin-react`, `@tailwindcss/vite`, `vite`, `typescript`.

`vite.config.ts` mirrors `apps/bali`:

```ts
export default defineRemote({
  name: 'holodex',
  port: 9007,
  baseEnv: 'HOLODEX_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react(), tailwindcss()],
});
```

## 4. Route-aware remote contract (host + `@ncam/mf-remote`)

Today a remote is `mount(el, config?) => () => void`: one screen, no URL. Holodex
needs several URLs, and the owner chose host-owned routes. To avoid coupling the
host to one remote, the contract is widened generically and remains backward
compatible.

### 4.1 Types — `packages/mf-remote/src/contract.ts` (new, re-exported from index)

```ts
/** Config the host passes into a remote's mount / hydrate / SSR entry. */
export interface MountConfig {
  /** Path inside the remote, always leading-slash, may carry a query string. */
  route?: string;
  /** Ask the host to navigate. `to` is a remote-relative path. */
  onNavigate?: (to: string) => void;
  /** Origin to resolve the remote's own assets against. */
  assetBase?: string;
}

/** Disposer, optionally able to accept a new route without remounting. */
export interface MountHandle {
  (): void;
  update?: (route: string) => void;
}
```

These are **types only** — no runtime code, so nothing is added to any bundle.

### 4.2 Host route

`apps/portfolio/src/routes/projects/$projectId.tsx` keeps its current path. Its
component body moves to `src/components/ProjectStage.tsx` (props: `projectId`,
`html`, `css`, `route`) and both routes render it. The loader, `head()` and the
JSON-LD move with it or are shared via a helper so SEO stays identical.

A new sibling route `apps/portfolio/src/routes/projects/$projectId_.$.tsx` gives
path `/projects/$projectId/$`. The trailing `_` opts it out of nesting under the
`$projectId` route, so it renders its own stage rather than an outlet.

```ts
export const Route = createFileRoute('/projects/$projectId_/$')({
  validateSearch: (search: Record<string, unknown>) => search,
  loader: /* same loader, but passes config.route to renderHeroSSR */,
  head: /* same head, canonical includes the splat */,
  component: ProjectSplatPage,
});
```

`routeTree.gen.ts` is generated — regenerate it, do not hand-edit. Verify during
implementation that the generated path is `/projects/$projectId/$`; if the `_`
suffix behaves differently in the pinned router version, fall back to a
directory-style `routes/projects/$projectId_/$.tsx`.

The route string handed to the remote:

```ts
const splat = params._splat ?? '';
const search = useRouterState({ select: (s) => s.location.searchStr });
const route = `/${splat}${search}`; // e.g. "/sets/swsh3?type=Fire&page=2"
```

On the non-splat route, `route` is `/`.

`onNavigate` maps back through the typed router API:

```ts
const onNavigate = (to: string) => {
  const [path, qs = ''] = to.split('?');
  router.navigate({
    to: '/projects/$projectId/$',
    params: { projectId, _splat: path.replace(/^\//, '') },
    search: Object.fromEntries(new URLSearchParams(qs)),
  });
};
```

### 4.3 Navigation without remount

`ProjectStage` keeps the `MountHandle` in a ref. When `route` changes:

- if `handle.update` is a function → call `handle.update(route)`;
- otherwise → leave the remote alone (remotes without internal routes never see
  a route change anyway).

The remote is only torn down when `projectId` changes or the component unmounts.
This is what stops every in-app click from destroying and rebuilding the WebGL
context and the query cache.

`ProjectStage` passes the same `MountConfig` (`{ route, onNavigate, assetBase }`)
into **whichever** entry it uses — `mount(el, config)` on the CSR path and
`hydrate(el, config)` on the SSR path — and the loader passes `{ config: { route },
assetBase }` to `renderHeroSSR`. `config` is already an optional parameter on all
three entries today, so the five existing remotes ignore it and are unaffected.

### 4.4 URL map

Every view has a host-owned URL. The left column is the browser URL; the right is
the `route` string the remote receives and parses in `routes.ts`.

| Browser URL                      | `route`         | View                                      |
| -------------------------------- | --------------- | ----------------------------------------- |
| `/projects/holodex`              | `/`             | `SetsView` — series accordion + sets grid |
| `/projects/holodex/sets/:setId`  | `/sets/:setId`  | `SetView` — that set's cards              |
| `/projects/holodex/search`       | `/search`       | `SearchView` — global card search         |
| `/projects/holodex/card/:cardId` | `/card/:cardId` | `CardView` — holo + stats + pricing       |
| `/projects/holodex/collection`   | `/collection`   | `CollectionView` — owned / wishlist       |
| anything else                    | as given        | `NotFoundView`                            |

Search params, valid on `/sets/:setId` and `/search`, are carried verbatim in the
`route` string: `q` (name, partial match), `type` (one of the 11 API types),
`rarity` (one of the 42 API rarities), `page` (1-based, defaults to 1). Unknown
search params are ignored by `routes.ts` and never reach `lib/tcgdex.ts`, which
whitelists again (§5.2).

### 4.5 Registration

- `apps/portfolio/vite.config.ts`: `HOLODEX_REMOTE` from `HOLODEX_REMOTE_URL`,
  default `http://localhost:9007/remoteEntry.js`, added to `remotes`.
- `ProjectStage`: add `holodex` to `ssrLoaders` / `hydrateLoaders` /
  `mountLoaders` (static specifiers — the federation plugin requires them).
- `packages/project-registry`: new entry `{ id: 'holodex', name: 'Holodex',
tagline: 'Pokémon TCG explorer', accent: '#7C5CFF', remote: 'holodex',
module: './mount', status: 'live', thumbnail: '/thumbnails/holodex.jpg' }`.
- `pnpm thumbnails holodex` once the dev servers run.
- Root `.env.example` / deploy docs get `HOLODEX_REMOTE_URL`.

## 5. Data layer

### 5.1 API facts (verified against the live API on 2026-09-21)

- Base `https://api.tcgdex.net/v2/en`. No key. `access-control-allow-origin: *`,
  so the browser may call it directly.
- `GET /series` → 21 × `{ id, name }`. `GET /sets` → 220 ×
  `{ id, name, cardCount: { total, official } }`.
- `GET /sets/{setId}` → `{ id, name, logo, symbol, releaseDate, serie,
cardCount, legal, abbreviation, cards: CardBrief[] }`. The whole set's cards
  arrive in one response — no pagination needed for a set.
- `GET /cards/{cardId}` → full card: `category, id, illustrator, image, localId,
name, rarity, set, variants, variants_detailed, dexId, hp, types, evolveFrom,
description, stage, attacks, weaknesses, retreat, regulationMark, legal,
updated, pricing`.
- `GET /cards?…` → `CardBrief[]` = `{ id, localId, name, image? }`.
- `GET /rarities` → 42 strings. `GET /types` → 11 strings.

Gotchas that shape the code:

1. **No total-count header.** `Content-Length` and `Content-Range` are the only
   exposed headers. There is no `X-Total-Count`, so page counts are unknowable.
2. **Unknown query params match nothing.** `?nonsense=zzz` returns `[]`, not the
   unfiltered list. Only whitelisted params may ever be sent.
3. **`set` / `set.id` are substring matches.** `?set.id=swsh3` also returns
   `swsh3.5` cards. Exact set membership must be enforced another way.
4. **~20% of card briefs have no `image`.** 10 of 50 in a sampled query. Every
   image site needs a placeholder.
5. Page overflow is not an error: `?pagination:page=99999` → `200 []`.
6. `?name=char` is a partial, case-insensitive match. `types`, `rarity`,
   `sort:field`, `sort:order` all work as documented.
7. `/cards` with no pagination returns the entire catalogue. Always paginate.

### 5.2 `lib/tcgdex.ts`

```ts
export const API = 'https://api.tcgdex.net/v2/en';

/** Only these may be sent — gotcha 2. */
const CARD_FILTERS = ['name', 'types', 'rarity', 'set.id'] as const;

export interface CardQuery {
  name?: string;
  types?: string;
  rarity?: string;
  setId?: string;
  page?: number; // 1-based
  perPage?: number; // default 24
}

export interface Page<T> {
  items: T[];
  page: number;
  hasNext: boolean;
}
```

- `buildCardUrl(q)` drops empty values, maps `setId` → `set.id`, refuses any key
  outside `CARD_FILTERS`, and appends `pagination:page` / `pagination:itemsPerPage`.
- **Pagination (gotcha 1):** request `perPage + 1` items. If `perPage + 1` come
  back, `hasNext = true` and the extra item is sliced off. The pager therefore
  shows "‹ prev · page N · next ›" and never a total.
- **Exact set (gotcha 3):** `getSet(setId)` uses `/sets/{setId}` and paginates
  its `cards` array in memory. When a type or rarity filter is active inside a
  set, the request goes to `/cards?set.id=…&…` and results are then filtered with
  `card.id.startsWith(`${setId}-`)`, because card ids are `<setId>-<localId>`.
  That client-side filter runs **before** the `hasNext` slice, so a page can come
  back short; the pager treats "fewer than perPage after filtering, but the API
  returned a full page" as `hasNext = true`.
- Every response is validated shallowly (`Array.isArray`, required keys) and a
  malformed body throws a typed `TcgdexError` carrying status and URL.
- A 10 s `AbortSignal.timeout` on every request.

### 5.3 `lib/images.ts`

TCGdex returns a base like `https://assets.tcgdex.net/en/swsh/swsh3/136` with no
extension. Quality and format are suffixes — `low.webp`, `high.webp`, `high.png`
all verified 200.

```ts
imageUrl(base: string | undefined, quality: 'low' | 'high'): string | null
```

`null` when `base` is missing (gotcha 4) → `CardImage` renders a Poké Ball
silhouette placeholder with the card name, same aspect ratio (`63/88`), so the
grid never reflows.

Grid tiles use `low.webp`, `loading="lazy"`, `decoding="async"`. The detail page
uses `high.webp` and preloads it.

### 5.4 react-query

`lib/queries.ts` owns keys and options — no inline query config in components.

```ts
export const keys = {
  series: ['series'] as const,
  sets: ['sets'] as const,
  set: (id: string) => ['set', id] as const,
  cards: (q: CardQuery) => ['cards', q] as const,
  card: (id: string) => ['card', id] as const,
};
```

`staleTime`: 5 min for `series` / `sets` / `set` (catalogue data barely moves),
1 min for `cards` / `card` (pricing moves). `gcTime` 30 min. `retry: 2` with the
default backoff. `refetchOnWindowFocus: false` — a portfolio demo should not
hammer a free API.

The `QueryClient` is created **per mount** (client) and **per request** (server),
never at module scope, so a second visit or a second SSR request never inherits
stale state.

### 5.5 SSR and hydration

`ssr.tsx`:

1. Parse `config.route` with `routes.ts`.
2. Create a request-scoped `QueryClient`.
3. `await` the prefetches that view needs (`/` → series + sets; `/sets/:id` →
   that set; `/card/:id` → that card; `/search` → the query; `/collection` → none).
4. `renderToString(<App route={route} />)` inside a `HydrationBoundary`.
5. `dehydrate(client)` and append the state to the returned HTML as
   `<script type="application/json" id="holodex-state">…</script>`.
6. Return `{ html, css }` where `css` is the inlined `globals.css` (same pattern
   as `apps/bali`).

The host injects that HTML with `dangerouslySetInnerHTML`. `innerHTML` inserts
script elements without executing them, and a `type="application/json"` script is
never executed anyway — `hydrate.tsx` reads it with
`document.getElementById('holodex-state')?.textContent`, `JSON.parse`s it inside
a `try/catch`, and passes it to `HydrationBoundary`. The JSON is escaped for
`</script>` sequences before embedding.

If parsing fails or the element is missing, hydration proceeds with an empty
state and react-query fetches on the client — degraded, never broken.

Prefetch failures do **not** fail SSR: the query is left un-prefetched, the
markup renders its skeleton, and the client fetches. A total SSR failure already
falls back to client mount in the host loader.

## 6. Holo renderer

### 6.1 Where it applies

- **Card detail only.** One canvas, one card.
- **Grid tiles use CSS only** — a `rotateX/rotateY` transform driven by pointer
  position plus a `linear-gradient` sheen. Dozens of tiles, no GL contexts.

### 6.2 Rarity → tier

`holo/tiers.ts` maps all 42 API rarities to four tiers.

| Tier      | Look                                                | Rarities                                                                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flat`    | no foil, soft drop shadow                           | Common, Uncommon, None, One Diamond, Two Diamond, Three Diamond                                                                                                                                                                                                                       |
| `sparkle` | fine glitter grain, low-amplitude glare             | Rare, Four Diamond, Promo, One Star, Classic Collection, Black White Rare                                                                                                                                                                                                             |
| `rainbow` | linear spectral sheen across the art                | Holo Rare, Rare Holo, Rare Holo LV.X, Rare PRIME, Holo Rare V, Holo Rare VMAX, Holo Rare VSTAR, Double rare, Amazing Rare, Radiant Rare, Shiny rare, Shiny rare V, Shiny rare VMAX, One Shiny, Two Shiny, LEGEND, ACE SPEC Rare, Two Star, Full Art Trainer, Ultra Rare, Pikachu Rare |
| `cosmos`  | galaxy speckle + prism burst + strongest refraction | Hyper rare, Mega Hyper Rare, Secret Rare, Special illustration rare, Illustration rare, Shiny Ultra Rare, Crown, Three Star, Futuristic Rare                                                                                                                                          |

Rules:

- Unknown or absent rarity → `sparkle`.
- `card.variants.reverse === true` upgrades `flat` → `sparkle` (a reverse-holo
  Common really is foiled).
- `card.variants.holo === true` upgrades `sparkle` → `rainbow`.
- A test asserts every string returned by `GET /rarities` has an explicit entry,
  using a checked-in snapshot of that list so the test never hits the network.

### 6.3 Foil textures

TCGdex ships no foil masks and the owner chose generic tier textures over
procedural-from-art. `holo/textures.ts` generates each tier's texture **once at
runtime** into an `OffscreenCanvas` (falling back to a detached `<canvas>`),
caches it at module scope and shares it across cards. Nothing is committed as an
image asset and nothing is downloaded.

- `sparkle`: value-noise glitter, 512².
- `rainbow`: horizontal spectral ramp with banding, 512×64, tiled.
- `cosmos`: layered value noise + star points, 1024².

### 6.4 three.js scene

`holo/scene.ts` exports `createHoloScene(canvas, opts)` → `{ setCard, setPointer,
resize, dispose }`.

- `OrthographicCamera`, one `PlaneGeometry` sized to the card's 63×88 ratio, one
  `ShaderMaterial`.
- Uniforms: `uCard` (card art texture), `uFoil` (tier texture), `uPointer`
  (normalised −1…1), `uTilt`, `uTime`, `uTier`, `uIntensity`.
- Fragment shader: sample the art; offset the foil sample by a view-dependent
  vector to fake refraction; multiply by a pointer-tracking glare lobe; add a
  specular highlight; composite over the art with the tier's blend weight.
- The plane also tilts (`rotation.x/y`) toward the pointer, spring-damped, so the
  card physically leans as well as shimmers.
- A single `WebGLRenderer` is created lazily and **reused** across card
  navigations; `setCard` swaps textures and disposes the previous art texture.

Input: `pointermove` on the card element; `deviceorientation` on touch devices
(after a permission gesture on iOS — if permission is denied, pointer only).

Lifecycle and safety:

- The whole `holo/` module is imported dynamically from `CardView`, so three.js
  lands in its own chunk that list views never request.
- `IntersectionObserver` stops the RAF loop when the card scrolls out of view;
  `visibilitychange` stops it when the tab is hidden.
- `webglcontextlost` → cancel RAF, swap to the CSS fallback, log a warning;
  `webglcontextrestored` → rebuild.
- `capability.ts` returns `false` when there is no WebGL2 context, when
  `prefers-reduced-motion: reduce` is set, or when the device reports
  `navigator.hardwareConcurrency <= 2`. In that case `HoloCard` renders the plain
  image plus a static CSS sheen and never loads the chunk.
- `dispose()` frees geometry, material, textures and the renderer on unmount.

### 6.5 SSR interaction

`HoloCard` always renders the `<img>` in its SSR markup. The canvas is created in
an effect after mount, so server and client markup match exactly and there is no
hydration mismatch and no flash.

## 7. Collection

`lib/collection.ts` — `localStorage` key `holodex:collection:v1`, value
`{ version: 1, owned: string[], wishlist: string[] }`.

- Every read and write is wrapped in `try/catch` (Safari private mode throws on
  write; storage may be blocked entirely). On failure the store degrades to an
  in-memory map for the session and logs once.
- A corrupt or unknown-version payload is discarded and replaced with an empty
  state rather than throwing.
- Exposed through `useSyncExternalStore` with a `storage` event listener, so two
  open tabs stay in sync.
- `getServerSnapshot` returns the empty state, and collection badges/counters
  render `null` until after mount, so SSR markup and first client render match.
- Per-set completion (`owned in set / set.cardCount.official`) is computed from
  the set's card ids, which share the `<setId>-` prefix.

## 8. Pricing

`variants_detailed[].pricing` already carries `cardmarket` (EUR) and `tcgplayer`
(USD) blocks with `avg`, `low`, `trend`, `avg1`, `avg7`, `avg30`, plus holo
variants of the same fields and an `updated` timestamp.

`PricePanel` shows, per variant that has pricing: currency-formatted `low`,
`avg`, `trend`, and a three-point sparkline from `avg30 → avg7 → avg1` labelled
"30d → 7d → 24h". Missing blocks are skipped; a card with no pricing at all
renders nothing rather than an empty shell. Footer: "Market data via TCGdex" with
the `updated` date, and a note that prices are indicative.

## 9. Failure behaviour

| Failure                         | Behaviour                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| API request fails / times out   | `ErrorPanel` inside that view with a retry button; the rest of the app stays usable.    |
| SSR prefetch fails              | Skeleton HTML; the client fetches after hydration.                                      |
| Remote fails to load entirely   | Existing host `stage__error` panel (unchanged).                                         |
| Unknown route inside the remote | `NotFoundView` with a link home; host keeps its 200 (the project page itself exists).   |
| Unknown set or card id          | Per-view not-found state, not a crash.                                                  |
| Card has no image               | Placeholder tile, correct aspect ratio.                                                 |
| No WebGL / reduced motion       | Static image + CSS sheen; three.js chunk never loaded.                                  |
| WebGL context lost              | Falls back to the CSS layer, logs a warning, rebuilds on restore.                       |
| `localStorage` unavailable      | In-memory collection for the session; one warning.                                      |
| React render throws             | `ErrorBoundary` at the remote root renders a recoverable panel; the host page survives. |

## 10. Performance budget

- Remote main chunk (excluding its React copy): **< 90 KB gz**.
- Lazy holo chunk (three.js + scene + shaders + textures): **< 170 KB gz**.
- Card grid: `low.webp` thumbnails, lazy-loaded, 24 per page.
- One WebGL context for the whole app, reused across cards.
- RAF paused when the card is off-screen or the tab is hidden.
- Verified with `pnpm --filter @ncam/holodex build` and the Vite bundle report;
  the numbers go in the app's `AGENTS.md` once measured.

## 11. Testing and verification

Vitest (the root config already globs `apps/**/*.{ts,tsx}`). `fetch` is mocked —
no test touches the network.

- `lib/tcgdex.ts`: URL building for each filter combination; rejection of
  non-whitelisted params; `pagination:*` encoding; the `perPage + 1` probe
  setting `hasNext` true/false; the short-page-after-client-filter case; the
  `set.id` substring workaround keeping only `<setId>-` ids; `TcgdexError` on a
  non-200 and on a malformed body.
- `lib/images.ts`: quality suffixes; `null` for a missing base.
- `holo/tiers.ts`: every rarity in the checked-in snapshot maps to a tier;
  unknown → `sparkle`; the `variants.reverse` and `variants.holo` upgrades.
- `routes.ts`: parse and format round-trip for every route, including query
  strings, trailing slashes and unknown paths.
- `lib/collection.ts`: add, remove, persist, cross-tab event, corrupt JSON,
  unknown version, and a `localStorage` that throws on write.
- `holo/capability.ts`: each disqualifying condition.
- `packages/project-registry`: the existing test's snapshot gains `holodex`.

Not unit-tested: the shader and the three.js scene (jsdom has no WebGL). They sit
behind `capability.ts`, which is tested, and are checked by hand.

Manual verification before the PR:

1. `pnpm install && pnpm build` passes; `pnpm typecheck` and `pnpm lint` clean.
2. `pnpm dev` → `http://localhost:9007` standalone: browse, filter, page,
   open a card, see the holo react to the pointer.
3. `http://localhost:9000/projects/holodex` → the same through the host; deep
   links, back/forward and refresh all land on the right view; other projects
   still mount.
4. `pnpm preview` (production build) → confirm the SSR path: view source shows
   real card markup and the `holodex-state` script, and there is no refetch
   flash on hydration.
5. `prefers-reduced-motion` on → static card, no three.js chunk in the network
   panel.

## 12. Risks

1. **Bundle size.** three.js plus react-query on top of a private React copy.
   Mitigated by lazy-chunking and the §10 budget; if the lazy chunk misses
   budget, the fallback is OGL or a raw WebGL2 quad, which is a contained change
   behind `holo/scene.ts`.
2. **Host route change touches every project page.** `ProjectStage` is extracted
   and shared, so a mistake affects all six remotes. The existing SSR/CSR
   behaviour must be verified for at least one other remote before merge.
3. **Splat route semantics.** The `$projectId_.$` path shape must be confirmed
   against the pinned TanStack Router version (§4.2) — regenerate the route tree
   and read the generated path.
4. **Third-party API.** TCGdex is free and unauthenticated; it can rate-limit or
   go down. Conservative `staleTime`, no focus refetching, and every view
   degrades to an error panel with retry.
5. **Pricing accuracy.** Third-party market data shown as-is with an "indicative"
   note and the API's `updated` timestamp.
6. **Trademark.** Pokémon names and card art belong to Nintendo / Creatures /
   GAME FREAK. The app is a non-commercial portfolio demo reading a public API;
   the footer credits TCGdex and states no affiliation.

## 13. Follow-ups (not in this spec)

- Booster-pack opening mode reusing the holo renderer.
- Multi-language via TCGdex's other locale bases.
- Server-side collection sync.
- Retiring the CSS grid tilt in favour of a single instanced WebGL layer if the
  grid ever needs real foil.
