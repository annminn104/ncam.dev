# AGENTS.md — apps/toonhub

The TOONHUB collectible-figurine hero, packaged as a **framework-free Module
Federation remote**. (Previously a standalone Astro site; now a Vite remote so
the shell can mount it as a micro-frontend.)

## What it exposes

`vite.config.ts` exposes three federated modules:

```ts
// ./mount  — CSR: render + init in one go (used by the standalone dev page)
mount(target, config?): () => void            // + unmount(target)
// ./ssr    — SSR-safe: build initial HTML (+ inlined scoped CSS), NO DOM/window
renderHeroSSR({ config?, assetBase? }): { html: string; css: string }
// ./hydrate — client: attach the controller to already-rendered SSR markup
hydrate(target, config?): () => void           // + dispose(target)
```

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
- `public/` + `scripts/download-assets.mjs` — figurine images (self-hosted; run
  `pnpm --filter @ncam/toonhub assets`, also runs on predev/prebuild).

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
- `build.target` must stay `esnext` (Module Federation uses top-level await).

## Verify

```bash
pnpm --filter @ncam/toonhub build   # emits dist/ incl. remoteEntry.js
pnpm --filter @ncam/toonhub typecheck
```
