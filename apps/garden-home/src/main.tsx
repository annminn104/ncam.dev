import { createRoot } from 'react-dom/client';
import { parseCapture } from './capture';
import { startCapture } from './capture-view';
import { remoteBase } from './lib/asset-url';
import { GardenScene } from './scene/GardenScene';
import './styles.css';

const noop = () => {};
const fail = (error: Error) => console.error('[garden-home]', error);
const el = document.getElementById('app')!;

if (parseCapture(location.search)) {
  startCapture(el);
} else {
  const route = location.pathname.endsWith('/wallpaper') ? 'wallpaper' : 'site';
  createRoot(el, {
    // Error boundaries already handle module failures; keep them out of console.error.
    onCaughtError: (error) => console.warn('[react] caught', error),
  }).render(
    <GardenScene
      route={route}
      assetBase={remoteBase()}
      ui
      search={location.search}
      onReady={noop}
      onFail={fail}
    />,
  );
}
