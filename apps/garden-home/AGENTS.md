# AGENTS.md — apps/garden-home

## What this is

**Garden Home**: a glass villa and its garden island, built from Blender modules and drawn with
React Three Fiber, that the visitor orbits, zooms into and cuts away floor by floor like a
dollhouse, switching its lights, screens, water and doors on and off. A self-contained Module
Federation remote (`garden_home`, :9010) that the host mounts at `/projects/garden-home`. Ported on
2026-10-25 from a standalone project (React 19, three 0.186, Vite, a Blender → glTF pipeline); this
copy is the source of truth now.

The stack: React 19, React Three Fiber 9, three 0.186, zustand and zod (all in the lazy scene
chunk only). 14 Blender modules (the house, the pool, the interior, the basement, the five garden
modules, the koi pond and tea garden, the carport and kennel, the yard) are placed by `site.blend`
into `public/assets/scene.json` plus `public/assets/modules/<id>.{high,medium}.glb`.

## Commands

```bash
pnpm --filter @ncam/garden-home dev             # standalone on :9010 (/, /wallpaper, /?capture=<shape>)
pnpm --filter @ncam/garden-home build           # vite build --app (client + SSR graph)
pnpm --filter @ncam/garden-home typecheck
pnpm --filter @ncam/garden-home art:models [--force] [--only <id>…]  # Blender: regenerate modules
pnpm --filter @ncam/garden-home art:assets [--check]                 # Blender → public/assets
pnpm --filter @ncam/garden-home test:art        # Python unittest + the pipeline's vitest
pnpm --filter @ncam/garden-home e2e             # Playwright on the production preview (:4173)
pnpm --filter @ncam/garden-home capture:poster  # needs the dev server; rewrites src/assets/poster
```

CI runs **the unit tests only** (`src/**/*.test.ts`, through the root `pnpm test`), plus the
typecheck, lint and build. `art:models`, `art:assets`, `test:art`, `e2e` and `capture:poster` run by
hand:

- `art:models`, `art:assets` and `test:art` need **Blender 5.2.2 LTS** at
  `/Applications/Blender.app` (or `BLENDER_BIN`) and **KTX-Software ≥ 4.4** (`ktx` on the path;
  tested with 4.4.2). `art:assets` also checks each module against the contract
  (`--check` does only that). `test:art` runs the real pipeline, so it **rewrites
  `public/assets`**: the GLBs differ byte for byte afterwards, restore them with
  `git checkout -- apps/garden-home/public/assets` unless the change is meant.
- `e2e` builds the app and serves it with `vite preview` on `127.0.0.1:4173` (an already running
  server is reused outside CI), in Playwright's Chromium on SwiftShader (software WebGL, so a run
  does not depend on the GPU), at 1280 × 800. 13 spec files plus `e2e/helpers.ts`, 61 tests, about
  15 minutes. Every site navigation goes through `gotoSite()` (opens the page, then presses
  **Enter the garden**, because the scene waits behind the poster on SwiftShader); the wallpaper
  boots by itself and is opened with `page.goto`. Install the browser once with
  `pnpm --filter @ncam/garden-home exec playwright install chromium`.
- `capture:poster` needs the dev server (see "Poster").
- `predev` and `prebuild` copy the Basis transcoder from `three` into `public/basis/`
  (`scripts/copy-basis.mjs`, gitignored).

## Controls

The site route only. The wallpaper takes no input, never cuts the house and shows everything in
its automatic state.

- **Orbit and zoom to the cursor.** Drag turns the camera round the vertical axis through the
  point under the pointer when it went down (press on the pond, drag sideways: the pond stays
  put and the camera circles it); pressed on the sky it turns round the orbit target. Vertical drag
  tilts. Wheel, pinch or middle-button drag zooms towards the point under the cursor, which stays
  under it while the orbit target follows over the ground. Distance 14.5 to 140 m. The target stays
  on the island, at least 3 m from its rim. The camera never enters the rock, the house or the
  trees: over the house it stays above the roof (or above the cut while the house is cut), over the
  island above the treetops (4 m), at grass level once off the island, and it dips under the horizon
  to show the rock's underside only well outside it. Near the house its floor rises with the
  distance (`src/camera/orbit.ts`, `cursorOrbit.ts`).
