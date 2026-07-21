# AGENTS.md — apps/viktor

Viktor — a full-screen **hero landing page**: three looping background videos with
crossfade switching, Figtree font, animated name "Viktor.", availability dot with accent
glow, and a CTA button with fill-up hover. React 19 + Vite 8 + Tailwind CSS v4 +
lucide-react, packaged as a **self-contained** React Module Federation remote.

## What it exposes

`defineRemote` (from `@ncam/mf-remote`) exposes three entries:

```ts
// ./mount   — CSR: createRoot(target).render(<App/>); returns a disposer
// ./ssr     — renderHeroSSR() → { html, css } (renderToString + inline Tailwind CSS)
// ./hydrate — hydrate(target): hydrateRoot(target, <App/>); returns a disposer
```

## Structure

- `src/App.tsx` — root container; holds `activeIndex` state + video preload (blob URLs);
  renders `<Navbar>` + `<Hero>`.
- `src/components/Navbar.tsx` — desktop nav (numbered links, email, live clock) + mobile
  hamburger with CSS grid expand/collapse panel.
- `src/components/Hero.tsx` — video switcher buttons, availability dot (pink glow on
  slide 0, white on 1-2), giant "Viktor." name with animated period, paragraph + CTA
  button with fill-up hover.
- `src/styles/globals.css` — Tailwind v4 entry: `@import 'tailwindcss'`,
  `@theme { --font-figtree }`, custom `@variant mobile/md-tablet`, `revealUp`,
  `revealRight`, `dotPulse` keyframes, `.nav-link-underline`, `.role-link`, `.cta-btn`.
- `src/fonts.ts` — `@fontsource/figtree` (400/500/600).
- `src/lib/utils.ts` — `cn()`.
- `src/mount.tsx` / `ssr.tsx` / `hydrate.tsx` / `standalone.tsx` + `index.html`
  (standalone dev, port 9004, mounts `#app`).

## Notes

- **Self-contained**: React is bundled, `shared: {}` via `@ncam/mf-remote`. Do
  not add react/react-dom to `shared`.
- **MF remote name / project id / route are all `viktor`** (single word — already
  a valid JS identifier, so no underscore/kebab split like the other remotes).
- Slide 0 accent = `#F598F2` (pink); slides 1-2 accent = white. Both the availability
  dot glow and the "." in the name track `activeIndex`.
- Videos are preloaded as blob URLs on mount for instant crossfade. Original CDN
  URLs are used until blobs resolve.
- Reveal animations (`revealUp`, `revealRight`) are triggered once via
  `IntersectionObserver` (threshold 0.35); disabled under `prefers-reduced-motion`.
- CTA button fill uses a `::before` translateY trick (class `.cta-btn`); the label
  inside needs class `cta-btn-label` for the color transition to black on hover.

## Verify

```bash
pnpm --filter @ncam/viktor typecheck
pnpm --filter @ncam/viktor build   # emits dist/remoteEntry.js
```
