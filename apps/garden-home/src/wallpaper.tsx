import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { remoteBase } from './lib/asset-url';
import { GardenScene } from './scene/GardenScene';
import { Poster } from './shell/Poster';
import css from './styles.css?inline';

const noop = () => {};

/** The Plash wallpaper (standalone /wallpaper): the scene at once, no input, the poster if it fails. */
function Wallpaper() {
  const [failed, setFailed] = useState(false);
  const onFail = useCallback((error: Error) => {
    console.error('[garden-home] the wallpaper could not start', error);
    setFailed(true);
  }, []);
  return (
    <div className="garden-home-root">
      {failed ? (
        <Poster />
      ) : (
        <div className="gh-scene is-live">
          <GardenScene
            route="wallpaper"
            assetBase={remoteBase()}
            ui={false}
            search={location.search}
            onReady={noop}
            onFail={onFail}
          />
        </div>
      )}
    </div>
  );
}

export function mountWallpaper(el: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  createRoot(el).render(<Wallpaper />);
}
