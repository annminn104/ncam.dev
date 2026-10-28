import type { WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clear = vi.fn();
// Hooks run outside React here; R3F's own module is not needed to check what release drops.
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { gl: unknown }) => unknown) => select({ gl: {} }),
  useLoader: Object.assign(() => ({}), { clear: (...args: unknown[]) => clear(...args) }),
}));

import {
  forgetModules,
  getKTX2Loader,
  releaseLoaders,
  setTranscoderPath,
  useModuleGLTF,
} from './loader';

/** Just enough renderer for KTX2Loader.detectSupport. */
const gl = { extensions: { has: () => false } } as unknown as WebGLRenderer;
const HOUSE = 'https://garden.example/assets/modules/house.high.glb';
const POOL = 'https://garden.example/assets/modules/pool.high.glb';

describe('releaseLoaders', () => {
  beforeEach(() => {
    releaseLoaders();
    clear.mockClear();
  });

  it("drops every loaded module from R3F's cache and stops the KTX2 transcoder", () => {
    useModuleGLTF(HOUSE);
    useModuleGLTF(POOL);
    useModuleGLTF(HOUSE);
    const ktx2 = getKTX2Loader(gl);
    const dispose = vi.spyOn(ktx2, 'dispose');
    releaseLoaders();
    expect(clear.mock.calls.map(([, url]) => url)).toEqual([HOUSE, POOL]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(getKTX2Loader(gl)).not.toBe(ktx2);
  });

  it("points the transcoder at the remote's origin", () => {
    setTranscoderPath('https://garden.example/basis/');
    expect(getKTX2Loader(gl).transcoderPath).toBe('https://garden.example/basis/');
  });
});

describe('forgetModules', () => {
  beforeEach(() => {
    releaseLoaders();
    clear.mockClear();
  });

  it("drops just the given modules from R3F's cache, so a retry fetches them again", () => {
    useModuleGLTF(HOUSE);
    useModuleGLTF(POOL);
    forgetModules([HOUSE]);
    expect(clear.mock.calls).toEqual([[GLTFLoader, HOUSE]]);
  });

  it('forgets them for good: the next release has only the others left to drop', () => {
    useModuleGLTF(HOUSE);
    useModuleGLTF(POOL);
    forgetModules([HOUSE]);
    clear.mockClear();
    releaseLoaders();
    expect(clear.mock.calls.map(([, url]) => url)).toEqual([POOL]);
  });

  it('is harmless for a module that was never requested', () => {
    expect(() => forgetModules([HOUSE])).not.toThrow();
    expect(clear.mock.calls).toEqual([[GLTFLoader, HOUSE]]);
  });
});
