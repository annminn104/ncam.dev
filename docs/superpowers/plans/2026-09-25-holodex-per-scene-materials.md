# Holodex per-scene materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every holo scene a `ShaderMaterial` of its own and delete the module-level program cache and the teardown shim that freed it.

**Architecture:** `holo/program-cache.ts` becomes `holo/material.ts`, whose `createMaterial(id)` builds a fresh material per call with no module state. `holo/scene.ts` owns what it creates: `setSelection` swaps a new material in and disposes the one it replaces, `dispose()` frees the last. With nothing outliving a scene, `holo/teardown.ts` and the remote's `disposeHoloCache()` calls go.

**Tech Stack:** TypeScript (strict), three.js `ShaderMaterial`, Vitest under `environment: 'node'` (no DOM, no WebGL), pnpm, Prettier.

**Spec:** `docs/superpowers/specs/2026-09-25-holodex-per-scene-materials-design.md`

## Global Constraints

- Branch `feat/holodex-holo-v2`. Commit locally only: **never `git push`**, never open a PR.
- Stage files by explicit path (`git add -- <paths>`), never `git add -A`; never stage `.claude/launch.json`.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never touch the owner's dev servers (ports 1337, 9000–9007, 9106). The smoke server is `holodex-smoke` on 9107 (`.claude/launch.json`).
- No visible change for a visitor: same effects, same fallback to `basic`, same plain-image fallback.
- Tests run under node with no DOM and no WebGL: nothing may construct a `WebGLRenderer` in a test.
- Run commands from the repo root (`/Users/mason.nguyencaominhanh/Mason_Workspace/ncam`) unless a step says otherwise.

---

### Task 1: A scene owns its material

**Files:**

- Rename: `apps/holodex/src/holo/program-cache.ts` → `apps/holodex/src/holo/material.ts`
- Rename: `apps/holodex/src/holo/program-cache.test.ts` → `apps/holodex/src/holo/material.test.ts`
- Modify: `apps/holodex/src/holo/scene.ts` (import line 15; comments at 32–37, 136–145, 175–177; `setSelection` at 219–240; `dispose` at 260–284)
- Modify: `apps/holodex/src/holo/effects/sv-effects.test.ts` (import line 2; comments at 22 and 46)
- Modify: `apps/holodex/AGENTS.md` (lazy-module list, "The program cache" paragraph, the `#version` gotcha)

**Interfaces:**

- Consumes: `compileEffect(effect: Effect): string` and `VERTEX_SHADER` from `holo/shader/compile.ts`; `EFFECTS: Record<EffectId, Effect>` from `holo/effects`.
- Produces: `buildMaterial(effect: Effect): ShaderMaterial` (unchanged) and `createMaterial(id: EffectId): ShaderMaterial | null` in `holo/material.ts`. `getMaterial` and `disposeMaterials` no longer exist. Task 2 relies on `material.ts` no longer importing `holo/teardown.ts`.

- [ ] **Step 1: Rename the module and its test, and point the importers at it**

```bash
git mv apps/holodex/src/holo/program-cache.ts apps/holodex/src/holo/material.ts
git mv apps/holodex/src/holo/program-cache.test.ts apps/holodex/src/holo/material.test.ts
```

In `apps/holodex/src/holo/scene.ts`, line 15:

```ts
import { getMaterial } from './material';
```

In `apps/holodex/src/holo/material.test.ts`, line 2:

```ts
import { buildMaterial, disposeMaterials, getMaterial } from './material';
```

In `apps/holodex/src/holo/effects/sv-effects.test.ts`, line 2:

```ts
import { buildMaterial } from '../material';
```

and in the same file replace `program-cache.test.ts` with `material.test.ts` in the comments at lines 22 and 46.

- [ ] **Step 2: Run the holo tests to confirm the rename alone changes nothing**

Run: `cd apps/holodex && pnpm exec vitest run src/holo`
Expected: PASS, every test (the same count as before the rename).

- [ ] **Step 3: Replace `material.test.ts` with the per-scene tests, the new one first**

Write `apps/holodex/src/holo/material.test.ts` in full:

