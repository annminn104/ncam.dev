# AGENTS.md — apps/mindloop

Mindloop — a dark monochrome newsletter/content **landing page**, built with
React 19 + Vite 8 + **Tailwind CSS v4** + framer-motion + hls.js, packaged as a
**React Module Federation remote**. Structure mirrors `apps/toonhub` (a
`data/` config module, a `styles/` entry, a `standalone` dev entry, `vercel.json`).

## What it exposes

`vite.config.ts` exposes three entries (same SSR + hydrate pattern as toonhub):

```ts
// ./mount   — CSR: createRoot(target).render(<App/>); returns a disposer
// ./ssr     — renderHeroSSR() → { html, css }: renderToString(<App/>) + inline Tailwind CSS
// ./hydrate — hydrate(target): hydrateRoot(target, <App/>); returns a disposer
```

The host SSRs the page for crawlers / first paint via `./ssr` (server-side),
inlines the returned CSS, then attaches React on the client via `./hydrate`.
Federated SSR resolution only works in the production build; in `vite dev` the
host falls back to client-side `./mount`.

**Self-contained — React is bundled, NOT shared.** The Vite config comes from
`@ncam/mf-remote`'s `defineRemote()`, which sets `shared: {}`. mindloop bundles
its own React and mounts into a plain DOM element with its own root, fully
isolated from the host's React. This is the same self-contained model as
`toonhub`, and it avoids Module Federation shared-singleton version/init races —
notably React 19's `Cannot read properties of undefined (reading 'S')`, which
occurs when a shared React singleton isn't seeded (e.g. running standalone).

SSR-safety: `hls.js` is lazy-loaded inside the CTA effect (not imported at
module load) so `./ssr` stays importable server-side. framer-motion entrance
styles render `opacity:0` in the SSR HTML — the content is in the DOM (good for
crawlers), and a `<noscript>` override in `App.tsx` reveals it for no-JS users.

## Structure

- `src/App.tsx` — the whole landing page (Navbar, Hero, Search-changed, Mission
  with scroll word-reveal, Solution, CTA with HLS, Footer) + `fadeUp` helper.
  Presentational only; all copy/lists/media come from the config.
- `src/data/mindloop.ts` — **single source of truth** for content: video URLs,
  nav links, socials, hero copy, platform cards, mission paragraphs, solution
  features, CTA + footer text (mirrors toonhub's `data/toonhub.ts`).
- `src/styles/globals.css` — Tailwind v4 entry: `@import 'tailwindcss'`,
  `@custom-variant dark`, design tokens (HSL vars) mapped in `@theme inline`,
  base layer, and `.liquid-glass`.
- `src/components/ui/*` — small shadcn-style `Button` (cva) + `Input`.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge).
- `src/fonts.ts` — `@fontsource` imports (bundled/injected on mount).
- `src/mount.tsx` / `src/ssr.tsx` / `src/hydrate.tsx` — the three federated
  entries. `src/standalone.tsx` + `index.html` — standalone dev preview
  (port 9002), mounting into `#app`.
- `vercel.json` — Vite framework preset + `Access-Control-Allow-Origin: *` so
  the host can load `remoteEntry.js` cross-origin.

## Tailwind v4 notes

- **No `tailwind.config.ts` and no PostCSS** — config is CSS-first. The
  `@tailwindcss/vite` plugin is registered in `vite.config.ts`; content sources
  are auto-detected. Do **not** re-add `postcss.config.js` / `autoprefixer`.
- Colours are defined as HSL triplets under `:root` and exposed to utilities via
  `@theme inline { --color-*: hsl(var(--*)) }`, which keeps `bg-background/45`
  opacity modifiers working and tokens runtime-overridable.
- v4 renamed some utilities — notably `bg-gradient-to-*` → `bg-linear-to-*`
  (used by the hero fade). Keep this in mind when adding gradients.

## Rules / notes

- **Monochrome only** — pure black bg, white fg; no colours/gradients beyond the
  tokens. Italic accent words use `font-serif` (Instrument Serif).
- Videos are external (CloudFront MP4s + a Mux HLS stream); CTA uses `hls.js`
  with a native-HLS fallback (`canPlayType('application/vnd.apple.mpegurl')`).
- **Avatars + platform icons are inline monochrome SVG placeholders** (in
  `App.tsx`), not PNGs — this keeps assets working across standalone + federated
  mounting (no cross-origin `/asset.png` resolution problem). Swap for real brand
  images by hosting them at an absolute URL if needed.
- React is **bundled**, not shared (`shared: {}` via `@ncam/mf-remote`). Two React
  instances (host's + mindloop's) coexist fine because mindloop's tree is isolated
  in its own root — do not re-add react/react-dom to `shared`.
- The Vite/federation setup lives in `@ncam/mf-remote` (`defineRemote`), shared with
  toonhub; `@module-federation/vite` is centralised there (pinned `1.17.0`).
- Tailwind preflight is global; when mounted in the host it applies app-wide for
  that view — acceptable for the full-screen project stage.

## Verify

```bash
pnpm --filter @ncam/mindloop typecheck
pnpm --filter @ncam/mindloop build   # emits dist/remoteEntry.js
```