- **The dollhouse cut**, by the camera's distance to the middle of the house (the footprint's
  centre on the ground, not the orbit target: zooming into the vegetable garden leaves the house
  whole). Whole house beyond 45 m; the **upper floor** between 28 and 45 m (everything above 6.86 m
  is cut, roof included); the **ground floor** under 28 m (cut at 2.05 m). Each threshold has
  ±3 m of hysteresis, so stopping near one does not flicker. The cut is `floor + 1.6 m`
  (`CUT_ABOVE_FLOOR`, `CUT_DISTANCES` in `src/scene/cutaway.ts`).
- **The height rule.** A cut only starts while the camera is more than 2 m above its plane, and
  once cutting holds until the camera is within 1.25 m of it (0.75 m of hysteresis), so a camera
  skimming the plane does not flicker the roof. In the upper-floor band a camera lower than 8.86 m
  (8.11 m to hold) shows the ground-floor cut instead. While the house is cut the camera's floor
  over it drops from the roof (13.7 m) to 3.5 m above the cut plane.
- **The crystal chandelier** hangs in the double-height living room's void and has its own plane
  (custom props `uncut` and `cut_top`), so it stays whole and clickable under the ground-floor cut.
  Cut walls draw both faces and the sun's shadows are cut too, so light falls into the rooms.
- **The floor buttons** (bottom left, `src/ui/FloorSelector.tsx` and `floors.ts`; the pressed one
  has `aria-pressed="true"`): **Auto** (the cut by distance as above), **Roof** (the whole house),
  **Upper floor** (cut at 6.86 m), **Ground floor** (2.05 m) and **Basement** (−2.02 m: the house
  disappears and the camera looks down into the pit at the basement's rooms; reachable only by this
  button, never by distance). The height rule still applies, so a camera far above a floor shows
  the whole house. Picking Upper floor, Ground floor or Basement from beyond 45 m of the house, or
  looking down at it by less than 35°, **eases the camera towards the house over 0.8 s** (35 m
  from its middle, 55° down into the pit or 40° onto a floor, same azimuth; `FLOOR_VIEW` and
  `floorPose` in `orbit.ts`). Roof and Auto never pull. A click, scroll or drag stops the ease where
  it is; pressing the active button again pulls again. When a level needs a higher camera than
  the one it has, the camera is lifted straight up first. At the Basement level every house mesh
  is hidden and the house's point lights go to zero (about 310 draw calls instead of about 1 140).
