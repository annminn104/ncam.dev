# AGENTS.md — apps/bali

Bali Adventure — a cinematic, dark-mode **luxury travel landing page** (single
page, 12 sections): GSAP pinned 3-layer parallax hero, interactive destination
grid with split modal, pricing grid, alternating experience blocks with clip-path
reveals, a pinned horizontal-scroll itinerary, stats with count-up, a bento
gallery with full-screen viewer, a film section, testimonials, a booking form and
a footer. React 19 + Vite 8 + Tailwind CSS v4 + **GSAP (ScrollTrigger)** +
**framer-motion** + lucide-react, packaged as a **self-contained** React Module
Federation remote (same model as `apps/viktor`, which it was copied from).

Origin: the brief was a Next.js 14 "master implementation prompt". It was ported
to this repo's stack — no Next.js, no `tailwind.config.ts`; `<Link>` → plain
`<a href="#section">` anchors; Tailwind config → CSS-first `@theme`.

## What it exposes

`defineRemote` (from `@ncam/mf-remote`) exposes three entries:

```ts
// ./mount   — CSR: createRoot(target).render(<App/>); returns a disposer
// ./ssr     — renderHeroSSR() → { html, css } (renderToString + inline Tailwind CSS)
// ./hydrate — hydrate(target): hydrateRoot(target, <App/>); returns a disposer
```

## Structure

- `src/App.tsx` — section order (Navbar → Hero → Destinations → Packages →
  Experiences → Itinerary → WhyChooseUs → Gallery → VideoExperience →
  Testimonials → Booking → Footer), a `<noscript>` reveal for the hero copy, and
  a late `ScrollTrigger.refresh()` (fonts ready / `load` / 700 ms).
- `src/data/bali.ts` — **single source of truth** for all copy, lists and media
  URLs (`unsplash(id, width)` helper, hero layer URLs, film sources + credit).
- `src/components/sections/*` — one file per section (kebab-case, as mindloop).
- `src/components/ui/section-heading.tsx` (`SectionHeading`, `Accent` = serif
  italic lime word), `ui/modal.tsx` (framer-motion dialog shell: backdrop,
  Escape, scroll lock, focus), `common/logo.tsx`, `common/social-icon.tsx`.
- `src/lib/gsap.ts` — registers ScrollTrigger (guarded for SSR), `useGsap()`
  (matchMedia wrapper) and `useRevealChildren()` (stagger a wrapper's children).
- `src/lib/use-dialog.ts` — `useScrollLock`, `useDialog`.
- `src/styles/globals.css` — Tailwind v4 entry: `@theme` tokens, `.glass`,
  `.eyebrow`, `.btn-lime`, `.btn-outline`, `.nav-link`, `.field`, `.glow-lime`,
  keyframes, reduced-motion rules.
- `src/fonts.ts` — `@fontsource-variable/outfit`, `@fontsource-variable/playfair-display`
  (+ italic), `@fontsource/anton`.
- `src/mount.tsx` / `ssr.tsx` / `hydrate.tsx` / `standalone.tsx` + `index.html`
  (standalone dev, port 9005, mounts `#app`).

## Design tokens (spec → Tailwind v4 `@theme`)

| Spec name       | Token                       | Utility                                                               |
| --------------- | --------------------------- | --------------------------------------------------------------------- |
| `jungle-black`  | `--color-jungle-black`      | `bg-jungle-black`                                                     |
| `tropical-lime` | `--color-tropical-lime`     | `text-tropical-lime`, …                                               |
| `text-gray`     | `--color-soft-gray`         | `text-soft-gray`                                                      |
| `text-white`    | `--color-off-white`         | `text-off-white`                                                      |
| fonts           | `--font-sans/serif/display` | `font-sans` (Outfit), `font-serif` (Playfair), `font-display` (Anton) |

The body background is applied to the **root div** (`[data-bali-root]`), not
`<body>`, so the remote does not repaint the host page.

## GSAP rules (StrictMode-safe)

- Every animation goes through `useGsap()` → `gsap.matchMedia()`. It is skipped
  under `prefers-reduced-motion: reduce`, re-run across the `md` breakpoint and
  fully reverted on unmount — StrictMode's double effects leave no orphaned
  ScrollTriggers or `opacity: 0` elements.
- Grids stagger via `useRevealChildren()` = one `gsap.fromTo(wrapper.children, …)`.
  **Never** use arrays of refs with `gsap.from` (invisible cards in StrictMode).
- All tweens are `fromTo` whose end state equals the markup, so the SSR HTML is
  the final layout. The one exception is the hero's revealed copy, hidden inline
  (`opacity: 0`) so server and hydrate markup match; `<noscript>` and the
  reduced-motion CSS reveal it.
- Hero: section pinned for `+=160%`, `scrub: 1`; layers 1/2 move up, layer 3
  down, the "BALI" wordmark drops + fades, then the copy fades up.
- Itinerary (md+): the pin container pins for `track.scrollWidth` px while the
  **panels** (`track.children`, each `min-w-full`) translate
  `xPercent: -100 * (n − 1)`. `xPercent` is relative to the target's own width,
  so it must target the panels, not the track. Below md the days stack.
- Hosted in the portfolio the **window** scrolls (`.stage` is normal flow), so
  the default ScrollTrigger scroller works unchanged.

## Notes

- **Self-contained**: React is bundled, `shared: {}` via `@ncam/mf-remote`. Do
  not add react/react-dom to `shared`.
- **MF remote name / project id / route are all `bali`.**
- Navbar is a centred fixed pill at `top: var(--stage-top-inset, 1.25rem)`. The
  host sets `--stage-top-inset` on `.stage` so the pill clears its fixed
  "← Projects" button; standalone it sits at 1.25rem.
- Media: Unsplash photos (ids in `data/bali.ts`), hero layers on the strvid CDN,
  film = "Bali – Pura Tirta Empul (2025)" by Chainwit., **CC BY 4.0** (Wikimedia
  Commons) — keep the on-page credit if you swap the clip for another CC file.
- Booking + newsletter forms are **demo flows**: no backend; the submitted
  details are echoed back as a confirmation state.
- Modals render inside the remote's tree (no portal) at `z-[80]`; the host's back
  button (`z-index: 9999`) intentionally stays above them.

## Verify

```bash
pnpm --filter @ncam/bali typecheck
pnpm --filter @ncam/bali build   # emits dist/remoteEntry.js
pnpm --filter @ncam/bali dev     # standalone on http://localhost:9005
```