```ts
import { describe, expect, it } from 'vitest';
import { buildMaterial, createMaterial } from './material';
import type { Layer } from './shader/types';

/** Every `uniform <type> <name>;` declaration in a compiled fragment shader. */
function declaredUniforms(source: string): string[] {
  return Array.from(
    source.matchAll(/uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/g),
    (match) => match[1],
  );
}

describe('createMaterial', () => {
  it('gives every call a material of its own, uniforms included', () => {
    // Two scenes on one effect used to share one material, and so the very
    // same uniform objects: the last scene to write uClipRect or uPointer won.
    const a = createMaterial('regular-holo');
    const b = createMaterial('regular-holo');
    expect(a).not.toBeNull();
    expect(a).not.toBe(b);
    expect(a?.uniforms.uClipRect.value).not.toBe(b?.uniforms.uClipRect.value);
    expect(a?.uniforms.uPointer.value).not.toBe(b?.uniforms.uPointer.value);
    // Writing one leaves the other alone.
    a?.uniforms.uClipRect.value.set(0.1, 0.2, 0.3, 0.4);
    expect(b?.uniforms.uClipRect.value.toArray()).toEqual([0, 0, 0, 0]);
  });

  it('returns a material for a known effect', () => {
    const m = createMaterial('basic');
    expect(m).not.toBeNull();
    expect(m?.fragmentShader).toContain('void main()');
  });

  it('gives different effects different programs', () => {
    const a = createMaterial('regular-holo');
    const b = createMaterial('cosmos-holo');
    expect(a?.fragmentShader).not.toBe(b?.fragmentShader);
  });

  it('declares every uniform the generated shaders reference', () => {
    // Derived from each effect's own compiled source rather than restated as
    // a fixed list — a fixed list still passes if a new uniform is added to
    // the GLSL and forgotten in material.ts's `buildMaterial()`, which is
    // exactly the failure this test is named for. Looped over more than one
    // effect to guard against a future uniform that only some effect emits —
    // today every effect's declared uniforms come from the same shared
    // baseGLSL + sourcesGLSL that compile.ts splices into all of them
    // unconditionally, so basic and cosmos-holo currently declare an
    // identical set.
    for (const id of ['basic', 'cosmos-holo'] as const) {
      const m = createMaterial(id);
      const declared = declaredUniforms(m?.fragmentShader ?? '');
      // A regex that matched nothing would make the loop below vacuously
      // pass even if material.ts provided zero uniforms, so assert it
      // actually found declarations before trusting it found them all.
      expect(declared.length, `${id}: found uniform declarations`).toBeGreaterThan(0);
      for (const name of declared) {
        expect(m?.uniforms, `${id}: ${name}`).toHaveProperty(name);
      }
    }
  });

  it('provides the samplers an effect using the generated SV textures declares', () => {
    // Neither effect above samples these, so neither would notice if one went
    // missing the day uniform declarations stop being shared by every shader,
    // and no registered effect samples all six: each ball effect samples only
    // its own pair (effects/sv-effects.test.ts). Build a material for an effect
    // that samples all six instead.
    const kinds = [
      'iri',
      'birthday',
      'pokeball',
      'pokeball-inner',
      'masterball',
      'masterball-inner',
    ] as const;
    const layers: Layer[] = kinds.map((kind, i) => ({
      source: { kind, scale: 2 },
      blend: i === 0 ? 'normal' : 'multiply',
    }));
    const material = buildMaterial({
      id: 'sv-textures',
      shine: [{ layers, mixBlend: 'plus-lighter' }],
      glare: [],
    });
    const declared = declaredUniforms(material.fragmentShader);
    for (const uniform of [
      'uIri',
      'uBirthday',
      'uPokeball',
      'uPokeballInner',
      'uMasterball',
      'uMasterballInner',
    ]) {
      expect(declared, uniform).toContain(uniform);
    }
    for (const name of declared) expect(material.uniforms, name).toHaveProperty(name);
    material.dispose();
  });

  it('falls back to basic when an effect cannot be compiled', () => {
    // An id outside the registry makes compileEffect throw on an undefined effect.
    const m = createMaterial('does-not-exist' as Parameters<typeof createMaterial>[0]);
    expect(m).not.toBeNull();
    expect(m?.fragmentShader).toBe(createMaterial('basic')?.fragmentShader);
  });
});
```

- [ ] **Step 4: Run it to watch it fail**

