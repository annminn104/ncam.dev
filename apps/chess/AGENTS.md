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
- `src/engine/` — Stockfish UCI client (`engine.ts`), its levels and UCI parsing. `spawn.ts` is
  browser-only; `download.ts` and `lazy-worker.ts` are what it is built from, tested in Node.
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
  `Battle` runs `disposeOwned()` when it unmounts. A dispose or reset that throws stops none of
  the others; the failure is thrown after them, and Battle only logs it.
- `PieceView` keeps a piece's pose in a ref and writes the group every frame. R3F re-applies a
  group's props whenever React re-inserts it into the scene, and a move re-orders
  `snap.pieces`, so a pose read back off the group (or a `position` prop that follows the
  square) snaps the piece mid-move.
- Battle stops the frame loop while the tab is hidden (`frameloop="never"`), and R3F restarts its
  clock from 0 whenever the loop starts again. A pose computed from the clock is fine; anything
  timed by a start time against the clock must sum frame deltas instead (`glide.ts`). R3F may
  draw one more frame after the switch, with a huge delta: deltas must be safe to be large.
- `CameraRig` (camera-controls through drei) has no pan: `truckSpeed={0}` zeroes every mouse and
  touch pan path. `framingFit` (`rig-math.ts`) pulls the camera back on screens narrower than
  1.5:1 so the board's width fits, down to `MIN_ASPECT` (0.38): any further and the camera
  would pass the scenery and the horizon walls. `reset` and `faceSide` aim at the nearest full
  turn of azimuth, which only ever accumulates.
- When a battle cannot open the player must still have the lobby. `hasWebgl()` probes WebGL 2
  only (three 0.186 creates nothing else), and `BattleErrorBoundary` (`src/ErrorBoundary.tsx`)
  wraps the battle's `Suspense` in `App`: a chunk that fails to load, a renderer that cannot
  start or a scene that throws (R3F rethrows from its Canvas) shows `ArenaFailed` instead of
  React unmounting the whole root. Both fallbacks are styled in `globals.css`, not
  `battle.css`: the chunk is what may have failed. There is no retry to offer: `lazy()` and
  Chromium both remember a rejected dynamic import (a cache-busted URL loads, the same one
  fails until a reload), so the way out is the lobby and the message says to reload.
- `THREE.Clock … deprecated` in the console is R3F 9.8's own, not ours.

## The HUD (`battle/Hud.tsx`, dialogs, `BoardA11y.tsx`)

- `Battle` lays a `.chess-hud` grid over the canvas and `Hud` renders its parts into it (top bar,
  side panel, game controls; the keyboard board goes between the top bar and the controls, which
  is its place in the Tab order). The layer lets the pointer through except on its controls.
- While a modal is open (`PromotionDialog`, `ResultOverlay`) the layer is `inert`, so Tab stays
  in the modal. `useDialog` moves focus into it, hands it back to whatever had it, and maps
  Escape (cancel / "View the board") wherever the focus is.
- Arenas run from Cloud Peak's near-white sky to Blood Moon's black ground: HUD text only ever
  sits on `--hud-panel`, and a control's edge is `--hud-edge` on a panel. `hud-contrast.test.ts`
  holds 4.5:1 text and 3:1 edges over both extremes; don't put HUD text straight on the scene.
- `BoardA11y` is a visually hidden grid of buttons mirroring the board (roving tabindex; the 3D
  gold cursor shows its focus). It is laid out from the end the camera looks from
  (`CameraRig onViewSide`, `viewSideOf`), so arrow keys follow the screen. Its rows are keyed by
  rank: when the view turns React moves them, and the focused square keeps its focus.
