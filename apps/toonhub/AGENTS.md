# AGENTS.md — apps/toonhub

The TOONHUB collectible-figurine hero, packaged as a **framework-free Module
Federation remote**. (Previously a standalone Astro site; now a Vite remote so
the shell can mount it as a micro-frontend.)

## What it exposes

`vite.config.ts` exposes three federated modules:

```ts
// ./mount  — CSR: render + init in one go (also used by the standalone dev page)
mount(target, config?: MountConfig): MountHandle          // + unmount(target)
// ./ssr    — SSR-safe: build initial HTML (+ inlined scoped CSS), NO DOM/window
renderHeroSSR({ config?: MountConfig, assetBase? }): { html: string; css: string }
// ./hydrate — client: attach the controller to already-rendered SSR markup
hydrate(target): MountHandle                               // + dispose(target)
```

`config` is the host's `MountConfig` (`packages/mf-remote/src/contract.ts`),
the object the host passes every remote, never TOONHUB's own data. TOONHUB has
no routes, so it reads only `assetBase`, and the hero always renders
`toonHubConfig`. Treating `config` as a `ToonHubConfig` broke all three entries
once the host started passing `{ route, onNavigate }`.

Two consumption modes:

- **CSR** — `mount()` sets `innerHTML` from `renderHeroHTML` then inits the controller.
- **SSR** — the host calls `renderHeroSSR()` server-side (from a route loader),
  inlines `html` + `css`, then on the client calls `hydrate()` to attach the
  controller to the existing DOM (reads the SSR-embedded `data-config`).

`./ssr` must stay browser-free (only `renderHeroHTML` + `?inline` CSS + data —
never import the controller or `window`). `./hydrate` and `./mount` are client-only.

## File responsibilities

- `src/data/toonhub.ts` — types + default `toonHubConfig` (single source of
  truth: copy, items, feature flags, timing, a11y, responsive, audio, logging).
- `src/hero-template.ts` — pure function returning the hero HTML string for a
  config. Inlines Lucide icons via `?raw`. This replaces the old `.astro`
  server markup.
- `src/toonhub-carousel.ts` — the framework-free `ToonHubCarousel` controller
  (navigation, autoplay, swipe, keyboard, wheel, parallax, tilt, cursor glow,
  background-effect vars, easter egg, audio engine, logger, reduced motion,
  cleanup). Instantiate with `new ToonHubCarousel(root, config)`; it does NOT
  self-bootstrap.
- `src/styles/hero.css` — all hero styling (scoped under `.toonhub-hero` /
  `.toon-*`), plus a small self-contained reset. No Tailwind, no global leakage.
- `src/mount.ts` — CSR federated entry; rewrites root-relative asset paths to
  this remote's origin (via `import.meta.url`).
- `src/ssr.ts` — SSR-safe entry (`renderHeroSSR` → `{ html, css }`); imports
  `hero.css?inline` for the css string. No controller, no `window`.
- `src/hydrate.ts` — client hydrate entry; attaches the controller to SSR DOM
  (no `hero.css` side-effect — the host inlined it from `./ssr`).
- `src/standalone.ts` + `index.html` — run this remote on its own for dev
  (`pnpm --filter @ncam/toonhub dev`, port 9001).
- `assets/figurines/*.png` + `scripts/download-assets.mjs` — the figurine
  sources (2160×2880, committed; the script fetches any that are missing) and
  what the page serves from them: `public/figurines/<n>-<width>.avif` / `.webp`
  at every width in `src/figurines.ts`, derived with sharp (not committed). Run
  `pnpm --filter @ncam/toonhub assets`; it also runs on predev/prebuild.
- `src/figurines.ts` — published widths and formats, and the `sizes` the
  figurines are picked with: the centre one (the page's LCP) at its drawn size
  with `fetchpriority="high"`, the side ones small until the controller widens
  them all once the page has loaded (each takes the centre in turn).

## Rules

- **Framework-free.** No React/Vue/etc. DOM + TypeScript only.
- **One config object.** Everything configurable lives in `ToonHubConfig`; do
  not add loose parameters.
- **CSS stays scoped.** Every rule under `.toonhub-hero` / `.toon-*`. The remote
  must never style the host shell. No global element selectors.
- **Own your assets.** Anything origin-relative must be resolved against the
  remote origin in `mount.ts` (`withAssetBase`), never the host.
- **Controller is self-cleaning.** Every listener/timer/observer/AudioContext is
  torn down in `destroy()`. `mount()`'s disposer calls it.
- **Roles move by `transform` only** (`hero.css`, carousel): every figurine is
  laid out in the centre's box and drawn at its role's place as a transform of
  it, in the carousel's container units. Transitioning `left`, `height` or
  `bottom` instead was a layout shift on every frame of every slide (CLS 0.18).
- **The entrance is CSS** (keyframes from the first paint, `backwards` fill),
  never a flag the controller sets: hydrating seconds later used to blank a
  hero the visitor was already looking at and fade it back in.
- `build.target` must stay `esnext` (Module Federation uses top-level await).

## Verify

```bash
pnpm --filter @ncam/toonhub build   # emits dist/ incl. remoteEntry.js
pnpm --filter @ncam/toonhub typecheck
```