Run: `cd apps/holodex && pnpm exec vitest run src/holo/material.test.ts`
Expected: FAIL — every `createMaterial` test with `TypeError: createMaterial is not a function` (the module still exports `getMaterial`); the SV-samplers test, which uses only `buildMaterial`, passes.

- [ ] **Step 5: Write `createMaterial` and drop the cache**

In `apps/holodex/src/holo/material.ts`: delete the `import { registerCacheDispose } from './teardown';` line, the `const cache = new Map<EffectId, ShaderMaterial>();` line, the whole `getMaterial` function with its doc comment, `disposeMaterials` with its doc comment, and the trailing `registerCacheDispose(disposeMaterials);` with the four comment lines above it. Change `buildMaterial`'s doc comment to:

```ts
/**
 * A fresh material for one effect. Callers want `createMaterial`; this is
 * exported so a test can build one for an effect the registry does not hold.
 */
```

and add after `buildMaterial`:

```ts
/**
 * A material of its own for one scene: a fresh `ShaderMaterial` on every
 * call, which the scene disposes with itself (scene.ts).
 *
 * Nothing is cached, because nothing would be saved. The GPU compile belongs
 * to the renderer, and every scene builds its own and force-loses its context
 * on dispose, so a shared material was re-linked for each card anyway; and
 * `compileEffect()` costs about 0.016 ms (0.054 ms at worst, measured
 * 2026-09-25). A material shared across scenes also shared its uniforms, and
 * outlived them, so the remote had to free it on unmount; a scene's own has
 * neither problem.
 *
 * A build failure falls back to `basic`; if `basic` itself fails the caller
 * drops to the plain image.
 */
export function createMaterial(id: EffectId): ShaderMaterial | null {
  try {
    return buildMaterial(EFFECTS[id]);
  } catch (error) {
    log.warn('holo.compile-failed', {
      effect: id,
      error: error instanceof Error ? error.message : String(error),
    });
    if (id === 'basic') return null;
    return createMaterial('basic');
  }
}
```

- [ ] **Step 6: Run the material tests to watch them pass**

Run: `cd apps/holodex && pnpm exec vitest run src/holo/material.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Make the scene own its material**

In `apps/holodex/src/holo/scene.ts`:

Line 15:

```ts
import { createMaterial } from './material';
```

Replace the doc comment on `const shared` (lines 32–37) with:

```ts
/**
 * The generated CanvasTextures (textures.ts), built once per name here and
 * shared by every scene: each is a canvas painted once, which every scene's
 * renderer uploads for itself, so no one scene's dispose() frees it.
 */
```

Replace the comment above `const current` (lines 136–140) with:

```ts
// Spring-smoothed toward `target` each frame so the card leans rather than
// snapping, then written into the current material's uPointer uniforms in
// frame() below.
```

Replace the comment above `const placeholder` (lines 143–145) with:

```ts
// Stands in for `mesh.material` until the first successful setSelection(),
// which disposes it.
```

Replace the comment above `let cardTexture` (lines 175–176) with:

```ts
// The card art, owned here: setSelection binds it onto each material it
// creates, and dispose() frees it.
```

In `setSelection`, change the first line to `const material = createMaterial(selection.effect);` and replace its last line, `mesh.material = material;`, with:

```ts
// This scene's own, so the one it replaces (the placeholder, or an
// earlier selection's) has no other user.
mesh.material.dispose();
mesh.material = material;
```

Replace the body of `dispose()` from `cancelAnimationFrame(raf);` down to `geometry.dispose();` with:

```ts
cancelAnimationFrame(raf);
cardTexture?.dispose();
// The current material, the placeholder or the selection's, is this
// scene's own. The generated textures are shared by every scene, so
// none is touched here.
mesh.material.dispose();
geometry.dispose();
```

This removes the "only clear the shared material's uCard" block and `placeholder.dispose()`; the comment and calls about `forceContextLoss()` and `renderer.dispose()` below stay as they are.

- [ ] **Step 8: Typecheck and run the holo suite**

Run: `pnpm --filter @ncam/holodex typecheck && cd apps/holodex && pnpm exec vitest run src/holo`
Expected: typecheck clean; PASS, every test.

- [ ] **Step 9: Update AGENTS.md for the rename and the new ownership**

In `apps/holodex/AGENTS.md`:

- In the lazy-module list (`textures.ts`, `program-cache.ts`, `shader/` …), replace `program-cache.ts` with `material.ts`.
- In the `#version` gotcha, replace ``(`program-cache.ts`'s `buildMaterial()` sets it)`` with ``(`material.ts`'s `buildMaterial()` sets it)``.
- Replace the whole paragraph that begins `**The program cache.**` with:

```markdown
**A material per scene.** `holo/material.ts#createMaterial(id)` builds a fresh
`ShaderMaterial` for an effect on every call (`compileEffect` plus the shared
`VERTEX_SHADER`), and the scene that asked owns it: `setSelection` swaps it in
and frees the one it replaces, and `dispose()` frees the last. Nothing is
cached, because nothing would be saved: three.js keeps its program cache on
the `WebGLRenderer`, every scene builds its own renderer and force-loses its
context on `dispose()`, so each card links its program anyway, and
`compileEffect()` costs about 0.016 ms. The module-level cache this replaced
(`program-cache.ts`, until 2026-09-25) shared one material, and so one set of
uniforms, across every scene on an effect, and outlived them all, so the
remote had to free it on unmount through a three-free shim. A build failure
logs `holo.compile-failed` and falls back to `basic`; if `basic` itself fails,
`createMaterial` returns `null` and `HoloCard` drops to the plain image.
```

Run: `pnpm exec prettier --check apps/holodex/AGENTS.md apps/holodex/src/holo/material.ts apps/holodex/src/holo/material.test.ts apps/holodex/src/holo/scene.ts apps/holodex/src/holo/effects/sv-effects.test.ts`
Expected: `All matched files use Prettier code style!` (run `--write` on any file it lists, then re-check).

- [ ] **Step 10: Commit**

```bash
git add -- apps/holodex/src/holo/material.ts apps/holodex/src/holo/material.test.ts \
  apps/holodex/src/holo/program-cache.ts apps/holodex/src/holo/program-cache.test.ts \
  apps/holodex/src/holo/scene.ts apps/holodex/src/holo/effects/sv-effects.test.ts apps/holodex/AGENTS.md
git commit -m "refactor(holodex): give every holo scene a material of its own" \
  -m "program-cache.ts kept one ShaderMaterial per effect for the page's lifetime, shared by every scene on that effect. It saved no GPU work, since three.js keeps its program cache on the renderer and every scene builds its own and force-loses its context on dispose, and no CPU worth keeping: compileEffect() measured 0.016 ms. It did share one set of uniforms across scenes, the last writer winning, and it outlived them, so the remote had to free it on unmount." \
  -m "material.ts (renamed; it caches nothing) now builds a fresh material per call with createMaterial(), falling back to basic as before. The scene owns what it creates: setSelection disposes the material it replaces, dispose() the last, and the guards written for a shared material are gone. material.test.ts pins that two calls share neither a material nor a uniform object." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Delete the teardown shim, and prove the split and the lifecycle

**Files:**

- Delete: `apps/holodex/src/holo/teardown.ts`
- Modify: `apps/holodex/src/mount.tsx` (import at line 8; the comment and `disposeHoloCache();` at lines 51–65)
- Modify: `apps/holodex/src/hydrate.tsx` (import at line 9; the comment and `disposeHoloCache();` at lines 61–75)
- Modify: `apps/holodex/AGENTS.md` (structure bullet for `src/holo/`; the bundle-history note)

**Interfaces:**

- Consumes: Task 1's `material.ts`, which no longer imports `teardown.ts`, so nothing registers a disposer any more and `disposeHoloCache()` is already a no-op.
- Produces: no `holo/teardown.ts`; `unmount` (mount.tsx) and `dispose_` (hydrate.tsx) end at `root.unmount()` (mount.tsx also still removes its style element).

- [ ] **Step 1: Remove the shim and its callers**

```bash
git rm apps/holodex/src/holo/teardown.ts
```

In `apps/holodex/src/mount.tsx`, delete line 8, `import { disposeHoloCache } from './holo/teardown';`, and in `unmount` delete everything from the comment line `// Frees every cached holo shader program, through teardown.ts's` down to and including `disposeHoloCache();`, so the microtask reads:

```ts
queueMicrotask(() => {
  root.unmount();
  doc.getElementById(STYLE_ID)?.remove();
});
```

In `apps/holodex/src/hydrate.tsx`, delete line 9, `import { disposeHoloCache } from './holo/teardown';`, and in `dispose_` delete the same comment and call, so the microtask reads:

