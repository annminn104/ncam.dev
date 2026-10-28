import { create } from 'zustand';
import { nextToggle, type ToggleState } from '../interact/toggles';
import type { CutLevel, CutMode } from '../scene/cutaway';
import type { Hotspot } from '../scene/extras';

/** The house item under the pointer on the site route, and where the pointer is (client pixels). */
export interface Hover {
  group: string;
  label: string;
  /** glTF node name of the item itself: a group can span several (a room's lamps). */
  node: string;
  x: number;
  y: number;
}

export interface AppState {
  nightFactor: number;
  settled: Record<string, true>;
  hotspots: Record<string, Hotspot[]>;
  /** The dollhouse cut the site camera calls for (OrbitRig); the wallpaper never leaves 'none'. */
  cutLevel: CutLevel;
  /**
   * Whether the site camera is near the house (OrbitRig, orbit.ts nearFor): the interior's small things show only then
   * (cutaway.ts applyCut). The wallpaper's camera never is.
   */
  near: boolean;
  /** What the floor buttons picked (ui/FloorSelector): the cut by distance ('auto'), or a level held. */
  cutMode: CutMode;
  /**
   * How many times a floor button was pressed, the one already on too: OrbitRig moves the camera for each press (a
   * press on "Basement" while it is on eases a camera that left the house back to it), which cutMode alone cannot tell.
   */
  floorPress: number;
  /** Click toggles per interact group (AGENTS.md, Controls); a group missing here is on 'auto'. */
  toggles: Record<string, ToggleState>;
  hover: Hover | null;
  /** Where (world space) and when (the shared clock) a click last fed the koi; null until then. */
  feed: { point: [number, number, number]; at: number } | null;
  /** How many clicks played each one-shot group's clip (the dog's act_dog_happy) so far; a group missing here, none. */
  plays: Record<string, number>;
  setNightFactor: (value: number) => void;
  markSlotSettled: (slotId: string) => void;
  registerHotspots: (slotId: string, hotspots: Hotspot[]) => void;
  setCutLevel: (level: CutLevel) => void;
  setNear: (near: boolean) => void;
  /** A floor button pressed: picks `mode` and counts the press (floorPress). */
  setCutMode: (mode: CutMode) => void;
  /** A click on `group`: nextToggle from its state, given whether it shows its on look now. */
  toggle: (group: string, litNow: boolean) => void;
  setHover: (hover: Hover | null) => void;
  /** A click on the pond: the koi gather where it fell (systems/koi.ts feedKoi). */
  feedKoi: (point: [number, number, number], at: number) => void;
  /**
   * A click on a one-shot group (the dog): its clip plays once more, if it is not still playing (ModuleInstance,
   * interact/effects playOnce).
   */
  play: (group: string) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  nightFactor: 0,
  settled: {},
  hotspots: {},
  cutLevel: 'none',
  near: false,
  cutMode: 'auto',
  floorPress: 0,
  toggles: {},
  hover: null,
  feed: null,
  plays: {},
  setNightFactor: (nightFactor) => set({ nightFactor }),
  // Idempotent so StrictMode double effects and retries cannot over-count.
  markSlotSettled: (slotId) =>
    set((s) => (s.settled[slotId] ? s : { settled: { ...s.settled, [slotId]: true } })),
  registerHotspots: (slotId, hotspots) =>
    set((s) => ({ hotspots: { ...s.hotspots, [slotId]: hotspots } })),
  setCutLevel: (cutLevel) => set({ cutLevel }),
  setNear: (near) => set({ near }),
  setCutMode: (cutMode) => set((s) => ({ cutMode, floorPress: s.floorPress + 1 })),
  toggle: (group, litNow) =>
    set((s) => ({
      toggles: { ...s.toggles, [group]: nextToggle(s.toggles[group] ?? 'auto', litNow) },
    })),
  setHover: (hover) => set({ hover }),
  feedKoi: (point, at) => set({ feed: { point, at } }),
  play: (group) => set((s) => ({ plays: { ...s.plays, [group]: (s.plays[group] ?? 0) + 1 } })),
}));

/** Slots that finished loading or failed. */
export const settledCount = (state: AppState): number => Object.keys(state.settled).length;
