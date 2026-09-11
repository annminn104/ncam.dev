# AGENTS.md — apps/profile

The ncam.dev **home-page sections as federated modules**. One self-contained
React 19 + Vite 8 + GSAP remote (`defineRemote` from `@ncam/mf-remote`, MF name
`profile`, port 9006) that exposes **one module per section** instead of one
`./mount` for a whole app:

```
./hero  ./stacks  ./experience  ./projects  ./blog  ./contact
```

Every module has the same shape (`src/lib/section-module.tsx`):

```ts
ssr(): Promise<{ html, css }>   // server: renderToString + the remote's CSS (same string for all)
hydrate(target): () => void     // client: attach React to server-rendered markup
mount(target): () => void       // client: render from scratch (no SSR) — injects the CSS once
```

**Chunk-cycle rule (important).** Each `src/modules/*.tsx` entry writes its own
`await import('react-dom/server')` and hands `renderToString` to
`renderSection()`. Do NOT move that lazy import into the shared helper: the
helper chunk also holds React, so the server chunk would import it back — a
chunk cycle that the host's SSR entry loader (temp-file strategy) deadlocks on,
timing out every home section on the server. The federation plugin ignores
`manualChunks` / `codeSplitting.groups`, so this can only be fixed in source.
Check with: no cycles when walking `dist/remoteEntry.ssr.js` → `./assets/*`.

The portfolio host (`apps/portfolio/src/routes/index.tsx`) imports the six
modules with static specifiers, server-renders them in parallel through the MF
runtime, inlines the returned HTML + CSS, then hydrates each into its slot. The
manifest rail on the host shows the real lifecycle of each module.

## Structure

- `src/modules/*.tsx` — the exposed entries; each wraps one section component
  with `createSectionModule()`.
- `src/components/*.tsx` — the sections (hero, tech-stacks, experiences,
  projects, blogs, contact) + `section-head.tsx`. Presentational; copy comes
  from `src/data/profile.ts` (still placeholder: `profile.email`, the blog posts).
- `src/lib/gsap.ts` — `useGsap()` (gsap.matchMedia: skipped under reduced motion,
  desktop breakpoint 960px, reverted on unmount → StrictMode-safe),
  `useRevealChildren()`, `useMagnetic()`.
- `src/styles/profile.css` — every section's CSS. Imports
  `@ncam/design-tokens/tokens.css`; reads `--page-bg` (set/tweened by the host,
  falls back to `--bg`) and `--rail-w` (the host's manifest rail width, so the
  section grid lines up with the shell).
- `src/standalone.tsx` + `index.html` — dev page on :9006 mounting all six
  sections in order (no host shell). Fonts are imported **here only**
  (`src/fonts.ts`): inside the host the fonts come from the host's stylesheet,
  so the exposed modules never double-download them.

## Contracts with the host

- **Section ids** rendered by the components (`top`, `stacks`, `experience`,
  `projects`, `blog`, `contact`) must match `apps/portfolio/src/data/sections.ts`
  — the host's nav, rail and scroll tracker key off them.
- Each `<section>` is mounted into a `display: contents` slot, so it is a direct
  child of the host's `<main>`: the sticky hero needs the page, not a wrapper, as
  its containing block.
- Transitions **between** sections are the host's job (page background tween,
  the hero "unmount" while `#stacks` slides over it). Motion **inside** a section
  is this remote's job (hero intro, marquee + pinned stack strip, stacked
  experience cards, project-card tilt/spotlight, contact word reveal).
- The projects section renders plain `<a href="/projects/<id>">`; the host
  intercepts those clicks for client-side navigation.
- React and GSAP are bundled (`shared: {}`); the six modules share one React and
  one GSAP instance inside this remote, each section is its own React root.

## GSAP rules

Same as `apps/bali`: everything through `useGsap()`, `fromTo` with the markup as
the end state, stagger `wrapper.children` (never ref arrays), pinned strip pins
its own wrapper (`.stacks__pin`) and toggles `.is-pinned` to switch the track
from native scroll-snap to a transform.

## Verify

```bash
pnpm --filter @ncam/profile typecheck
pnpm --filter @ncam/profile build     # emits dist/remoteEntry.js (+ remoteEntry.ssr.js)
pnpm --filter @ncam/profile dev       # standalone on http://localhost:9006
```

With the host running (`pnpm dev`), open http://localhost:9000 — in `vite dev`
the sections client-mount (federated SSR only works in the production build).
