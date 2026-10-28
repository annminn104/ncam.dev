import { createRoot } from 'react-dom/client';
import { POSTER_SEARCH } from './capture';
import { remoteBase } from './lib/asset-url';
import { GardenScene } from './scene/GardenScene';
import css from './styles.css?inline';

const noop = () => {};
/** A failed capture must fail the script at once: rethrown, it reaches page.on('pageerror'). */
const fail = (error: Error) => {
  queueMicrotask(() => {
    throw error;
  });
};

/** Capture mode: the site route's scene alone, no UI; window.__sceneReady once it has settled. */
export function startCapture(el: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  createRoot(el).render(
    <div className="garden-home-root">
      <div className="gh-scene is-live">
        <GardenScene
          route="site"
          assetBase={remoteBase()}
          ui={false}
          search={POSTER_SEARCH}
          onReady={noop}
          onFail={fail}
        />
      </div>
    </div>,
  );
}
