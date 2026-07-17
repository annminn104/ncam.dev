# AGENTS.md — apps/immersive-ocean

Immersive Ocean — a fullscreen creative-studio **hero landing page**: looping
video background, responsive navbar with an animated mobile menu, and staggered
CSS entrance animations. React 19 + Vite 8 + Tailwind CSS v4 + lucide-react,
packaged as a **self-contained** React Module Federation remote.

## What it exposes

`defineRemote` (from `@ncam/mf-remote`) exposes three entries:

```ts
// ./mount   — CSR: createRoot(target).render(<App/>); returns a disposer
// ./ssr     — renderHeroSSR() → { html, css } (renderToString + inline Tailwind CSS)
// ./hydrate — hydrate(target): hydrateRoot(target, <App/>); returns a disposer
```

## Structure

- `src/App.tsx` — root container + background `<video>`; holds `mobileMenuOpen`
  state; composes `Navbar` / `MobileMenu` / `Hero`.
- `src/components/sections/{navbar,mobile-menu,hero}.tsx` — the three pieces.
- `src/data/immersive-ocean.ts` — content config (brand, nav, video URL, copy).
- `src/styles/globals.css` — Tailwind v4 entry: `@import 'tailwindcss'`,
  `@theme { --font-geist }`, the `fadeSlideUp` keyframes, and the `*` reset.
- `src/fonts.ts` — `@fontsource/geist-sans` (family "Geist Sans").
- `src/lib/utils.ts` — `cn()`.
- `src/mount.tsx` / `ssr.tsx` / `hydrate.tsx` / `standalone.tsx` + `index.html`
  (standalone dev, port 9003, mounts `#app`).

## Notes

- **Self-contained**: React is bundled, `shared: {}` via `@ncam/mf-remote`. Do
  not add react/react-dom to `shared` (avoids the React 19 shared-singleton race).
- The **MF remote name is `immersive_ocean`** (underscore — a valid JS
  identifier); the **project id / route is `immersive-ocean`** (kebab).
- Entrance animations are **pure CSS** keyframes (`fadeSlideUp`) via arbitrary
  `animate-[fadeSlideUp_..._both]` — they run on first paint without JS, so SSR
  is safe (no framer-motion, no animate-gating needed).
- `font-geist` maps to `--font-geist` in `@theme`; the video uses inline
  `objectPosition: '70% center'` and no z-index so it sits behind all content.

## Verify

```bash
pnpm --filter @ncam/immersive-ocean typecheck
pnpm --filter @ncam/immersive-ocean build   # emits dist/remoteEntry.js
```
