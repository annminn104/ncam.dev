import { ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { createLogger } from '@ncam/logger';
import { compileEffect, VERTEX_SHADER } from './shader/compile';
import type { Effect } from './shader/types';
import { EFFECTS } from './effects';
import { DEFAULT_FOIL_BRIGHTNESS, DEFAULT_GLOW, type EffectId } from './select';

const log = createLogger({ scope: 'holodex' });

/**
 * A fresh material for one effect. Callers want `createMaterial`; this is
 * exported so a test can build one for an effect the registry does not hold.
 */
export function buildMaterial(effect: Effect): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: '300 es',
    transparent: true,
    vertexShader: VERTEX_SHADER,
    fragmentShader: compileEffect(effect),
    uniforms: {
      uCard: { value: null },
      uGlitter: { value: null },
      uGrain: { value: null },
      uIri: { value: null },
      uBirthday: { value: null },
      uPokeball: { value: null },
      uPokeballInner: { value: null },
      uMasterball: { value: null },
      uMasterballInner: { value: null },
      uGeometric: { value: null },
      uTrainerbg: { value: null },
      uIllusion: { value: null },
      uIllusionMask: { value: null },
      uAncient: { value: null },
      uVmaxbg: { value: null },
      uCosmosBottom: { value: null },
      uCosmosMiddle: { value: null },
      uCosmosTop: { value: null },
      uPointer: { value: new Vector2(0, 0) },
      uPointerUV: { value: new Vector2(0.5, 0.5) },
      uPointerFromCenter: { value: 0 },
      uTime: { value: 0 },
      uClipRect: { value: new Vector4(0, 0, 0, 0) },
      // all zeros: no box cut until setSelection sets the card's own
      uCutA: { value: new Vector4(0, 0, 0, 0) },
      uCutB: { value: new Vector4(0, 0, 0, 0) },
      uCutC: { value: new Vector4(0, 0, 0, 0) },
      // all zeros: every cut a box, upright
      uCutOval: { value: new Vector3(0, 0, 0) },
      uCutSlant: { value: new Vector3(0, 0, 0) },
      // all zeros: no border foiled until setSelection says otherwise
      uBorder: { value: new Vector4(0, 0, 0, 0) },
      uBorderRound: { value: new Vector2(0, 0) },
      uInvert: { value: 0 },
      uCardOpacity: { value: 1 },
      // :root's --card-glow until setSelection sets the card's own
      uCardGlow: { value: new Vector3(...DEFAULT_GLOW) },
      // reverse-holo.css's --foil-brightness until setSelection sets the card's own
      uFoilBrightness: { value: DEFAULT_FOIL_BRIGHTNESS },
    },
  });
}

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