- **Click toggles.** Hovering an item shows its name and what a click does ("Click to switch
  on", "…off", "…open", "…close", "…to feed the koi", "…to play with the pup"), a hand cursor and a
  thin yellow box. Clickable:
  - room lights (point lights, downlights, pendants, lamps, frosted bathroom panes, the chandelier):
    one click flips the whole room. Every room with lights also has a wall **`<Room> light switch`**
    (a small black plate with a white button at 1.15 m) that stays in reach under the cut;
  - the living room and master bedroom TVs, the computer; a screen switched on by day glows at a
    tenth of its night strength, so it reads as a blue panel;
  - the master and shared bathroom showers, the front door (slides), the hot tub's bubbles, the
    water wall, the string lights on the roof;
  - the air conditioners of the master bedroom, bedroom 2 and bedroom 3 (the unit, or the remote on
    the wall by the switch): the flap opens and the status LED lights;
  - the garden lights, one group for the whole yard (lamp posts along the walk and driveway, the
    gate-post lanterns, the string lights under the pergola, the tea garden's stone lantern), and
    the barbecue (its coals glow, by day too);
  - the carport lights, the pickup truck's and the supercar's lights (click through the roof slats
    from above), and the Akita pup (hops twice, tilts its head, wags, then sits again; not a
    switch, no state);
  - the basement, once the Basement button is on: each room's lights and switch (lobby, wine cellar,
    karaoke room, spa, gym, bathroom), **party mode** (TV, speakers or microphone: the LEDs and the
    disco ball step through the hues every 6 s), the **sauna** and the spa's **soaking tub**;
  - the koi pond: the **waterfall** (rockery, water sheet or foam) and **feeding the koi** (click
    the water: food drops there, the fish gather within 3 s, circle it, and drift back to their
    laps after 9 to 13 s).

  Everything starts **automatic**: lights, screens and the barbecue coals follow the night (lit
  from a night factor of 0.5); showers off, the door shut, the air conditioners, party mode and
  sauna off; the hot tub, soaking tub, water wall and waterfall running. The first click flips what
  is showing (a lamp lit at night goes off, one off by day goes on), then it alternates. A press
  followed by a drag of more than 5 px is a camera move, not a click. Clear glass does not block a
  click (it goes through to the room), except an item's own glass (the shower cabin, the door);
  what the cut has removed does not block it either. States are not saved on reload.

- The time of day follows the clock; `?t=` pins it. At night the lamps, windows, screens and
  garden lights come on by themselves (the "auto" states above).

### URL parameters

`?t= ?quality= ?fps= ?debug= ?align= ?bg=`, read from `location.search` of the page, so
`/projects/garden-home?t=21:00` works in the host too (`src/params.ts`):

- `?t=HH:MM` pins the clock (24 h).
- `?quality=high|medium`: the GLB tier. Default `high`; `medium` on a coarse pointer and on the
  wallpaper.
- `?fps=N` (1 to 120): the frame cap. Default 60 on the site, 30 on the wallpaper.
- `?debug=1`: an fps and page-visibility overlay (`src/ui/DebugOverlay.tsx`).
- `?align=left|center|right`: where the island sits across the screen (the scene's centre at 32 %,
  50 % or 68 % of the width). Default `center`, `right` on the wallpaper. On a screen narrower than
  about 1.5 : 1 the island is pulled towards the middle so its rim is not cut (about 64 % at 4 : 3,
  50 % on a portrait screen).
- `?bg=<file>`: a photo in `public/backgrounds/` instead of the sky. A plain file name of letters,
  digits, `.`, `_` and `-` ending in `.jpg`, `.jpeg`, `.png` or `.webp` in any case; anything else
  is ignored with a console warning. The photo covers the screen, the island still follows the
  clock, fog is off and the glass still reflects the sky; the sky shows until the photo has
  decoded and stays if it fails. It resolves against the remote's origin, and only `example.jpg` is
  tracked (other files in that folder are gitignored; add yours, then rebuild).

## The scene starts behind a poster — keep it that way

The server render and the first paint are the poster (a daytime capture of the scene itself), the
HUD (a title and one help line) and an **Enter the garden** button. The scene is a lazy chunk
(`src/scene/GardenScene.tsx`, about 340 KB gzipped, plus roughly 9 MB of GLBs and the Basis
transcoder fetched when it boots) and is never in the first bundle.

**Why.** Booting the scene costs seconds of main-thread work building the modules and compiling
shaders, and on a software rasteriser (SwiftShader: the Lighthouse runner, machines without a
usable GPU) it is far worse: the e2e allows 45 s for a scene to be ready there, and a frame
costs about 50 ms. A page that boots it on load would freeze inside Lighthouse's window. Measured
with a Chrome that has a GPU (an Apple M4), which starts the scene by itself: desktop scores 89
(TBT about 85 ms, Speed Index 8.6 s as the scene streams in) and mobile never settles within
Lighthouse's 45 s, because the throttled network (1.6 Mbit/s) cannot move 9 MB in time. The
Lighthouse gate therefore only means something when Chrome renders in software, as on the GitHub
runner (see "Tests").

**The phases** (`src/boot.ts`, a pure reducer): `poster` → `booting` → `live`, or `error` over the
poster. Events: `start` (the Enter button, a pointerdown or wheel on the poster, "Try again"),
`autostart`, `ready` (the scene's first frames are on screen: every slot settled and three frames
drawn, `ReadyProbe`) and `fail`. `autostart` only ever leaves the poster; after a failed boot,
retrying is the visitor's call.

**Autostart on a hardware GPU** (`src/autoplay.ts`, a copy of `apps/mini-store/src/autoplay.ts`:
two copies, keep them in step until a shared package is worth it). Once the page has loaded and the
main thread is idle (`whenSettled`), the scene starts by itself when `shouldAutoplay` says so:
WebGL2 runs on a hardware GPU (a context made with `failIfMajorPerformanceCaveat`, and a renderer
name that is not SwiftShader, llvmpipe, softpipe or Microsoft Basic Render) and the visitor has not
asked for reduced motion. Everywhere else the poster waits for the visitor. Keep the
software-rasteriser branch.

**The SSR boundary.** The server render (`src/ssr.tsx`) and the client entries `mount.tsx` and
`hydrate.tsx` render `App` and nothing of the scene. Nothing that `App` imports may reach three,
`@react-three/*`, zustand, zod or the chunk's directories (`src/scene/`, `camera/`, `systems/`,
`interact/`, `state/`, `ui/`), statically, at import time or during render. The lazy import sits in
`src/shell/SceneHost.tsx` behind `import.meta.env.SSR`, so the server build drops it too.
`src/ssr-graph.test.ts` walks the import graph of all three entries and pins that shape; it fails
if a file moves into the SSR graph by accident. Keep `src/failure.ts`, `release.ts`, `routes.ts`,
`scene-props.ts` and `lib/asset-url.ts` free of scene imports for the same reason.

