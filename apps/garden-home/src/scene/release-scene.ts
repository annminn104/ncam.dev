import { resetHover } from '../interact/Interaction';
import { useAppStore } from '../state/store';
import { resetWarmCut } from './cutaway';
import { releaseLoaders } from './loader';
import { releaseGlowFalloff } from './prepareModule';

/**
 * Everything the scene keeps beyond React's unmount: R3F's cache of the parsed modules, the KTX2
 * transcoder's workers, the shared falloff texture, the store's state and the e2e's ready flag.
 * R3F's own unmount already disposes the renderer and forces its context loss.
 */
export function releaseGardenScene(): void {
  releaseLoaders();
  releaseGlowFalloff();
  resetWarmCut();
  resetHover();
  useAppStore.setState(useAppStore.getInitialState(), true);
  if (typeof window !== 'undefined') delete window.__sceneReady;
}
