import { describe, expect, it } from 'vitest';
import { mergeScene } from '../src/mergeScene.mjs';

const layout = {
  slots: [
    {
      id: 'pond_01',
      module: 'pond',
      position: [3, 0, 2],
      rotation: [0, 0.258819, 0, 0.965926],
      scale: [1, 1, 1],
    },
  ],
  camera: { idle: { position: [14, 9, 14], rotation: [0, 0, 0, 1], fov: 37.849 }, stops: [] },
  sky: { sunrise: '06:00', sunset: '18:00' },
};
const metas = [{ id: 'pond', footprint: [4, 3], role: 'prop' }];

describe('mergeScene', () => {
  it('builds a v1 scene with per-tier module paths', () => {
    expect(mergeScene({ layout, metas, generatedAt: '2026-10-15T10:00:00Z' })).toEqual({
      version: 1,
      generatedAt: '2026-10-15T10:00:00Z',
      modules: {
        pond: {
          src: { high: 'modules/pond.high.glb', medium: 'modules/pond.medium.glb' },
          footprint: [4, 3],
          role: 'prop',
        },
      },
      slots: layout.slots,
      camera: layout.camera,
      sky: layout.sky,
    });
  });

  it('does not mistake Object.prototype members for modules', () => {
    const inherited = { ...layout, slots: [{ ...layout.slots[0], module: 'constructor' }] };
    expect(() => mergeScene({ layout: inherited, metas, generatedAt: 'x' })).toThrow(
      /unknown module 'constructor'/,
    );
  });

  it('rejects slots whose module has no .blend', () => {
    const ghost = { ...layout, slots: [{ ...layout.slots[0], module: 'ghost' }] };
    expect(() => mergeScene({ layout: ghost, metas, generatedAt: 'x' })).toThrow(
      /unknown module 'ghost'/,
    );
  });
});
