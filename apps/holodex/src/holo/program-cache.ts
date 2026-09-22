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
 * One material per effect, compiled on first use and kept for the page's
 * lifetime. A failure falls back to `basic`; if `basic` itself fails the
 * caller drops to the plain image.
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
