import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { orientTexture, pointerToUV } from './scene';

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
