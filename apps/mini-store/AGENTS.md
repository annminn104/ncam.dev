# AGENTS.md — apps/mini-store

## What this is

**Mini Store**: a Saigon street corner on a rainy night and its convenience store, built as a
miniature diorama. A hand-written WebGL2 renderer (no three.js) inside a small React 19 shell,
packaged as a self-contained Module Federation remote (`mini_store`, :9009) that the host mounts
at `/projects/mini-store`. Ported on 2026-10-25 from a standalone project (React 18 + Vite 5,
single-file build); this copy is the source of truth now.

## Commands

```bash
pnpm --filter @ncam/mini-store dev             # standalone on :9009
pnpm --filter @ncam/mini-store build           # vite build --app (client + SSR graph)
pnpm --filter @ncam/mini-store typecheck
pnpm --filter @ncam/mini-store capture:poster  # needs the dev server; rewrites src/assets/poster
```

## Controls

- Click the glass door (or **O**): the sliding door opens with a chime and closes after 5 s.
- Drag: orbit · Shift or right-drag: pan · Scroll or pinch: zoom · Double-click: reset the camera.
- **C** auto-orbit · **Esc** stop it · **H** hide the overlay (never the host's back button).
  The single-key shortcuts stand aside while a text-entry control has focus (`src/keys.ts`,
  `takesText`: text-like inputs, textarea, select, contenteditable). A slider, checkbox or button,
  the settings panel's own controls, does not suppress them.
- Settings panel, once live: rain, exposure, fog, bloom, SSAO, traffic, auto-orbit. On a desktop
  it stays open. On a phone (≤ 640px) it folds into a **Settings** button (with the live fps and a
  chevron) at the bottom right that opens it, so it does not cover the diorama; CSS alone decides
  which applies
  (`src/components/SettingsPanel.tsx`, `src/styles/globals.css`).

## The engine starts on the first interaction — keep it that way

The server render and the first paint are a poster (the scene itself, captured), the HUD, the
help bar and an **Enter the store** button. The engine boots only on that button, a pointerdown
or wheel on the poster, or the O / C keys (`src/boot.ts`, `src/App.tsx`); its code is a lazy
chunk (`src/components/SceneCanvas.tsx` imports `../engine/engine`) and never in the first
bundle. Measured on SwiftShader, as on the Lighthouse runner: ~100 ms building the geometry
plus ~2.6 s compiling shaders and drawing the first frame, on the main thread. Booted on load,
that lands inside Lighthouse's window and freezes mid-range phones.

Nothing that `App` imports may touch WebGL, `document` or `window` at import time or during
render: the SSR entry renders `App`. `src/engine/settings.ts` keeps `Settings` and
`DEFAULT_SETTINGS` apart from `engine.ts` for that reason; import engine types with `import type`.

In Lighthouse the full-viewport poster is not the LCP element (Chrome treats an image that fills
the viewport as a background), so the LCP is the HUD or help text. The monorepo rule that text
which could be the LCP never enters at opacity 0 applies to `.ms-hud` and `.ms-help`: no entrance
animation, plain from the first paint; only **H** (`.is-hidden`) fades them.

When the first frame is on screen (`EngineEvents.onReady`) the canvas fades in over the poster
(600 ms: `FADE_MS` in App.tsx = the `.ms-scene` transition), the settings panel appears and the
poster unmounts. Shortcuts pressed while booting queue and run once live. A failed boot (no
WebGL2, a shader the device refuses, a chunk that would not load) keeps the poster and offers
**Try again**; `failureMessage()` shows a `GLError`'s own words and a generic line otherwise, so
`GLError` messages in `src/engine/gl.ts` must stay plain English for visitors (the technical
detail goes to `console.error`).

## Poster

`src/assets/poster/`: AVIF at three widths per shape plus one WebP fallback, imported from JS so
`defineRemote`'s `renderBuiltUrl` names them from this remote's origin (on the server too).
Landscape 2.4:1 and portrait 1:2, picked by `(max-aspect-ratio: 1/1)`. The engine keeps a
vertical FOV and, below aspect 1.3, dollies the camera back (`dist × max(1, 1.3 / aspect)`), so
the poster matches the live frame exactly at its own aspect and, landscape, from 1.3 to 2.4;
elsewhere the fade hides a slight zoom.

Rerun the capture after any change to the scene, camera, lighting or post-processing: start the
dev server, then `pnpm --filter @ncam/mini-store capture:poster`. It loads `?capture=<shape>`
(`src/capture-view.ts`: the engine alone, auto-orbit off, the clock pinned at `POSTER_TIME` = 7 s
from `src/capture.ts`, when all four rides are on screen, full quality) in Playwright's Chromium on SwiftShader and waits
for `window.__miniStoreReady`.

## Engine layout (src/engine)

- `engine.ts` — `Engine`: shadow atlas → planar wet-ground reflection → MSAA opaque → glass with
  raindrop refraction → rain → SSAO → volumetric haze → bloom → ACES composite; camera, pointer
  input, the sliding door, traffic. `EngineOptions.freezeAt` is for captures only.
- `gl.ts` WebGL2 helpers (programs, mesh upload, textures, framebuffers) and `GLError`.
- `shaders.ts` all GLSL; `atlas.ts` the Canvas 2D texture atlas (signs, posters, menus, decals).
- `mesh.ts` the mesh builder (box, cyl, sphere, rod, capsule, loft, prism, carRing…);
  `materials.ts`, `constants.ts`, `math.ts` (a seeded RNG: the builders' call order is behaviour).
- `people.ts` articulated figures and poses; `vehicles.ts` scooters, e-bikes and cars;
  `traffic.ts` the moving rides; `audio.ts` the WebAudio door chime.
- `scene/` storefront · interior · houses · street → `getScene()`, built once per mount and
  dropped by `releaseScene()` when `Engine.dispose()` runs.

Text inside the scene (the atlas) stays Vietnamese on purpose; the UI around it is English.

## Reference material outside the build

- `art/blender/` — `build_scene.py` rebuilds the diorama in Blender from `scene.json` +
  `atlas.png` (geometry exported from the same procedural code; no script here regenerates
  `scene.json`), `circle_k_dem_mua.blend` (Eevee, ACES 2.0 view) and `preview.png`.
- `legacy/` — the original single-file JS build.

ESLint, Prettier, TypeScript, Vitest and the Docker build context all skip both. Don't import from
them.

## Tests

`src/boot.test.ts` (phases, retries, queued shortcuts, failure text), `src/keys.test.ts` (`takesText`:
which focused elements suppress the shortcuts), `src/components/SettingsPanel.test.ts` (the panel's
toggle markup), `src/ssr.test.ts` (the poster as the one high-priority image, HUD, Enter button,
no canvas or settings in the server markup, the CSS shipping with the render), `src/capture.test.ts`,
`src/assets/poster/poster.test.ts`. Node environment, run by the root `pnpm test`.

The page is one of the Lighthouse-audited paths (`/projects/mini-store`,
`scripts/lighthouse/config.cjs`); `LH_SHARD=11/11` audits just it (11 paths today, so the index
moves when one is added).

## Deploying

Vercel project `ncam-mini-store` (Root Directory `apps/mini-store`, Vite preset, `SITE_URL` set),
deployed before the host gets
`MINI_STORE_REMOTE_URL=https://ncam-mini-store.vercel.app/remoteEntry.js` (`docs/deployment.md`).