**Failures** (`src/failure.ts`) keep the poster and show a plain English message in a
`role="alert"`:

- no WebGL2 (`GardenStartError`): "This browser can't draw the 3D garden: WebGL 2 is off or
  unsupported.", with **Try again**;
- `scene.json` that will not load, a context lost for good (not restored within 3 s), or **no module
  of the scene loading**: "The 3D garden couldn't start. Please try again.", with **Try again**. One
  module that fails is only skipped (`ModuleBoundary` drops its slot and the rest of the scene
  runs, on the wallpaper too); when every slot has failed the scene is empty, so `SceneRoot`
  forgets the modules in R3F's cache (`forgetModules`, or **Try again** would replay the cached
  rejections) and calls `onFatal`;
- a chunk that would not load (`SceneChunkError`): "…couldn't load. Reload the page to try again.",
  no retry, because `lazy()` and Chromium both remember a rejected dynamic import.

On the wallpaper every one of these shows the poster. The messages are for visitors; the technical
detail goes to the logger (`garden-home.boot-failed`).

**The fade.** When `ready` arrives the canvas fades in over the poster in **600 ms** (`FADE_MS` in
`src/App.tsx` equals the `.gh-scene` transition in `src/styles.css`; keep them equal), then the
poster unmounts. It comes back with a failure. Until `ready` the layer is `inert`
(`SceneHost`): the invisible scene takes no drag, wheel or focus, and its floor buttons cannot be
tabbed to. `waitForScene` in `e2e/helpers.ts` therefore also waits for `.is-live`, because
`window.__sceneReady` is set a moment before React commits it.

**The LCP rule.** In Lighthouse the poster is not the LCP element (Chrome treats an image that
fills the viewport as a background); the LCP is the HUD's help text, `.gh-hud p`. Per the monorepo
rule that text which could be the LCP never enters at opacity 0, `.gh-hud` (and its `h1`) is plain
from the first paint: no entrance animation. The poster `<img>` is the one `fetchpriority="high"`
image. Floor buttons and the hover label belong to the scene chunk and never reach the server
markup. UI anchored to the top respects the host's `--stage-top-inset`.

## Runs on the remote's origin

The host and the remote can live on different origins, so nothing here resolves a URL against the
page. `src/lib/asset-url.ts` (`remoteBase()`, `assetUrl()`; same shape as chess's) resolves
against `config.assetBase` from the host's `MountConfig` when it is set (only `mount` and
`hydrate` read it; `renderHeroSSR` ignores it) and otherwise against the bundle's own URL. It is
used for:

- `assets/scene.json` (its `src` paths are relative to it), then `assets/modules/<id>.high.glb` or
  `.medium.glb`;
- the KTX2 transcoder directory `basis/` (`setTranscoderPath`, set before the first module loads);
- `backgrounds/` for `?bg=`.

The poster files are JS-imported assets, which `defineRemote`'s `renderBuiltUrl` names from the
remote's origin, on the server too. `vercel.json` sends `Access-Control-Allow-Origin: *` on every
path (the host page fetches all of this cross-origin; `src/vercel-config.test.ts` pins it), and
`Cache-Control: public, max-age=0, must-revalidate` on `basis/`, `assets/modules/` and
`assets/scene.json`, whose file names never change (an immutable cache would pin a stale scene).
It also rewrites `/wallpaper` to `index.html`.

## Release on unmount

The scene keeps state at module level that React's unmount does not free. The `MountHandle`'s
disposer runs `root.unmount()` and then `releaseAll()` (`src/release.ts`: a registry with no
imports, so the SSR-safe entries can call it), and the next `mount()` on the same element does the
same. The scene chunk registers `releaseGardenScene` on load (`onRelease` in `GardenScene.tsx`).

