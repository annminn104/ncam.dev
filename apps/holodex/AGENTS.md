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
- `src/holo/` — eager (statically imported by `HoloCard.tsx`, so part of the
  main chunk): `select.ts` (rarity/layout/printing → `HoloSelection`),
  `regions.ts` (`ClipShape` → inset rect + `coversPoint`), `capability.ts`
  (`supportsHolo`), `showcase.ts` (the one-shot intro sweep, a pure state
  machine over an injected clock), `use-reduced-motion.ts`, `teardown.ts`
  (three-free indirection onto the shader cache's disposer — see "The holo
  chunk is lazy" below), `HoloCard.tsx` itself (mount, pop/showcase,
  context-loss and off-screen handling). Lazy (only reachable through
  `HoloCard.tsx`'s dynamic `import('./scene')` — see below): `scene.ts`,
  `textures.ts`, `program-cache.ts`, `shader/` (`base.ts`, `blend.ts`,
  `sources.ts`, `compile.ts`, `types.ts`), `effects/` (22 effect files, one
  per `EffectId`, plus the `index.ts` registry and shared `palette.ts`).
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

**22 rarity-keyed effects, not four tiers.** `holo/select.ts#selectHolo(card,
options)` maps all 42 TCGdex rarities onto 22 `EffectId`s (`EFFECT_BY_RARITY`),
derived from — not ported from — [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css).
Two overrides apply on top of the rarity table, in order: (1) a card number
matching `/^[tg]g/i` is a trainer-gallery printing and remaps its base effect
to one of four gallery variants (`galleryEffect`); (2) `options.reverse` — an
explicit flag, never read off the card — on a card whose table effect is
`basic` or `regular-holo` becomes `reverse-holo` with `invert: true` instead.
`options.reverse` is true only when the card page's normal/reverse toggle
(`views/CardView.tsx`) is set to reverse; `card.variants?.reverse` means "a
reverse printing of this card exists in TCGdex's data," not "show it," and
only decides whether that toggle is offered at all. An earlier version of
`selectHolo` read `card.variants?.reverse` directly instead of taking
`options.reverse` — conflating "exists" with "show it" — and mis-rendered
roughly half of TCGdex (~12,500 cards, every one whose reverse printing
exists but isn't what a visitor is looking at) with inverted or unwarranted
foil. An unmapped rarity falls back to `basic`,
but never silently: a coverage test asserts every one of the 42 rarities has
a table entry and that the four override-only effects (`reverse-holo` and
the three gallery variants) never appear as a table value. `selectHolo` also
picks the card's `ClipShape` (`clipShape()` in the same file) from the
resolved effect, the card's `category`/`stage`, and whether its rarity is
literally `Full Art Trainer` — order matters, since `radiant-holo` and the
gallery effects must claim `borders` before the full-art and trainer rules
would otherwise take them.

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
reverse-holo print actually looks like: foil everywhere except the art.

**The effect DSL and the generator.** Each of the 22 files under
`holo/effects/` (e.g. `cosmos-holo.ts`) is a declarative `Effect`
(`holo/shader/types.ts`): 1-3 `shine` elements and 0-2 `glare` elements, each
a stack of `Layer`s (a `Source` — solid, linear/repeating-linear/conic/radial
gradient, `glitter`, `grain`, `card`, or `scanlines` — plus a `BlendMode`), an
optional pointer-driven `Filter`, and its own `mixBlend`. Numbers can be
plain, or `PointerDriven` (a base plus coefficients over pointer-from-center /
from-left / from-top, evaluated per fragment). `holo/shader/compile.ts`'s
`compileEffect()` turns one `Effect` into one complete fragment shader —
concatenating `base.ts` (varyings, clip uniforms, `coverage()`), `blend.ts`
(the 13 CSS blend modes as GLSL functions, including the three non-separable
HSL ones) and `sources.ts` (one GLSL expression per `Source` kind) around
per-effect layer/filter code generated from the `Effect` data. This is a
declarative-description-compiled-to-GLSL design, not the hand-written GLSL
chunks the original plan sketched — the one deviation from the plan, also
recorded in the spec's Status line.

**The program cache.** `holo/program-cache.ts#getMaterial(id)` compiles a
`ShaderMaterial` per `EffectId` on first use (`compileEffect` plus the shared
`VERTEX_SHADER`) and caches it at module scope for the page's lifetime, so
switching between cards that share an effect never pays a second compile. A
compile failure logs once and falls back to `basic`; if `basic` itself fails,
`getMaterial` returns `null` and `HoloCard` drops to the plain image.
`teardown.ts` exists so `mount.tsx`/`hydrate.tsx` can free this cache
(`disposeMaterials`) on remote unmount without importing three.js themselves
just to reach it — see "The holo chunk is lazy" below.

**Three gotchas that cost real time on this branch** — none of them are
caught by any test, and each one is silent (wrong colors, or a black screen)
rather than an error if you get it wrong:

- `shader/compile.ts` emits **no `#version` directive**. three.js prepends
  `#version 300 es` itself whenever `glslVersion: '300 es'` is set on the
  `ShaderMaterial` (`program-cache.ts`'s `build()` sets it). Emitting one too
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
  shared glitter/grain textures and the per-card art texture set
  `flipY = false` through `scene.ts`'s `orientTexture()` helper, undoing
  three.js's own default of `flipY = true`. Get either half of this wrong —
  the vertex flip, or a texture's `flipY` — and every effect mirrors
  vertically, or the card art does; no unit test renders a frame, so nothing
  catches it but eyes on a real card.

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
grep -l 'ShaderMaterial\|WebGLRenderer' dist/assets/*.js
```

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
comm -23 <(grep -l 'ShaderMaterial\|WebGLRenderer' dist/assets/*.js | xargs -n1 basename | sort) \
         <(ls dist-ssr/assets | sort)
# exactly one file: the client build's own scene-*.js
```

If either count changes, something started importing `holo/scene`,
`holo/shader/*` or `holo/effects/*` at module scope (outside a dynamic
`import()`) — trace it from there.

## Bundle budget (§10) — measured 2026-09-22 at `d12c296`, fresh `pnpm --filter @ncam/holodex build`

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
