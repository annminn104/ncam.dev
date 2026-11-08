import { useSyncExternalStore } from 'react';
import type { CameraChannel, CameraCommand } from '../camera-channel';
import { MinusIcon, PlusIcon, ResetViewIcon } from './Icons';

/**
 * The view's buttons at the stage's bottom-right corner, once the scene is live: Zoom out, Zoom in
 * (a ×1.25 step toward the view's centre each) and Reset view (back to 1× and the orbit
 * recentred), sent to the scene's camera through `camera`. Zoom out at 1× and Zoom in at 3× are
 * aria-disabled rather than disabled: a keyboard that presses Zoom out down to 1× keeps its focus
 * there, and the press does nothing.
 */
export function ZoomControls({ camera }: { camera: CameraChannel }) {
  const { atMin, atMax } = useSyncExternalStore(
    camera.subscribe,
    camera.getLimits,
    camera.getLimits,
  );
  const press = (command: CameraCommand, spent: boolean) => {
    if (!spent) camera.send(command);
  };
  return (
    <div className="cdp-zoom" role="group" aria-label="View">
      <button
        type="button"
        className="cdp-key"
        aria-label="Zoom out"
        aria-disabled={atMin}
        onClick={() => press('zoom-out', atMin)}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        className="cdp-key"
        aria-label="Zoom in"
        aria-disabled={atMax}
        onClick={() => press('zoom-in', atMax)}
      >
        <PlusIcon />
      </button>
      <button
        type="button"
        className="cdp-key"
        aria-label="Reset view"
        onClick={() => press('reset', false)}
      >
        <ResetViewIcon />
      </button>
    </div>
  );
}
