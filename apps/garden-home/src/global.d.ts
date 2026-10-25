import type { ToggleState } from './interact/toggles';
import type { CutLevel, CutMode } from './scene/cutaway';

declare global {
  interface Window {
    /** Set by ReadyProbe once every slot settled and a few frames rendered (e2e + poster). */
    __sceneReady?: boolean;
    /**
     * Set by OrbitRig on the site route, for the e2e: the live camera (to check it stays out of the island and the
     * house), its orbit target, the dollhouse cut it calls for, the house focus the cut measures from and the point a
     * drag turns round (null round the target); the point of the scene under a client (x, y) (null over the sky) and the
     * client pixels a world point shows at (null off screen).
     */
    __camera?: {
      (): {
        position: [number, number, number];
        target: [number, number, number];
        distance: number;
        polar: number;
        cut: CutLevel;
        /** whether the camera is near the house: the interior's small things show (orbit.ts nearFor) */
        near: boolean;
        /** what the floor buttons picked */
        mode: CutMode;
        /** whether a floor button's ease of the camera is under way */
        easing: boolean;
        house: [number, number, number] | null;
        pivot: [number, number, number] | null;
      };
      pick(x: number, y: number): [number, number, number] | null;
      project(point: readonly number[]): { x: number; y: number } | null;
    };
    /**
     * Set by InteractionLayer on the site route, for the e2e: where a glTF node shows on the canvas (client pixels of
     * its bounding box's centre, null off screen), the click toggles, hover, where the koi were last fed and how many
     * clicks played a one-shot group's clip (the dog), and a group toggled as a click on one of its items would
     * (lights:garden, whose items are a pixel or two across).
     */
    __interact?: {
      at(name: string): { x: number; y: number } | null;
      state(): {
        toggles: Record<string, ToggleState>;
        hover: { group: string; label: string; node: string } | null;
        feed: { point: [number, number, number]; at: number } | null;
        plays: Record<string, number>;
      };
      toggle(group: string): void;
    };
  }
}

export {};
