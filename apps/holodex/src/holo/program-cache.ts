import { ShaderMaterial, Vector2, Vector4 } from 'three';
import { createLogger } from '@ncam/logger';
import { compileEffect, VERTEX_SHADER } from './shader/compile';
import { EFFECTS } from './effects';
import type { EffectId } from './select';
import { registerCacheDispose } from './teardown';

const log = createLogger({ scope: 'holodex' });

const cache = new Map<EffectId, ShaderMaterial>();

function build(id: EffectId): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: '300 es',
    transparent: true,
    vertexShader: VERTEX_SHADER,
    fragmentShader: compileEffect(EFFECTS[id]),
    uniforms: {
      uCard: { value: null },
      uGlitter: { value: null },
      uGrain: { value: null },
      uPointer: { value: new Vector2(0, 0) },
      uPointerUV: { value: new Vector2(0.5, 0.5) },
      uPointerFromCenter: { value: 0 },
      uTime: { value: 0 },
      uClipRect: { value: new Vector4(0, 0, 0, 0) },
      uClipShape: { value: 0 },
      uInvert: { value: 0 },
      uCardOpacity: { value: 1 },
    },
  });
}

/**
 * One `ShaderMaterial` per effect id, built on first use and kept for the
 * page's lifetime.
 *
 * What this actually saves is CPU work, not GPU work: `compileEffect()`'s
 * string codegen and a single `ShaderMaterial` construction per effect. It
 * does NOT save the GPU compile-and-link. three.js keeps its program cache on
 * the `WebGLRenderer`, and `scene.ts` calls `forceContextLoss()` when a card
 * tears down, so each new card's renderer re-links every program from scratch
 * however warm this map is. The name is older than that teardown; don't read
 * "cache" as "the shader is compiled once".
 *
 * Hazard: a material is shared by every card using that effect, and so are its
 * uniforms. Two cards on screen with the same effect mutate the very same
 * `uPointer`, `uClipRect` and `uCard` objects, and the last writer wins. It is
 * invisible today only because `scene.ts` gives each card its own renderer and
 * rewrites the pointer and time uniforms immediately before each draw, with
 * the clip and texture uniforms rewritten on every `setSelection`. Anything
 * that batches cards into one renderer, or lets a uniform write outlive the
 * draw it was meant for, needs per-instance materials (`material.clone()`).
 * Restructuring that is an open decision for the repo owner, not a to-do here.
 *
 * A build failure falls back to `basic`; if `basic` itself fails the caller
 * drops to the plain image.
 */
export function getMaterial(id: EffectId): ShaderMaterial | null {
  const hit = cache.get(id);
  if (hit) return hit;
  try {
    const material = build(id);
    cache.set(id, material);
    return material;
  } catch (error) {
    log.warn('holo.compile-failed', {
      effect: id,
      error: error instanceof Error ? error.message : String(error),
    });
    if (id === 'basic') return null;
    return getMaterial('basic');
  }
}

/** Frees every cached program. Called when the whole remote unmounts. */
export function disposeMaterials(): void {
  for (const material of cache.values()) material.dispose();
  cache.clear();
}

// Registered at module scope, the moment this module is first loaded, so
// mount.tsx / hydrate.tsx can free this cache through teardown.ts's
// three-free indirection without ever importing this file — or three.js —
// themselves. See teardown.ts for why that indirection exists.
registerCacheDispose(disposeMaterials);
