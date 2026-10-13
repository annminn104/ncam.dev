# AGENTS.md — apps/chess

Cultivation Chess — international (FIDE) chess where the pieces are floating
cultivation treasures or, side by side, a Blender-built piece set (Holy Order),
played in one of three 3D arenas. Hot-seat or vs Stockfish. React 19 + Vite 8 + React Three Fiber 9 + drei 10 + chess.js,
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
  `React.lazy(() => import('./battle/Battle'))`, named only when `import.meta.env.SSR` is false:
  the server renders the lobby alone, so its build (`dist-ssr`) carries no battle chunk.
- `src/battle/` — the lazy chunk: Canvas, HUD, scene, effects, arenas.
- Assets resolve against the remote's origin via `lib/asset-url.ts`.
- `public/stockfish/` is generated from `node_modules/stockfish` by
  `scripts/copy-stockfish.mjs` (predev/prebuild) and gitignored. Stockfish is
  GPLv3 — its files ship unmodified with their licence. Their names never change
  (`stockfish.js`, `stockfish.wasm`), so `vercel.json` has browsers revalidate them
  (`max-age=0, must-revalidate`; Vercel sends the ETag): `immutable` would keep a returning
  visitor on the old pair after an upgrade (`vercel-config.test.ts`).
- `public/arenas/*.avif` are lobby previews captured from the real scene:
  `pnpm --filter @ncam/chess capture:arenas` with this app's dev server running. The script
  opens the standalone page with `?capture=<id>` (`standalone.tsx`, then App's and Battle's
  `capture`): the battle alone, no HUD or engine, `CaptureCamera` at the arena's
  `ARENA_DEFS[id].capture` view (lower than the rig's resting view, which shows no sky, so the
  sun or moon is in frame), no quality decline (SwiftShader draws it, the same on any machine),
  and `window.__chessReady` after 30 frames. Change a view, re-run it, look at the lobby.
- `public/presets/` holds the figure sets' GLBs (`<preset>/<type>.glb`, `<type>-low.glb`, built
  by `pnpm --filter @ncam/chess art:holy-order`) and the piece-set previews
  (`<id>-{640,320}.avif`, `pnpm --filter @ncam/chess capture:presets`). Both are committed; see
  "Figures (GLB presets)".
- Arena cards: the caption carries its own scrim (`.chess-arena__caption`), as tall as its text
  at any width, at least 66% black from the top of the text down, so the name and lore keep
  4.5:1 over any preview, even white (`contrast.test.ts`).

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
- Inside the host its fixed "← Projects" pill floats over the middle of the top edge. The lobby's
  head, and below 900 px wide the HUD's top bar (short screens excepted), start below it: the host
  sets `--stage-top-inset` on its stage, and standalone it is unset, so nothing moves.

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

## Figures (GLB presets) (`art/`, `battle/scene/presets/figure/`)

