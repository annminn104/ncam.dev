import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { EFFECTS } from './effects';
import { cutsFor, inkStripFor } from './regions';
import {
  borderRoundUniform,
  borderUniform,
  cutOvalUniform,
  cutSlantUniform,
  cutUniform,
  inkRectUniform,
  orientTexture,
  pointerFromCenter,
  pointerToUV,
  SHARED_TEXTURE_UNIFORM,
  texturesUsedBy,
} from './scene';
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

// uPointerFromCenter, which every effect's `fromCenter` term reads. The
// reference computes --pointer-from-center in Card.svelte (pokemon-cards-151,
// and pokemon-cards-css before it) from the pointer's position in percent:
// clamp(Math.sqrt((y - 50) * (y - 50) + (x - 50) * (x - 50)) / 50, 0, 1).
describe('pointerFromCenter', () => {
  const reference = (x: number, y: number) => {
    const [u, v] = pointerToUV(x, y);
    const [px, py] = [u * 100, v * 100];
    return Math.min(Math.max(Math.hypot(px - 50, py - 50) / 50, 0), 1);
  };

  it('is 0 at the centre and reaches 1 at the middle of every edge', () => {
    expect(pointerFromCenter(0, 0)).toBe(0);
    for (const [x, y] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      expect(pointerFromCenter(x, y)).toBeCloseTo(1, 12);
    }
  });

  it('holds at 1 past the middle of an edge, out to the corners', () => {
    expect(pointerFromCenter(1, 1)).toBe(1);
    expect(pointerFromCenter(-0.8, 0.8)).toBe(1);
  });

  it('matches the reference at every point across the card', () => {
    const steps = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
    for (const x of steps) {
      for (const y of steps) {
        expect(pointerFromCenter(x, y)).toBeCloseTo(reference(x, y), 12);
      }
    }
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

// setSelection hands each cut box to the shader through cutUniform, which is
// pure: compile.test.ts runs coverage() on exactly these vectors.
describe('borderUniform', () => {
  it('hands coverage() the border rect, top, right, bottom, left, when the foil takes the border', () => {
    expect(borderUniform(true)).toEqual([0.028, 0.04, 0.028, 0.04]);
  });

  it('sends all zeros, a rect holding the whole card, which adds no border', () => {
    expect(borderUniform(false)).toEqual([0, 0, 0, 0]);
  });
});

describe('borderRoundUniform', () => {
  it('rounds the border rect’s corners as the card face’s, when the foil takes the border', () => {
    expect(borderRoundUniform(true)).toEqual([0.011, 0.01]);
  });

  it('sends zeros with no border, which keeps the whole-card rect a plain one', () => {
    expect(borderRoundUniform(false)).toEqual([0, 0]);
  });
});

describe('cutUniform', () => {
  it('lays a box out as inBox() reads it: x0, y0, x1, y1', () => {
    const [banner, disc] = cutsFor('stage', 'dp');
    expect(cutUniform(banner)).toEqual([0, 0, 0.57, 0.125]);
    expect(cutUniform(disc)).toEqual([0, 0, 0.19, 0.165]);
    expect(cutUniform(cutsFor('stage', 'ex')[0])).toEqual([0, 0.44, 0.18, 1]);
  });

  it('sends all zeros, which cut nothing, for a box the region lacks', () => {
    expect(cutUniform(cutsFor('regular', 'swsh')[0])).toEqual([0, 0, 0, 0]);
  });
});

// setSelection's binding loop needs a live renderer, but what it binds where
// is data, and pinned here against the shader source itself.
describe('cutOvalUniform', () => {
  it('flags each cut that is the ellipse its box holds, in the order coverage() reads them', () => {
    expect(cutOvalUniform(cutsFor('stage', 'sv'))).toEqual([0, 1, 0, 0]);
    expect(cutOvalUniform(cutsFor('stage', 'sv-illustration'))).toEqual([0, 1, 0, 0]);
    expect(cutOvalUniform(cutsFor('stage', 'sv-special-illustration'))).toEqual([1, 0, 0, 0]);
    expect(cutOvalUniform(cutsFor('stage', 'sv-ultra-ex'))).toEqual([0, 1, 0, 0]);
  });

  it('flags none on a layout whose cuts are all boxes, nor for a cut it lacks', () => {
    expect(cutOvalUniform(cutsFor('stage', 'dp'))).toEqual([0, 0, 0, 0]);
    expect(cutOvalUniform(cutsFor('regular', 'swsh'))).toEqual([0, 0, 0, 0]);
  });
});

describe('cutSlantUniform', () => {
  it('hands each cut’s slant, how far its right edge leans by its bottom, in coverage()’s order', () => {
    const [band, , junction] = cutsFor('stage', 'sv');
    expect(cutSlantUniform(cutsFor('stage', 'sv'))).toEqual([band.slant, 0, junction.slant, 0]);
    expect(cutSlantUniform(cutsFor('stage', 'sv-illustration'))).toEqual([
      0,
      0,
      band.slant,
      junction.slant,
    ]);
  });

  it('leans none on a layout whose cuts are all upright, nor for a cut it lacks', () => {
    expect(cutSlantUniform(cutsFor('stage', 'dp'))).toEqual([0, 0, 0, 0]);
    expect(cutSlantUniform(cutsFor('regular', 'swsh'))).toEqual([0, 0, 0, 0]);
  });
});

describe('inkRectUniform', () => {
  it('hands a trainer its own strip, its name’s', () => {
    const strip = inkStripFor('trainer', 'sv-ultra')!;
    expect(inkRectUniform('trainer', 'sv-ultra')).toEqual([strip.x0, strip.y0, strip.x1, strip.y1]);
  });

  it('hands coverage() the title strip where a card’s ink is cut, x0, y0, x1, y1', () => {
    const strip = inkStripFor('stage', 'sv-illustration')!;
    expect(inkRectUniform('stage', 'sv-illustration')).toEqual([
      strip.x0,
      strip.y0,
      strip.x1,
      strip.y1,
    ]);
  });

  it('sends zeros, a strip holding nothing, where no ink is cut', () => {
    expect(inkRectUniform('regular', 'sv')).toEqual([0, 0, 0, 0]);
    expect(inkRectUniform('trainer', 'sv')).toEqual([0, 0, 0, 0]);
  });
});

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
  it('names a texture sampled only by glare painted beneath the shine', () => {
    const effect: Effect = {
      id: 'beneath-only',
      beneath: [
        { layers: [{ source: { kind: 'grain', scale: 1 }, blend: 'normal' }], mixBlend: 'overlay' },
      ],
      shine: [{ layers: [{ source: { kind: 'card' }, blend: 'normal' }], mixBlend: 'normal' }],
      glare: [],
    };
    expect(texturesUsedBy(effect)).toEqual(['grain']);
  });

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

  it('names a texture sampled only inside a child', () => {
    const effect: Effect = {
      id: 'child-only',
      shine: [
        {
          layers: [{ source: { kind: 'solid', color: [0, 0, 0] }, blend: 'normal' }],
          mixBlend: 'screen',
          children: [
            {
              layers: [{ source: { kind: 'geometric', scale: 1 }, blend: 'normal' }],
              mixBlend: 'lighten',
            },
          ],
        },
      ],
      glare: [],
    };
    expect(texturesUsedBy(effect)).toEqual(['geometric']);
  });

  it('hands the ported older effects the textures their CSS names, children’s included, and basic nothing', () => {
    // Binding is on use, so every texture a port samples must be named here,
    // including those only its :before or :after samples.
    expect(texturesUsedBy(EFFECTS['cosmos-holo']).sort()).toEqual([
      'cosmos-bottom',
      'cosmos-middle',
      'cosmos-top',
    ]);
    expect(texturesUsedBy(EFFECTS['secret-rare']).sort()).toEqual(['geometric', 'glitter']);
    expect(texturesUsedBy(EFFECTS['v-regular'])).toEqual(['grain']);
    expect(texturesUsedBy(EFFECTS.basic)).toEqual([]);
  });
});