```ts
queueMicrotask(() => {
  root.unmount();
});
```

- [ ] **Step 2: Nothing may still name the shim**

Run: `grep -rn -E "teardown\.ts|disposeHoloCache|registerCacheDispose|disposeMaterials|getMaterial" apps/holodex/src`
Expected: no output.

- [ ] **Step 3: Update AGENTS.md**

In `apps/holodex/AGENTS.md`:

- In the `src/holo/` structure bullet, delete `` `teardown.ts` (three-free indirection onto the shader cache's disposer — see "The holo chunk is lazy" below), `` so the list runs straight from `` `use-reduced-motion.ts`, `` to `` `effect-gallery.ts` ``.
- After the numbered list under **Bundle history on this branch**, add the paragraph:

```markdown
Neither shim is left: since 2026-09-25 each scene owns its material ("A
material per scene"), so there is no cache to free on unmount and
`teardown.ts` is gone. Nothing outside `scene.ts` reaches the holo chunk's
modules any more, statically or dynamically. The measurements above still
name it because they describe the build as it was.
```

Run: `pnpm exec prettier --check apps/holodex/AGENTS.md apps/holodex/src/mount.tsx apps/holodex/src/hydrate.tsx`
Expected: `All matched files use Prettier code style!`

- [ ] **Step 4: Run the whole suite, lint and typecheck**

Run: `pnpm vitest run && pnpm lint && pnpm --filter @ncam/holodex typecheck`
Expected: every test passes (the count is Task 1's total; no test file is added or removed in this task), lint and typecheck clean.

- [ ] **Step 5: Build, and check three.js stayed in the lazy chunk**

```bash
rm -rf apps/holodex/dist apps/holodex/dist-ssr
pnpm --filter @ncam/holodex build
cd apps/holodex
grep -l -F 'THREE.WebGLRenderer' dist/assets/*.js
comm -23 <(grep -l -F 'THREE.WebGLRenderer' dist/assets/*.js | xargs -n1 basename | sort) <(ls dist-ssr/assets | sort)
```

Expected: the first grep lists exactly two files; the `comm` lists exactly one, the client's own `scene-*.js`. Note its gzip size from the build report (it was 139.60 KB at `618d32c`; it should barely move).

- [ ] **Step 6: GPU smoke pass on the dev server (9107)**

Start `holodex-smoke` (Browser pane `preview_start`, name `holodex-smoke`), then in its tab:

1. `/card/swsh3-25`: toggle Normal → Reverse holo → Normal … ten times. After each click the root `span[data-effect]` carries a live `<canvas>`, and its `data-effect` alternates between the card's effect and `reverse-holo`.
2. `/card/swsh3-3`: the same ten toggles.
3. `/effects`: pick five tiles in different sections in turn; each time exactly one `span[data-effect] canvas` exists on the page.
4. On a live card, run in the page: `document.querySelector('span[data-effect] canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`, wait two seconds, then `…restoreContext()` on the canvas that is live by then; the foil comes back.
5. Read the console: no three.js errors, no `holo.unavailable`, and `holo.context-lost` only for step 4's forced loss.

Expected: every check holds. Any failure is a bug to fix before committing (superpowers:systematic-debugging).

- [ ] **Step 7: Commit**

```bash
git add -- apps/holodex/src/holo/teardown.ts apps/holodex/src/mount.tsx apps/holodex/src/hydrate.tsx apps/holodex/AGENTS.md
git commit -m "refactor(holodex): drop the teardown shim nothing needs any more" \
  -m "teardown.ts let mount.tsx and hydrate.tsx free the program cache on unmount without importing three.js. With a material per scene there is no cache to free, so the shim, its registration and both disposeHoloCache() calls go, and with them the hazard mount.tsx warned about: on a page with two Holodex mounts, the first to unmount freed materials the second was still drawing with." \
  -m "Verified: fresh build, THREE.WebGLRenderer in exactly two dist files and one client scene chunk (<the gzip size Step 5 printed>); GPU smoke on the dev server: normal/reverse toggled ten times on swsh3-25 and swsh3-3, five effects tiles, a context lost and restored, console clean." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Replace `<the gzip size Step 5 printed>` with the number the build reported, e.g. `139.6 KB gz`.
