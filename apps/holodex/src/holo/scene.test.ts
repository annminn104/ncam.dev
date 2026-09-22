import { describe, expect, it } from 'vitest';
import { pointerToUV } from './scene';

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
