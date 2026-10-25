import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({}),
  useFrame: () => {},
  useLoader: Object.assign(() => ({}), { clear: () => {} }),
}));

import { useAppStore } from '../state/store';
import { glowFalloff } from './prepareModule';
import { __releaseGateForTests, releaseGardenScene, startCleanScene } from './release-scene';

describe('releaseGardenScene', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('puts the store back as it started', () => {
    useAppStore.getState().setCutMode('basement');
    useAppStore.getState().toggle('light:kitchen', false);
    releaseGardenScene();
    const state = useAppStore.getState();
    expect(state.cutMode).toBe('auto');
    expect(state.floorPress).toBe(0);
    expect(state.toggles).toEqual({});
    expect(typeof state.setCutMode).toBe('function');
  });

  it("frees the light pools' falloff texture, so the next mount makes its own", () => {
    const first = glowFalloff();
    const dispose = vi.spyOn(first, 'dispose');
    releaseGardenScene();
    expect(dispose).toHaveBeenCalledOnce();
    expect(glowFalloff()).not.toBe(first);
  });

  it('forgets that a scene was ready', () => {
    const win: { __sceneReady?: boolean } = { __sceneReady: true };
    vi.stubGlobal('window', win);
    releaseGardenScene();
    expect(win.__sceneReady).toBeUndefined();
  });

  it("leaves the store alone until R3F has unmounted the scene's tree", async () => {
    useAppStore.getState().setCutMode('basement');
    const unmount = __releaseGateForTests.mount(); // what <ReleaseGate /> does inside the Canvas
    releaseGardenScene();
    expect(useAppStore.getState().cutMode).toBe('basement');
    unmount();
    expect(useAppStore.getState().cutMode).toBe('basement'); // the release runs a microtask later
    await Promise.resolve();
    expect(useAppStore.getState().cutMode).toBe('auto');
  });
});

describe('startCleanScene', () => {
  it('gives a booting scene the store as it started, whatever the last one left', () => {
    useAppStore.getState().setCutMode('ground');
    startCleanScene();
    const state = useAppStore.getState();
    expect(state.cutMode).toBe('auto');
    expect(state.floorPress).toBe(0);
  });
});