`releaseGardenScene()` (`src/scene/release-scene.ts`) goes through a **release gate**
(`scene/release-gate.ts`): R3F commits a Canvas's unmount a tick after React's `root.unmount()`,
and its components still re-render on store changes until then, so freeing the caches at once
would refetch the modules into a fresh KTX2 pool. The release waits until every `<ReleaseGate />`
rendered inside the Canvas at the time of the request has unmounted, and is skipped when a newer
scene mounted meanwhile (it owns the shared caches now). It then frees:

- R3F's cache of the parsed module GLBs (`useLoader.clear` per URL) and the **KTX2 transcoder's
  workers** (`releaseLoaders` in `scene/loader.ts`);
- the shared glow falloff texture (`releaseGlowFalloff`, `scene/prepareModule.ts`);
- the cutaway's warm-up flag (`resetWarmCut`) and the hover (`resetHover`);
- the zustand store, reset to its initial state (`startCleanScene`);
- `window.__sceneReady` (the e2e hooks `__camera` and `__interact` clear themselves when their
  components unmount).

R3F disposes the renderer itself and forces the WebGL context loss while it tears the canvas down;
`SceneRoot` ignores that loss through a `disposed` ref (otherwise its 3 s restore timer would call
`onFail` for a scene the visitor has left). `GardenScene` also calls `startCleanScene()` when it
starts, so a remount that beat the last release still begins clean.

**A new module-level cache, texture, worker or listener must register its release in `release()`
of `scene/release-scene.ts`** (and be covered in `release-scene.test.ts`).

## Standalone routes

Only the federated entries run in the host; `index.html` (`src/standalone.tsx`) serves three views
on :9010 (`src/routes.ts`, `standaloneView`):

- `/`: the site, behind the same poster gate as in the host.
- `/wallpaper`: no poster, no gate, no HUD, no input: the scene boots at once, the island on the
  right, 30 fps, the sky following the clock (`src/wallpaper.tsx`). It is for **Plash** (a macOS
  wallpaper app): build the app and leave its preview running (the `build` script, then the
  `preview` script, which serves on :9010 like the dev server: `defineRemote` takes the port from
  `GARDEN_HOME_PORT`), then Plash → Add Website → `http://localhost:9010/wallpaper`; or, once
  it is deployed, point Plash at `https://ncam-garden-home.vercel.app/wallpaper`. (:4173 is only
  the e2e's own preview, which `playwright.config.ts` starts with `--port 4173`.) Add `?fps=20`
  (or `&fps=20`) to save battery, `&align=left` to move the island, and `?bg=<file>` for a photo
  from `public/backgrounds/` (drop it there, rebuild; only `example.jpg` is tracked). If the scene
  cannot start, the poster is shown. The host never mounts the wallpaper.
- `/?capture=landscape|portrait`: the poster capture view (below).

## Poster

`src/assets/poster/`: AVIF at three widths per shape plus one WebP fallback (landscape 1280, 1920
and 2560, portrait 480, 750 and 1080), imported from JS (`index.ts`; `poster.test.ts` pins the
declared sizes). Landscape is 2.4 : 1, portrait 1 : 2, picked by `(max-aspect-ratio: 1/1)` in
`src/shell/Poster.tsx`. Landscape shows the island whole and centred under a pale sky; portrait is
the live framing at 1 : 2 (the island cropped at both ends), so the canvas fades in over a picture
that lines up with it. It is a **daytime** capture: at night the live scene fades in from a day
picture (a night poster is a possible follow-up).

Rerun the capture after any change to the scene, camera, lights or post-processing: start the dev
server (`GARDEN_HOME_PORT` or `GARDEN_HOME_URL` if it is not on :9010), then
`pnpm --filter @ncam/garden-home capture:poster`. It loads `?capture=<shape>`
(`src/capture-view.tsx`: the site route's scene alone, no UI, at `POSTER_SEARCH` =
`?t=10:00&quality=high&align=center` from `src/capture.ts`, a query only the standalone page reads)
in Playwright's Chromium on SwiftShader, waits for `window.__sceneReady` (about a minute for both
shapes) and writes the eight files. A capture fails on any page error.

## Art pipeline (`art/`)

```
art/blender/scripts/   the generators and rules: archkit/ (parametric builders), houses/, garden/,
                       pond/, carport/, basement/, interior/, siteplan/, contract.py, export_*.py
art/blender/modules/   <id>.blend per module (generated, then possibly hand-tuned)
art/blender/site.blend the yard: every module linked and placed; hand-placed instances
art/blender/tests/     Python unittest (some tests start Blender)
art/blender/fixtures/  a deliberately broken module for the contract tests
art/pipeline/          models.mjs (run the generators), build.mjs (export, optimise, merge), src/, test/
```

