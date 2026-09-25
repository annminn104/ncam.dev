# Holodex — a material per scene, no program cache

**Status:** approved by the repo owner, 2026-09-25 ("No cache, rename"). Branch
`feat/holodex-holo-v2`, local commits only.

## Problem

`holo/program-cache.ts#getMaterial(id)` keeps one `ShaderMaterial` per `EffectId`
at module scope, shared by every scene that uses that effect. It was meant to
spare cards a second shader compile. It does not:

- **No GPU saving.** three.js keeps its program cache on the `WebGLRenderer`, and
  every `HoloCard` scene builds its own renderer and force-loses its context on
  `dispose()`, so each new card re-links its program however warm the map is.
- **No CPU saving worth keeping.** `compileEffect()` measured **0.016 ms** per
  compile on average across the 30 effects, 0.054 ms at worst (`ex-regular`),
  about 12 KB of source each (2026-09-25, node, 20 rounds).
- **A shared-uniform hazard.** Two scenes on one effect mutate the same
  `uPointer`, `uClipRect`, `uCard` objects; the last writer wins. It is invisible
  only because one scene draws at a time today.
- **A lifecycle it forces.** Materials outlive scenes, so the remote frees them on
  unmount (`disposeMaterials`), reached through `teardown.ts`, a three-free
  registration shim that keeps three.js out of the main chunk. And as
  `mount.tsx` itself warns, a page hosting two Holodex mounts would have the
  first to unmount free materials the second is still drawing with.

## Decision

A scene owns its material. Nothing is cached, so nothing outlives a scene, and
the teardown path goes away.

## Design

**`holo/material.ts`** (renamed from `program-cache.ts`; it no longer caches):

- `buildMaterial(effect: Effect): ShaderMaterial` — unchanged: `compileEffect`,
  the shared `VERTEX_SHADER`, `glslVersion: '300 es'`, the full uniform set.
- `createMaterial(id: EffectId): ShaderMaterial | null` — a fresh material on
  every call. A build failure logs `holo.compile-failed` (as today) and returns a
  fresh `basic` material; if `basic` itself fails, `null`, and `HoloCard` drops
  to the plain image (unchanged behaviour).
- No module state, no `disposeMaterials`, no registration.

**`holo/scene.ts`** owns what it creates:

- `setSelection` calls `createMaterial`, binds the card texture, the generated
  textures the effect samples, the clip uniforms, and swaps it onto the mesh. A
  material it replaces is disposed at once (the placeholder included), so a
  scene holds exactly one.
- `dispose()` disposes the current material with the geometry, the card texture
  and the renderer.
- Everything written to guard a shared material goes: the "only clear `uCard`
  if it still points at our texture" check, and the comments about "a second
  live scene may be sharing this material".
- The generated textures stay module-level and shared, as today. They are CPU
  canvases, uploaded per renderer, and cost real time to paint.

**Removed:** `holo/teardown.ts`, and the `disposeHoloCache()` call, import and
comment in `mount.tsx` and `hydrate.tsx`.

## Error handling

Unchanged for a visitor. A failing effect still logs `holo.compile-failed` and
draws `basic`; a failing `basic` still returns `null`, so `setSelection` leaves
the mesh alone and `HoloCard` shows the plain image. GPU compile errors still
surface through three.js at the first render, as before.

## Testing

`program-cache.test.ts` becomes `material.test.ts`:

- **New, written failing first:** two `createMaterial('regular-holo')` calls give
  two materials, and their uniform value objects are distinct (`uClipRect`,
  `uPointer`), which is the hazard itself. Against today's `getMaterial` it fails.
- Kept: a known effect gives a material with a `main()`; different effects give
  different sources; every declared uniform is provided (`basic`, `cosmos-holo`);
  the SV texture samplers are provided (a synthetic effect sampling all six).
- Kept, adjusted: an effect that cannot compile falls back to a `basic` material
  (compared by fragment source, since instances now differ).
- Dropped: "compiles each effect once and caches it", "empties the cache on
  dispose".
- `effects/sv-effects.test.ts` imports `buildMaterial` from `../material`.

The scene's lifecycle has no unit test (no WebGL under node), so it gets a GPU
smoke pass on the dev server:

- `/card/swsh3-25` and `/card/swsh3-3`: normal/reverse toggled over and over;
- `/effects`: several tiles picked in turn;
- a live context lost and restored with `WEBGL_lose_context`;
- the console clean of `holo.unavailable`, `holo.context-lost` beyond the one
  forced, and three.js errors throughout.

## Verification

- `pnpm vitest run`, `pnpm lint`, `pnpm --filter @ncam/holodex typecheck`,
  Prettier on the changed files.
- `pnpm --filter @ncam/holodex build`, then the split check in AGENTS.md: two
  files match `THREE.WebGLRenderer`, one of them the client's own `scene-*.js`.
  The main chunk loses `teardown.ts`; the lazy chunk should barely move.

## Docs

`apps/holodex/AGENTS.md`: the structure bullets (`teardown.ts` gone,
`program-cache.ts` renamed), "The program cache" paragraph rewritten as a
material per scene, and the `#version` gotcha's file name. The bundle-budget and
bundle-history sections describe past measurements and keep their names, with a
line saying `teardown.ts` has since gone.

## Out of scope

- Sharing the generated textures differently, or freeing them on unmount.
- Any change to what a visitor sees.
