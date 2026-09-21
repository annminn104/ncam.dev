# AGENTS.md — apps/holodex

Holodex — a **Pokémon TCG database explorer** on the TCGdex API: browse every
series, set and card, filter by type and rarity, track a collection, and
inspect a card rendered with a three.js WebGL holo foil keyed to its rarity.
React 19 + Vite 8 + Tailwind CSS v4 + TanStack Query + three.js, packaged as a
**self-contained** React Module Federation remote (same model as
`apps/bali` / `apps/viktor` / `apps/mindloop` / `apps/immersive-ocean`).

**Current state: scaffold only.** This app was created to give
`/projects/holodex` a real (if nearly empty) remote to mount; `App.tsx` is a
placeholder heading. The full design — routing, the TCGdex client, browse/card
views, foil tiers, the WebGL renderer, the collection and pricing — is staged
across the rest of the implementation plan, not yet built here. Full design:
[`docs/superpowers/specs/2026-09-21-holodex-design.md`](../../docs/superpowers/specs/2026-09-21-holodex-design.md);
task-by-task plan:
[`docs/superpowers/plans/2026-09-21-holodex.md`](../../docs/superpowers/plans/2026-09-21-holodex.md).

## What it exposes

`defineRemote` (from `@ncam/mf-remote`) exposes three entries:

```ts
// ./mount   — CSR: createRoot(target).render(<App/>); returns a disposer
// ./ssr     — renderHeroSSR() → { html, css } (renderToString + inline Tailwind CSS)
// ./hydrate — hydrate(target): hydrateRoot(target, <App/>); returns a disposer
```

`mount` / `hydrate` accept an optional `config?: MountConfig` (`route`,
`onNavigate`, `assetBase` — from `@ncam/mf-remote`'s host↔remote contract) and
return a `MountHandle` disposer. Holodex does not yet read `route` or call
`onNavigate`; a later task wires internal routing through them.

## Structure

- `src/App.tsx` — placeholder (`<h1>Holodex</h1>`). Replaced once routing and
  the view switch land.
- `src/styles/globals.css` — Tailwind v4 entry: `@theme` holo palette tokens
  (`--color-holo-bg/panel/line/text/muted/accent`) and the `.holodex` root
  class (background + min-height, applied instead of `<body>` so the remote
  never repaints the host page).
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge).
- `src/mount.tsx` / `ssr.tsx` / `hydrate.tsx` / `standalone.tsx` + `index.html`
  (standalone dev, port 9007, mounts `#app`).

## Notes

- **Self-contained**: React is bundled, `shared: {}` via `@ncam/mf-remote`. Do
  not add react/react-dom to `shared`. React is pinned to exactly `19.3.0`
  (also `@types/react` / `@types/react-dom`) — a second copy at a different
  version is the one thing that breaks federation here.
- **MF remote name / project id / route are all `holodex`** (single word —
  already a valid JS identifier).

## Verify

```bash
pnpm --filter @ncam/holodex typecheck
pnpm --filter @ncam/holodex build   # emits dist/remoteEntry.js
pnpm --filter @ncam/holodex dev     # standalone on http://localhost:9007
```
