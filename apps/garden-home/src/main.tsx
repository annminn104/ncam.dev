import { createRoot } from 'react-dom/client';
import { remoteBase } from './lib/asset-url';
import { GardenScene } from './scene/GardenScene';
import './styles.css';

const noop = () => {};
const fail = (error: Error) => console.error('[garden-home]', error);
const route = location.pathname.endsWith('/wallpaper') ? 'wallpaper' : 'site';

createRoot(document.getElementById('app')!, {
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
