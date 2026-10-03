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
- `src/lobby/`, `App.tsx`, `ErrorBoundary.tsx`, `ssr.tsx`, `settings.ts`, `arenas-meta.ts`,
  `lib/` — SSR-safe; they must never statically import three, `@react-three/*` or
  `src/battle/**` (a test walks the import graph to enforce it). The battle is
  `React.lazy(() => import('./battle/Battle'))`.
- `src/battle/` — the lazy chunk: Canvas, HUD, scene, effects, arenas.
- Assets resolve against the remote's origin via `lib/asset-url.ts`.
- `public/stockfish/` is generated from `node_modules/stockfish` by
  `scripts/copy-stockfish.mjs` (predev/prebuild) and gitignored. Stockfish is
  GPLv3 — its files ship unmodified with their licence.
- `public/arenas/*.avif` are lobby previews captured from the real scene:
  `pnpm --filter @ncam/chess capture:arenas` with this app's dev server running.

## The battle scene

- `battle/Battle.tsx` is the chunk's root. `useGame` is the one place React state wraps
  `createGame()`; the scene calls `game.clickSquare` and never decides legality.
- A module-level cache of GPU objects (treasure geometry, materials, glyph textures) wraps what
  it creates in `own()` and registers its reset with `onDispose()` (`scene/dispose.ts`);
  `Battle` runs `disposeOwned()` when it unmounts.
- `PieceView` keeps a piece's pose in a ref and writes the group every frame. R3F re-applies a
  group's props whenever React re-inserts it into the scene, and a move re-orders
  `snap.pieces`, so a pose read back off the group (or a `position` prop that follows the
  square) snaps the piece mid-move.
- `CameraRig` (camera-controls through drei) has no pan: `truckSpeed={0}` zeroes every mouse and
  touch pan path. `framingFit` (`rig-math.ts`) pulls the camera back on screens narrower than
  1.5:1 so the board's width fits; `reset` and `faceSide` aim at the nearest full turn of
  azimuth, which only ever accumulates.
- When a battle cannot open the player must still have the lobby. `hasWebgl()` probes WebGL 2
  only (three 0.186 creates nothing else), and `BattleErrorBoundary` (`src/ErrorBoundary.tsx`)
  wraps the battle's `Suspense` in `App`: a chunk that fails to load, a renderer that cannot
  start or a scene that throws (R3F rethrows from its Canvas) shows `ArenaFailed` instead of
  React unmounting the whole root. Both fallbacks are styled in `globals.css`, not
  `battle.css`: the chunk is what may have failed. There is no retry to offer: `lazy()` and
  Chromium both remember a rejected dynamic import (a cache-busted URL loads, the same one
  fails until a reload), so the way out is the lobby and the message says to reload.
- `THREE.Clock … deprecated` in the console is R3F 9.8's own, not ours.

## The arenas (`battle/scene/arenas/`)

- `ARENA_DEFS` gives each `ArenaId` its board skin (`skins.ts`), clear colour and an
  `Environment` that owns its sky, fog, lights (one shadow-casting `KeyLight`) and effects.
  Everything is painted in code (`textures.ts`, `scenery.ts`): nothing is fetched. drei's
  `<Clouds>` would fetch a PNG from a CDN and `<Environment preset>` an HDRI; don't use them.
- The pieces keep their studio `envMap` (`materials.ts`): an arena reaches them through its key
  light, hemisphere and fog, not `scene.environment`.
- `ArenaFog` measures from the board, not the camera: a phone pulls the camera ~3× further back,
  and world-fixed fog would hide the board there.
- `SkyDome` is drawn at the far plane (`gl_Position.z = w`) and its horizon is the fog colour, so
  ground running into the haze meets the sky without a seam.
- drei's `MeshReflectorMaterial` takes the mirror's normal from the mesh's rotation (local +z):
  rotate the mesh, never the plane geometry, or it mirrors across a wall. It renders the whole
  scene a second time each frame; `PerformanceMonitor` swaps it for a plain material.
- Scenery that rises above the board must stay out of every reachable camera's view of it:
  `layout.test.ts` checks every column against the rig's `ORBIT` limits (`rig-math.ts`).
- Visual checks headless: SwiftShader declines to `'low'` within seconds; for the `'high'`
  path launch Chromium with `--use-angle=metal` (the real GPU).

## Commands

    pnpm --filter @ncam/chess dev        # :9008 standalone
    pnpm vitest run apps/chess
    pnpm --filter @ncam/chess typecheck
