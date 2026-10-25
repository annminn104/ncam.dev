import { describe, expect, it } from 'vitest';
import { loadScene, moduleUrl, parseScene, SceneError } from './loadScene';

const VALID = {
  version: 1,
  generatedAt: '2026-10-15T10:00:00Z',
  modules: {
    pond: {
      src: { high: 'modules/pond.high.glb', medium: 'modules/pond.medium.glb' },
      footprint: [4, 3],
      role: 'prop',
    },
  },
  slots: [
    {
      id: 'pond_01',
      module: 'pond',
      position: [3, 0, 2],
      rotation: [0, 0.2588, 0, 0.9659],
      scale: [1, 1, 1],
    },
  ],
  camera: {
    idle: { position: [14, 9, 14], rotation: [0, 0, 0, 1], fov: 37.8 },
    stops: [{ id: 'CAM_stop_01', position: [0, 4, 12], rotation: [0, 0, 0, 1], fov: 37.8 }],
  },
  sky: { sunrise: '06:00', sunset: '18:00' },
};

describe('parseScene', () => {
  it('accepts a valid scene', () => {
    expect(parseScene(VALID)).toEqual(VALID);
  });

  it('rejects an unknown version', () => {
    expect(() => parseScene({ ...VALID, version: 2 })).toThrow(SceneError);
  });

  it('rejects slots that use unknown modules', () => {
    const bad = { ...VALID, slots: [{ ...VALID.slots[0], module: 'ghost' }] };
    expect(() => parseScene(bad)).toThrow(/unknown module 'ghost'/);
  });

  it('rejects prototype keys as module ids', () => {
    for (const module of ['constructor', 'toString', 'hasOwnProperty']) {
      const bad = { ...VALID, slots: [{ ...VALID.slots[0], module }] };
      expect(() => parseScene(bad), module).toThrow(/unknown module/);
    }
  });

  it('rejects malformed sky times', () => {
    expect(() => parseScene({ ...VALID, sky: { sunrise: '6am', sunset: '18:00' } })).toThrow(
      SceneError,
    );
  });

  it('rejects vectors of the wrong length', () => {
    const bad = { ...VALID, slots: [{ ...VALID.slots[0], position: [1, 2] }] };
    expect(() => parseScene(bad)).toThrow(SceneError);
  });
});

describe('loadScene', () => {
  it('fetches and parses scene.json', async () => {
    const fetchImpl = async () => new Response(JSON.stringify(VALID));
    await expect(loadScene('/assets/scene.json', fetchImpl)).resolves.toEqual(VALID);
  });

  it('throws SceneError on HTTP errors', async () => {
    const fetchImpl = async () => new Response('missing', { status: 404 });
    await expect(loadScene('/assets/scene.json', fetchImpl)).rejects.toThrow(/HTTP 404/);
  });

  it('throws SceneError on invalid JSON', async () => {
    const fetchImpl = async () => new Response('<html>');
    await expect(loadScene('/assets/scene.json', fetchImpl)).rejects.toThrow(SceneError);
  });
});

describe('moduleUrl', () => {
  it('resolves module paths next to scene.json', () => {
    expect(moduleUrl('modules/pond.high.glb', '/assets/scene.json')).toBe(
      '/assets/modules/pond.high.glb',
    );
  });

  it("stays on the remote's origin when scene.json came from there", () => {
    expect(moduleUrl('modules/pond.high.glb', 'https://garden.example/assets/scene.json')).toBe(
      'https://garden.example/assets/modules/pond.high.glb',
    );
  });
});
