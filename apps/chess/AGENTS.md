# AGENTS.md — apps/chess

Cultivation Chess — international (FIDE) chess where the pieces are floating
cultivation treasures, played in one of three 3D arenas. Hot-seat or vs
Stockfish. React 19 + Vite 8 + React Three Fiber 9 + drei 10 + chess.js,
packaged as a **self-contained** React Module Federation remote (same model as
`apps/viktor`). Port **9008**.

## What it exposes

`./mount`, `./ssr`, `./hydrate` through `defineRemote()`. `config` is the
host's `MountConfig`; only `assetBase` is read. Not route-aware.

## Layout and rules

- `src/game/` — the only place chess rules live (wraps chess.js). Pure TS, unit-tested.
- `src/engine/` — Stockfish UCI client. `spawn.ts` is browser-only.
- `src/lobby/`, `App.tsx`, `ssr.tsx`, `settings.ts`, `arenas-meta.ts`, `lib/` —
  SSR-safe; they must never statically import three, `@react-three/*` or
  `src/battle/**` (a test walks the import graph to enforce it). The battle is
  `React.lazy(() => import('./battle/Battle'))`.
- `src/battle/` — the lazy chunk: Canvas, HUD, scene, effects, arenas.
- Assets resolve against the remote's origin via `lib/asset-url.ts`.
- `public/stockfish/` is generated from `node_modules/stockfish` by
  `scripts/copy-stockfish.mjs` (predev/prebuild) and gitignored. Stockfish is
  GPLv3 — its files ship unmodified with their licence.
- `public/arenas/*.avif` are lobby previews captured from the real scene:
  `pnpm --filter @ncam/chess capture:arenas` with this app's dev server running.

## Commands

    pnpm --filter @ncam/chess dev        # :9008 standalone
    pnpm vitest run apps/chess
    pnpm --filter @ncam/chess typecheck
