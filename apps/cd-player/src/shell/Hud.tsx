import { useSyncExternalStore } from 'react';
import type { CameraChannel } from '../camera-channel';

/**
 * One help line under the player. It fades out while the view is zoomed in, where its words would
 * lie over the magnified player, and comes back at 1×. The server and a hydration's first render
 * are at 1× (the channel starts there), so it paints plain, as it always has.
 */
export function Hud({ camera }: { camera: CameraChannel }) {
  const { atMin } = useSyncExternalStore(camera.subscribe, camera.getLimits, camera.getLimits);
  return (
    <p className={atMin ? 'cdp-hud' : 'cdp-hud is-zoomed'}>
      <kbd>Space</kbd> play or pause · <kbd>N</kbd> next · <kbd>P</kbd> previous · drag to look
      around · scroll or pinch to zoom
    </p>
  );
}
