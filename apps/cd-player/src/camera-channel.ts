/**
 * The line between the shell's view controls (the zoom buttons and the +, - and 0 keys) and the
 * lazily loaded scene's camera: the shell sends commands, the scene says whether the zoom stands
 * at either end. Three-free and outside src/scene/, so the shell never reaches the scene chunk
 * (src/ssr-graph.test.ts); App makes one per mount and hands it to the scene and the buttons, as it
 * does the bridge.
 */
export type CameraCommand = 'zoom-in' | 'zoom-out' | 'reset';

/** Whether the zoom stands at 1× (Zoom out does nothing) or at 3× (Zoom in does nothing). */
export interface ZoomLimits {
  atMin: boolean;
  atMax: boolean;
}

/** 1×: where every scene starts, and where the buttons stand until a scene says otherwise. */
export const AT_REST: ZoomLimits = { atMin: true, atMax: false };

export interface CameraChannel {
  /** A command for the scene's camera; while no scene runs, nothing hears it. */
  send(command: CameraCommand): void;
  /** The scene's camera listens. */
  onCommand(listener: (command: CameraCommand) => void): () => void;
  /** The limits the scene last said: one snapshot until they change (useSyncExternalStore). */
  getLimits(): ZoomLimits;
  /** The scene says where its zoom is going; subscribers hear only a change. */
  setLimits(limits: ZoomLimits): void;
  subscribe(listener: () => void): () => void;
}

export function createCameraChannel(): CameraChannel {
  let limits = AT_REST;
  const commandListeners = new Set<(command: CameraCommand) => void>();
  const limitListeners = new Set<() => void>();
  return {
    send: (command) => {
      for (const listener of commandListeners) listener(command);
    },
    onCommand: (listener) => {
      commandListeners.add(listener);
      return () => {
        commandListeners.delete(listener);
      };
    },
    getLimits: () => limits,
    setLimits: (next) => {
      if (next.atMin === limits.atMin && next.atMax === limits.atMax) return;
      limits = { atMin: next.atMin, atMax: next.atMax };
      for (const listener of limitListeners) listener();
    },
    subscribe: (listener) => {
      limitListeners.add(listener);
      return () => {
        limitListeners.delete(listener);
      };
    },
  };
}