- Undo rules live in `undo.ts` (`undoPlies`): hot-seat 1 ply, vs AI 2 (1 after the player's own
  game-ending move), off while the AI thinks; a resignation or an agreed draw is taken back
  alone (0 plies). `thinking` (the AI's turn) is passed in by `Battle`.
- A hot-seat draw offer stands only in the position it was made in (`draw-offer.ts`): `Hud`
  shows every position it renders to `offerIn()`, so the first move, undo or verdict withdraws
  it for good and no undo brings it back.
- Once a battle is over the game controls carry Rematch, so "View the board" never strands the
  players (the lobby is always in the top bar).
- Phones (≤ 720 px wide) get the side panel under the board. A short screen of any width
  (≤ 500 px tall, a phone on its side) hides it and stands the game controls in a slim column on
  the left under the turn, where the board's sides leave room; a draw offer takes that column's
  place until it is answered.

## vs AI (`battle/useAiOpponent.ts`, `engine/`)

- One engine per battle, only vs the AI with a playable board (not hot-seat, capture mode or a
  WebGL fallback). It is warmed up a tick after the battle mounts, so the ~7 MB download overlaps
  the player's first move. The tick is there because StrictMode's dev-only remount disposes the
  first engine at once, and then nothing has been fetched.
- `spawnStockfish` downloads the wasm on the page (`download.ts`) and only then creates the worker,
  which loads the wasm from a blob URL in its hash. A worker's own fetch can't be watched, so the
  engine's handshake clock (10 s) could not tell a slow network from a dead engine. Now
  `lazyWorker` hands `createEngine` a stand-in at once, whose `loaded` starts that clock when the
  real worker exists. A download fails only when it stalls (20 s without a byte); a slow one that
  keeps coming never does.
- A Stockfish that fails to load errors its worker (the loader rethrows), and `onerror` makes a
  blocked wasm fail at once. A failed call stops its worker, and a stopped worker's late lines
  are ignored, so an abandoned search can't answer the next call.
- `thinking` is "the AI is to move in a live game and nothing has failed". It covers loading, so
  the elder meditates while Stockfish is still downloading. The AI's effect follows `fen` and
  whether the game is over, so undoing a resignation made on the AI's turn hands it the move again.
- A warm-up failure is only logged: the AI's move asks again (try + retry) before the toast
  (`EngineToast`) says anything. Retry asks again. "Switch to hot-seat" flips Battle's own `mode`
  state; a remount would lose the position.

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
- The lake's mirror is `LakeMirror`: drei's reflector material and blur pass (deep imports from
  `@react-three/drei/materials/`) driven by our own frame code, because drei's
  `<MeshReflectorMaterial>` never frees its render targets (~10 MB left on the GPU after every
  drop to the plain lake). It takes the mirror's normal from the mesh's rotation (local +z):
  rotate the mesh, never the plane geometry, or it mirrors across a wall. It renders the whole
  scene a second time each frame; `PerformanceMonitor` swaps it for a plain material.
- Scenery that rises above the board must stay out of every reachable camera's view of it:
  `layout.test.ts` checks every column against the rig's `ORBIT` limits (`rig-math.ts`), at
  every aspect down to (and below) `MIN_ASPECT`.
- Visual checks headless: SwiftShader declines to `'low'` within seconds; for the `'high'`
  path launch Chromium with `--use-angle=metal` (the real GPU).

## Effects and the quality fallback (`battle/scene/effects/`, `battle/quality.ts`)

- `CaptureBurst`: one pooled `Points` cloud, re-seeded by each capture where the victim stood, in
  its sect's qi (`capturedPiece`: the piece id that disappeared, so an en passant victim bursts on
  its own square; an undo brings a piece back and bursts nothing). `CheckAura`: a pulsing ring
  under the king in check.
- `QiTrail`: a camera-facing ribbon laid along the glide's own arc (`glide.ts`, `qi-trail.ts`),
  written by its `PieceView` right after it moves the piece, so its head is the piece that frame.
  A finished glide is kept until its trail has landed too. Not drei's `<Trail>`: that one leaks
  a MeshLine geometry and material per mount, starts every trail from the board's centre and
  allocates every frame. Normal blending: additive qi over Cloud Peak's white jade turns white.
- A drop to `'low'` (PerformanceMonitor's decline) gives dpr 1, 1024² shadow maps, a subset of
  the same cloud puffs (`thinnedPuffs`), the first of the same motes (a draw range), the plain
  lake, 80 of the burst's 200 particles and no trails. It never rebuilds or moves what stays.
- Leaks: three r186 keeps one DFG lookup texture for all its renderers and never frees it; each
  renderer's dispose listener on it kept every finished battle's renderer alive. Battle calls
  `releaseSharedLut()` (`materials.ts`) when its context is lost, which is how every battle ends.
  R3F's frame loop keeps the last root's state until another root runs (one renderer at most);
  in dev, React Refresh also keeps every R3F root it has seen (dev only).

## Commands

    pnpm --filter @ncam/chess dev        # :9008 standalone
    pnpm vitest run apps/chess
    pnpm --filter @ncam/chess typecheck
