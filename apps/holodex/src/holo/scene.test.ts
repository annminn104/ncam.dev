import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { EFFECTS } from './effects';
import { orientTexture, pointerToUV, SHARED_TEXTURE_UNIFORM, texturesUsedBy } from './scene';
import { sourcesGLSL } from './shader/sources';
import type { Effect } from './shader/types';

// createHoloScene() needs a live WebGL renderer, so it can't run under this
// repo's node test environment — but the pointer-space mapping it feeds into
// uPointerUV every frame is a pure function, pulled out of the frame loop
// specifically so this can be pinned without one. See pointerToUV's own
// comment in scene.ts for why the y term flips.
describe('pointerToUV', () => {
  it('maps the pointer at the top of the card to uPointerUV.y = 0', () => {
    // HoloCard's onPointerMove negates clientY, so p.y = +1 is the top.
    const [, v] = pointerToUV(0, 1);
    expect(v).toBe(0);
  });

  it('maps the pointer at the bottom of the card to uPointerUV.y = 1', () => {
    const [, v] = pointerToUV(0, -1);
    expect(v).toBe(1);
  });

  it('maps the centered pointer to the center of uPointerUV', () => {
    expect(pointerToUV(0, 0)).toEqual([0.5, 0.5]);
  });

  it('maps x straight through 0..1 with no flip', () => {
    expect(pointerToUV(-1, 0)[0]).toBe(0);
    expect(pointerToUV(1, 0)[0]).toBe(1);
  });
});

// createHoloScene()'s two call sites (the shared glitter/grain textures and
// the per-card texture in setCard) both need a live WebGL renderer to reach,
// but orientTexture itself is a pure function on a Texture instance, so a
// bare `new Texture()` pins it without one. See orientTexture's own comment
// in scene.ts for why the flip has to be off.
describe('orientTexture', () => {
  it('sets flipY to false so textures match the shader-flipped vUv', () => {
    // three.js defaults flipY to true; the vertex shader already flips vUv
    // (shader/base.ts), so a texture that also flips renders every card
    // upside down. This is the one leg of that fix a silent revert would
    // otherwise slip through untested.
    const texture = new Texture();
    expect(orientTexture(texture).flipY).toBe(false);
  });
});

// setSelection's binding loop needs a live renderer, but what it binds where
// is data, and pinned here against the shader source itself.
describe('SHARED_TEXTURE_UNIFORM', () => {
  it('feeds every sampler the shaders declare, but the card’s own, from exactly one texture', () => {
    // A sampler nothing feeds reads black on the GPU; a texture bound to a
    // neighbour's uniform draws the wrong pattern. Neither shows up anywhere
    // but on a card.
    const samplers = Array.from(sourcesGLSL.matchAll(/uniform sampler2D (\w+);/g), (m) => m[1])
      .filter((uniform) => uniform !== 'uCard')
      .sort();
    expect(samplers.length).toBeGreaterThan(0);
    expect(Object.values(SHARED_TEXTURE_UNIFORM).sort()).toEqual(samplers);
  });
});

describe('texturesUsedBy', () => {
  it('names each texture an effect samples, once, from shine and glare alike', () => {
    const effect: Effect = {
      id: 'uses',
      shine: [
        {
          layers: [
            { source: { kind: 'iri', scale: 2 }, blend: 'normal' },
            { source: { kind: 'card' }, blend: 'multiply' },
            { source: { kind: 'iri', scale: 3 }, blend: 'screen' },
          ],
          mixBlend: 'plus-lighter',
        },
      ],
      glare: [
        {
          layers: [{ source: { kind: 'pokeball-inner', scale: 2.5 }, blend: 'normal' }],
          mixBlend: 'lighten',
        },
      ],
    };
    expect(texturesUsedBy(effect).sort()).toEqual(['iri', 'pokeball-inner']);
  });

  it('still hands the older effects the glitter and grain they sample, and basic nothing', () => {
    // Binding used to be unconditional for these two; it is now on use, so
    // this is the regression check for every effect already shipped.
    expect(texturesUsedBy(EFFECTS['cosmos-holo']).sort()).toEqual(['glitter', 'grain']);
    expect(texturesUsedBy(EFFECTS.basic)).toEqual([]);
  });
});