- A `'figure'` preset (Holy Order so far) is drawn from GLBs built in Blender by scripts:
  `art/blender/kit.py` (shared helpers, the `SLOTS` order, preview palettes and materials) and
  `art/blender/<preset>/*.py` (the piece builders, chained as `export.py`'s `PRESETS` says).
  `.blend` files are scratch: never committed. CI never runs Blender; the GLBs are committed.
- `pnpm --filter @ncam/chess art:holy-order` (Blender 5.2: `$BLENDER`, else `blender` on PATH)
  runs `art/blender/export.py` headless. That writes one raw GLB per piece and LOD to
  `art/.out/` (gitignored): the parts joined, `_SLOT`, `_LINE` (the part's Solidify outline
  width) and `_KEEP` (the face decals). `scripts/build-figures.mjs` then packs each:
  - weld, then meshoptimizer's simplifier to the budgets in `art/budgets.json`, with the
    `_KEEP` vertices locked, under an error ceiling (1.2e-3 high, 6e-3 low, as a share of the
    figure's size);
  - `_SLOT` and `_LINE` as bytes, positions and normals quantized, `EXT_meshopt_compression`.

  The low LOD also drops the painted linework (parts named `*Lines*` and `GoldScrolls`).
  Blender's ray casts vary in the last bits, so a rebuild rewrites every file: rebuild and
  commit only when a script changed.

- The format is ours and fixed: one mesh, one triangle primitive, `POSITION`, `NORMAL`, `_SLOT`
  (unsigned bytes, an index into `SLOTS`) and `_LINE` (normalized bytes, width / `LINE_MAX`).
  `figure-glb.ts` reads that and nothing else, without three. The tests read the shipped files
  with it: `assets.test.ts` holds them to the budgets, the height ladder, the base and the square.
  Not drei's `useGLTF`: `GLTFLoader` alone costs ~20 KB gzip, and its Draco default fetches a
  decoder from gstatic. Not gltfpack: it drops custom vertex attributes.
- `SLOTS` (`figure/slots.ts`) is the contract between the scripts, the GLBs and the palettes, and a
  test holds it to `kit.py`'s list. Append only. Colours live in `presets/<preset>/palette.ts`,
  never in Blender (kit.py's palettes only colour its previews).
- `FigureRenderer` draws the base, then one geometry twice:
  - `paintMaterial`: a MeshToonMaterial with a soft two-tone ramp and a rim, a gold ramp by view
    angle on `trim`, faceted `gem`, unlit `glow`, and a light floor `L_MIN` so the white side
    survives Blood Moon;
  - `outlineMaterial`: back faces pushed along `outlineNormal` (smooth across sharp edges) by
    `_line`; `_line = 0` parts draw no hull.

  Both materials are cached per preset and side and `own()`ed. The loader `own()`s each
  geometry, and its reset clears R3F's `useLoader` cache. The treasure stands in while a file
  loads, and for good if it fails (`FigureBoundary`, one log line per file). At `'low'` quality
  the low file swaps in place.

- The shader hooks inject at three's chunk anchors (`inject()`), which throws if three renames
  one; `material.test.ts` runs them over three's own sources.
- Captures (`src/capture.ts`, standalone page only):
  `?capture=<arena>&preset=<id>&lineup&view=<home|close|far|orbit>&quality=low`.
  `capture:presets` writes the lobby previews (SwiftShader); `capture:presets -- --review`
  writes the review set (`art/.out/review/`: Metal at DPR 2, an orbit video, frame rates).
  `CHROMIUM_PATH` names a Chromium when Playwright's own build is not installed.
- Adding a figure preset:
  1. its scripts in `art/blender/<preset>/` and a `PRESETS` entry in `export.py`;
  2. its budgets and ladder in `art/budgets.json`, then `node scripts/build-figures.mjs <preset>`;
  3. its palette in `presets/<preset>/palette.ts` and a `FIGURE_PALETTES` entry;
  4. kind `'figure'` in `presets-meta.ts`;
  5. add its id to `PREVIEWS` in `scripts/capture-presets.mjs`, capture the previews with
     `capture:presets` (and its review set with `capture:presets -- --review <id>`), then set
     `ready` and `preview`.
- Gotchas met building them:
  - Blender's camera space looks down +z, so a matcap key there has a negative z; three's view
    space has +z toward the camera;
  - decal ray casts must use the bare mesh, because an outline shell catches the rays;
  - lathe poles skip `rmod`/`zmod`;
  - sun shadows stripe a toon ramp, so keep them off in the previews;
  - simplifying unlocked face decals turns the eyes into faceted diamonds.

## Commands

    pnpm --filter @ncam/chess dev        # :9008 standalone
    pnpm vitest run apps/chess
    pnpm --filter @ncam/chess typecheck
    pnpm --filter @ncam/chess art:holy-order     # Blender 5.2: rebuild the Holy Order GLBs
    pnpm --filter @ncam/chess capture:presets    # lobby previews (dev server running)