`art:models` runs the generators headless in Blender (`art/blender/scripts/<module>/build_*.py`)
and writes `modules/<id>.blend`. `art:assets` exports each module to glTF (`export_module.py`),
reads the placement out of `site.blend` (`export_layout.py`), optimises each module at two tiers,
`high` and `medium`, with gltf-transform (meshopt compression, KTX2 textures through the `ktx`
CLI), and merges it all into `public/assets/scene.json` and `public/assets/modules/<id>.{high,medium}.glb`.
Both are **committed** (about 9 MB; the monorepo has no LFS). `art/blender/out/` is scratch,
gitignored.

**The module contract** (`art/blender/scripts/contract.py`; a violation prints the module and the
rule):

- a top-level collection named `<id>` carrying the custom props `footprint: [w, d]` (metres) and
  `role: "hero" | "prop"`; budgets: `hero` 50k triangles, textures up to 2048 px, 4 lights; `prop`
  15k, 1024 px, 2 lights; at most 4 textures;
- scales applied; clips named `ambient_*` (loop forever) or `act_*` (played by a click); hotspot
  empties `HS_*`; water meshes `WATER_*`;
- the custom prop `night_light = True` on every light and every emissive object, otherwise it
  glows by day; light pools `GLOW_*` have a black base colour;
- a colour attribute `wind` (R = sway weight) on anything that should sway;
- `GLASS_*` (alpha 0.1 to 0.5, roughness ≤ 0.1, one object per pane) and `FROSTED_*` (alpha 0.4 to
  0.85, roughness 0.3 to 0.8) materials.

