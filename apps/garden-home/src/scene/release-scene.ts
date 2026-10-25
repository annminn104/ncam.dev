import { useEffect } from 'react';
import { resetHover } from '../interact/Interaction';
import { useAppStore } from '../state/store';
import { resetWarmCut } from './cutaway';
import { releaseLoaders } from './loader';
import { releaseGlowFalloff } from './prepareModule';
import { createReleaseGate } from './release-gate';

/**
 * Everything the scene keeps beyond React's unmount: R3F's cache of the parsed modules, the KTX2
 * transcoder's workers, the shared falloff texture, the store's state and the e2e's ready flag.
 * R3F's own unmount already disposes the renderer and forces its context loss.
 */
function release(): void {
  releaseLoaders();
  releaseGlowFalloff();
  resetWarmCut();
  resetHover();
  startCleanScene();
  if (typeof window !== 'undefined') delete window.__sceneReady;
}

const gate = createReleaseGate(release);

/** The mount's release, once R3F has unmounted the scene's tree (release-gate.ts). */
export function releaseGardenScene(): void {
  gate.request();
}

/** Inside the Canvas: tells the gate a scene's tree is mounted until R3F unmounts it. */
export function ReleaseGate(): null {
  useEffect(() => gate.mount(), []);
  return null;
}

/** The store as it started; a scene boots with it even when the last one's release is still waiting. */
export function startCleanScene(): void {
  useAppStore.setState(useAppStore.getInitialState(), true);
}

/** The gate the tests drive in place of a mounted <ReleaseGate />. */
export const __releaseGateForTests = gate;
