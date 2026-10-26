import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AnimationMixer } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applyParty,
  applyToggles,
  driveClip,
  oneShot,
  playOnce,
  prepareInteractions,
} from '../interact/effects';
import { useInteractionHandlers } from '../interact/Interaction';
import { filterRaycasts } from '../interact/pick';
import { isOn, playsOnce } from '../interact/toggles';
import { useAppStore } from '../state/store';
import { feedKoi } from '../systems/koi';
import { globalUniforms } from '../systems/uniforms';
import {
  applyCut,
  bury,
  cutOnlyByButton,
  findOpenings,
  leaveOutDetails,
  moduleCut,
  prepareCutaway,
  showThroughOpenings,
  warmCut,
} from './cutaway';
import { extractHotspots } from './extras';
import { useModuleGLTF } from './loader';
import { prepareModule } from './prepareModule';

/** The longest the basement's shaders wait for an idle moment to compile their cut look (ms). */
const WARM_TIMEOUT_MS = 3000;

interface Props {
  slotId: string;
  /** The module id of the slot: the dollhouse cut cuts each module at its own levels (cutaway.ts moduleCut). */
  module?: string;
  src: string;
  /**
   * The house, the interior and the basement on the site route: they clip to the dollhouse cut the camera or a floor
   * button calls for (AGENTS.md, Controls). Elsewhere, and on the wallpaper, what the basement tags buried never shows.
   */
  cutaway?: boolean;
  /** World height of the slot, which the cut heights are measured from. */
  baseY?: number;
  /** Site route: pointer events find the item under the pointer and a click toggles its group (AGENTS.md, Controls). */
  interactive?: boolean;
}

/**
 * One slot: clone the cached GLB, wire systems, loop ambient_* clips, follow the click toggles and play a one-shot
 * group's clip for each click on it.
 */
export function ModuleInstance({
  slotId,
  module = '',
  src,
  cutaway = false,
  baseY = 0,
  interactive = false,
}: Props) {
  const gltf = useModuleGLTF(src);
  const { root, prepared, model, hotspots, cut, openings } = useMemo(() => {
    const clone = cloneSkinned(gltf.scene);
    const prepared = prepareModule(clone);
    if (interactive) filterRaycasts(clone); // the pointer reaches only what the user sees, not what the cut removes
    // the basement is cut only by a floor button: whole, its shaders go without the plane (cutaway.ts unclipWhole); the
    // house and the interior, which a zoom cuts too, keep theirs
    const cut = cutaway ? prepareCutaway(clone, { unclipWhole: cutOnlyByButton(module) }) : null;
    if (!cut) {
      bury(clone); // the basement's rooms under the plinth: only a cut down to them shows them
      leaveOutDetails(clone); // the interior's small things: only the site camera near the house shows them
    }
    return {
      root: clone,
      prepared,
      model: prepareInteractions(clone, prepared),
      hotspots: extractHotspots(clone),
      cut,
      // the basement under the lawn: drawn only where its light well or its stair hole shows it (showThroughOpenings)
      openings: findOpenings(clone),
    };
  }, [gltf, cutaway, interactive, module]);
  const mixer = useMemo(() => new AnimationMixer(root), [root]);
  const nightFactor = useAppStore((s) => s.nightFactor);
  const toggles = useAppStore((s) => s.toggles);
  const registerHotspots = useAppStore((s) => s.registerHotspots);
  const markSlotSettled = useAppStore((s) => s.markSlotSettled);
  const cutLevel = useAppStore((s) => s.cutLevel);
  const near = useAppStore((s) => s.near);
  const feed = useAppStore((s) => s.feed);
  const plays = useAppStore((s) => s.plays);
  const handlers = useInteractionHandlers(interactive);
  // The one-shot actions of the groups a click plays a clip of (the dog), and the plays they have answered: a mount
  // takes the count it finds, so a remount does not replay an old click.
  const oneShots = useMemo(() => {
    const found = new Map<string, ReturnType<typeof oneShot>>();
    for (const { group, kind, clip } of model.clips) {
      const animation = gltf.animations.find((candidate) => candidate.name === clip);
      if (playsOnce(kind) && animation) found.set(group, oneShot(mixer, animation));
    }
    return found;
  }, [gltf, mixer, model]);
  const played = useRef<Record<string, number>>({ ...useAppStore.getState().plays });

  useEffect(() => {
    for (const clip of gltf.animations) {
      if (clip.name.startsWith('ambient_')) mixer.clipAction(clip).play();
    }
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    };
  }, [gltf, mixer, root]);

  useEffect(() => {
    registerHotspots(slotId, hotspots);
    markSlotSettled(slotId);
  }, [slotId, hotspots, registerHotspots, markSlotSettled]);

  // Night lights follow the night factor, except groups a click switched on or off; the wallpaper has no toggles.
  useEffect(() => {
    applyToggles(model, prepared, toggles, nightFactor);
    for (const { group, kind, clip } of model.clips) {
      const animation = gltf.animations.find((candidate) => candidate.name === clip);
      if (animation && !playsOnce(kind))
        driveClip(mixer.clipAction(animation), isOn(kind, toggles[group], nightFactor));
    }
  }, [gltf, mixer, model, prepared, toggles, nightFactor]);

  // A click on the dog: its happy clip once more, from its start, unless it is still playing (playOnce).
  useEffect(() => {
    for (const [group, action] of oneShots) {
      const count = plays[group] ?? 0;
      if (count > (played.current[group] ?? 0)) playOnce(action);
      played.current[group] = count;
    }
  }, [oneShots, plays]);

  // the cut, and the interior's small things while the camera is near the house (whole or cut)
  useEffect(() => {
    if (cut) applyCut(cut, moduleCut(module, cutLevel), baseY, cutLevel, near);
  }, [cut, module, cutLevel, baseY, near]);

  // The basement, which only "Basement" cuts: its cut look's shaders compile while the site is idle after it loads (warmCut),
  // not all in the frame of the first "Basement"; and again once the night lights come on at dusk or go off at dawn (they are
  // visible while the night factor is over 0, interact/effects applyToggles), since the light count is part of every
  // program.
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const nightLit = nightFactor > 0;
  useEffect(() => {
    if (!cut?.unclipWhole) return;
    const warm = () => warmCut(cut, 'basement', () => gl.compileAsync(root, camera, scene));
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(warm, { timeout: WARM_TIMEOUT_MS });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(warm, WARM_TIMEOUT_MS);
    return () => window.clearTimeout(handle);
  }, [cut, gl, root, camera, scene, nightLit]);

  // A click fed the koi: the pond's fish gather where it fell (only a module with koi has any to feed).
  useEffect(() => {
    if (feed) feedKoi(prepared, root, feed);
  }, [feed, prepared, root]);

  // the karaoke's party mode: its LEDs turn through the hues on the shared clock while it is on (only the basement has
  // any); and what the basement shows through its openings from where the camera is now (OrbitRig moved it already)
  useFrame((_, delta) => {
    mixer.update(delta);
    if (openings)
      showThroughOpenings(
        openings,
        camera.position,
        useAppStore.getState().cutLevel === 'basement',
      );
    if (model.party.length) {
      const { toggles: now, nightFactor: night } = useAppStore.getState();
      applyParty(model, isOn('party', now.party, night), globalUniforms.uTime.value);
    }
  });
  return <primitive object={root} {...handlers} />;
}