**The interaction data** the page reads from glTF extras: `interact` (the group a click toggles),
`label` (the name shown on hover), `clip` (the action a click plays; for the door, the hot tubs,
the dog and the air conditioner flaps), `uncut` and `cut_top` (the chandelier's own cut plane). They
are set by `art/blender/scripts/<module>/interact.py`, parsed by `src/interact/groups.ts`, and
`src/interact/toggles.ts` and `effects.ts` decide what each group kind does. Group ids:
`light:<room>`, `tv:<object>`, `pc:<object>`, `shower:<object>`, `ac:<room>`, `door:main`,
`jacuzzi`, `fountain`, `lights:string`; in the garden `lights:garden` and `bbq`; at the pond
`waterfall` and `koi`; at the carport `lights:carport`, `lights:car_pickup`, `lights:car_super` and
`dog`; in the basement `light:<room>`, `party`, `sauna` and `jacuzzi:spa`. The interior's lamp
shades join the house's `light:<room>`. **Labels are English at the source**: `ROOM_LABELS` in
`houses/house_parts/{ground,upper,roof}.py` and `basement/basement_layout.py`, and the per-kind
`LABELS` in `houses/interact.py` ("Living room lights", "Living room light switch", "Master
bedroom AC", "Front door", "Hot tub", "Water wall"…). Only rooms that have lights are labelled
in the GLBs: `terrace` ("Front porch") and `roof` ("Roof terrace") have labels in the source but no
light, so no GLB carries them and they are not interactive.

**`site.blend` holds hand-placed instances: never `--force` it** (a bare `art:models --force`
includes it, and so does `--only site`). To add a module, create `modules/<id>.blend` (or generate
it), open `site.blend`, **File → Link → `<id>.blend` → Collection `<id>`** and place the instance;
`art:assets` reports a contract failure with the module and the rule.

**Regenerate one module**: `pnpm --filter @ncam/garden-home art:models --force --only <id>`, then
`pnpm --filter @ncam/garden-home art:assets`. `--only` without names, or with an unknown name,
is an error. A module that cuts the lawn (the koi pond, the basement's pit) or that the island's
rim avoids (the garden's fence and layouts) also needs `yard` in the list. Regenerating a module
twice yields byte-identical GLBs. `layout_check` runs before any geometry is built and prints
`LAYOUT <module>: …` for furniture outside a room, overlaps and the like.

`art/README.md` has the per-module detail (the glass villa and its generation, the garden, the koi
pond, the carport and the dog, the basement, the interior) and the performance numbers.

## Tests

Unit tests (`src/**/*.test.ts`, node environment, run by the root `pnpm test`; 36 files today):

- the shell: `boot.test.ts` (every path of the reducer), `autoplay.test.ts` (`shouldAutoplay`,
  `isSoftwareRenderer`), `failure.test.ts`, `routes.test.ts` (capture, wallpaper and site views,
  trailing slash), `capture.test.ts`, `release.test.ts` (the registry; a throwing release does not
  stop the others), `ssr.test.ts` (the poster as the one high-priority image, the HUD and Enter
  button, no canvas or floor buttons in the server markup, the CSS shipping with the render, the
  head), `ssr-graph.test.ts` (the SSR boundary), `vercel-config.test.ts`, `lib/asset-url.test.ts`,
  `assets/poster/poster.test.ts`;
- the page's settings: `params.test.ts` (the URL parameters), `runtime.test.ts` (per-route render
  settings);
- the scene: `scene/cutaway.test.ts` (the cut levels, hysteresis, modules and planes),
  `extras.test.ts` (glTF extras, glass, uncut and detail objects), `prepareModule.test.ts`
  (materials, glass, wind, glow), `loadScene.test.ts` (the `scene.json` schema), `loader.test.ts`,
  `release-gate.test.ts` and `release-scene.test.ts`;
- the camera: `camera/orbit.test.ts` (limits, clearance, the cut level, `floorPose`),
  `cursorOrbit.test.ts` (zoom and rotation about the cursor), `framing.test.ts` (`?align=`);
- interaction: `interact/toggles.test.ts`, `groups.test.ts`, `effects.test.ts` (what a toggle
  drives), `pick.test.ts` (picking through glass and cut-away parts), `pointer.test.ts`
  (click versus drag);
- systems and UI: `systems/timeOfDay.test.ts`, `koi.test.ts`, `water.test.ts`, `wind.test.ts`,
  `environmentPolicy.test.ts`, `frameGate.test.ts`, `ui/backdrop.test.ts`, `floors.test.ts`.

`test:art` is the Python `unittest` suite (`art/blender/tests`, 748 tests) plus the pipeline's
vitest (`art/pipeline/test`, 21 tests). `e2e` is by hand, as above: `orbit`, `cutaway`,
`basement`, `interact`, `garden`, `pond`, `carport`, `interior`, `tallhouse`, `framing`,
`background`, `wallpaper` and `fallbacks` (a missing `scene.json` on both routes, every module
failing then **Try again** fetching them again, one broken module skipped, a context lost for good,
the debug overlay; no WebGL2 is not covered). The specs
read `window.__camera`, `window.__interact` and `window.__sceneReady`, hooks the scene sets for
them.

**Lighthouse.** The page is one of the audited paths (`/projects/garden-home`,
`scripts/lighthouse/config.cjs`); `LH_SHARD=12/12` audits just it (12 paths today, so the index
moves when one is added). It scores 100 in all four categories on mobile and on desktop (TBT 0,
LCP 670 ms and 194 ms, the help text `.gh-hud p`), when Chrome renders in software as it does on
the GitHub runner. On a machine with a GPU Chrome starts the scene by itself (see above), which
the throttled run cannot finish; to measure what the runner measures, add `--disable-gpu` to the
`chromeFlags` of a copy of `lighthouserc.cjs` and pass it to `lhci autorun --config=…`.

## Known facts

- `dist-ssr` is about 12 MB, of which the JavaScript is only about 240 KB and holds no scene code:
  Vite's SSR environment copies `public/` (the GLBs, `basis/`, `backgrounds/`) into it. That is
  `packages/mf-remote`'s behaviour for every remote (chess does the same) and is left as is.
- The host's `<title>` on `/projects/garden-home` comes from the registry (name, tagline,
  `· ncam.dev`), not from the remote's `head` (`projectHead()` uses a remote's own title only for a
  route-aware deep link). The remote's `head.title` still reaches the dehydrated loader data.
- Rebuilding the host after a build that overrode a `*_REMOTE_URL` (the production SSR smoke on
  9110, the Lighthouse build with `LH_PORT_OFFSET`) needs `pnpm build --force` (or a changed
  input): without it Turbo replays the cached output with the overridden ports baked in.

## Deploying

Vercel project `ncam-garden-home` (Root Directory `apps/garden-home`, Vite preset, `SITE_URL` set),
deployed before the host gets
`GARDEN_HOME_REMOTE_URL=https://ncam-garden-home.vercel.app/remoteEntry.js` (`docs/deployment.md`).
