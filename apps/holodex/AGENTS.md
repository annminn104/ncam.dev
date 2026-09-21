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
  for `home | set | search | card | collection | not-found`, plus filter
  (`q`, `type`, `rarity`, `page`) parsing.
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
  `CollectionView`, `NotFoundView` — one per `Route` case.
- `src/holo/` — `tiers.ts` (rarity → foil tier), `capability.ts`
  (`supportsHolo`), `HoloCard.tsx` (the detail-page component), `scene.ts` /
  `shaders.ts` / `textures.ts` (three.js, lazy — see below).
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
  `/cards?set.id=…` (cheap once filters shrink the result) but intersects the
  rows with the exact id set from `/sets/{setId}` before showing anything.
- **~20% of card briefs have no `image`.** `lib/images.ts` returns `null` for a
  missing base and `CardImage` renders a placeholder at the same `63/88`
  aspect ratio so the grid never reflows.
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
device-tilt input) only exists on the **card detail page**, one canvas for one
card, and only when `holo/capability.ts#supportsHolo` says the visitor's
device qualifies (WebGL2 available, no `prefers-reduced-motion: reduce`,
`hardwareConcurrency > 2`) — otherwise `HoloCard` stays on the plain `<img>`.

**The holo chunk is lazy** — `HoloCard.tsx` only ever imports `./scene`
dynamically (`void import('./scene')` inside an effect, gated by
`supportsHolo`); the only _static_ reference to it anywhere is
`import type { HoloScene } from './scene'`, which `verbatimModuleSyntax`
erases at compile time. That keeps three.js (~150 KB gz) out of every grid and
list page — it loads only when a visitor actually opens a card that qualifies
for holo. The cost: a visible beat on first card-open while the chunk fetches
(mitigated by the plain `<img>` staying visible underneath until the scene
reports `active`) and a second WebGL/three.js dependency graph to keep an eye
on when bumping the `three` version.

**Verifying the split hasn't regressed:** nothing in the build warns you if
three.js gets folded back into the entry — nobody would notice until every
grid page got slow. Check after any change under `src/holo/` or `src/App.tsx`:

```bash
pnpm --filter @ncam/holodex build
grep -l 'ShaderMaterial\|WebGLRenderer' dist/assets/*.js   # should be exactly one file
```

If that grep matches more than the one `scene-*.js` chunk, something started
importing `holo/scene`, `holo/shaders` or `holo/textures` at module scope
(outside a dynamic `import()`) — trace it from there.

## Bundle budget (§10) — measured 2026-09-21, `pnpm --filter @ncam/holodex build`

| Chunk                                                                             | Gzip          | Budget      | Verdict                     |
| --------------------------------------------------------------------------------- | ------------- | ----------- | --------------------------- |
| Lazy holo chunk — `scene-*.js` (three.js + `holo/scene` + `shaders` + `textures`) | **126.49 KB** | < 170 KB gz | **Pass** (43.5 KB headroom) |
| Main remote chunk, excluding React                                                | **≈ 69 KB**   | < 90 KB gz  | **Pass** (≈21 KB headroom)  |

The lazy chunk is a single file, read straight off the Vite build report. The
"main chunk" isn't one physical file — Module Federation's own plugin splits
the eager load into ~14 small chunks (the federation runtime/entry graph, the
app code, the inlined Tailwind CSS) — so its figure is the **sum of every
gzipped chunk reachable from `mount()`/`hydrate()` other than the React chunk
and the lazy holo chunk**:

| Piece                                                                                                                 | Gzip     |
| --------------------------------------------------------------------------------------------------------------------- | -------- |
| App code — `App.tsx`, views, components, `lib/tcgdex.ts`, `lib/queries.ts`, route parsing/control, react-query itself | 35.23 KB |
| `@module-federation/runtime` + remoteEntry/exposes/shared-scope glue                                                  | ≈29 KB   |
| Inlined compiled Tailwind CSS (`globals.css?inline`) + the `mount.tsx` entry itself                                   | ≈4.5 KB  |

(Gzipping each chunk separately and summing is a conservative overestimate —
served together they'd compress a little better than this.) The remote's own
React copy (`react-dom/client` + its small facade chunk) is **≈66.4 KB gz**,
not itself budgeted by §10 but up from the ~55.8 KB gz baseline measured
2026-09-18 for this repo's remotes generally — likely just React 19.3.0's
`react-dom/client` entry point vs. whatever was sampled then; not a regression
in this app's own code, worth a glance if a future remote's number looks
similar.

Previous measurement (Task 14, mid-implementation): lazy chunk 126.49 KB gz,
main chunk ~66–77 KB gz. Both are unchanged / within that range now — no drift.

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

**Not unit-tested, by design:** the three.js scene and the GLSL shaders —
jsdom has no WebGL2 and this repo has no jsdom regardless. They sit behind
`capability.ts` (which is tested) so a visitor who can't run them never loads
them, and they're checked by hand (`pnpm --filter @ncam/holodex dev`, open a
card, confirm the holo reacts to the pointer).

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
