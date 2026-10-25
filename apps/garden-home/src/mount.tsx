import { createRoot } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import { remoteBase } from './lib/asset-url';
import { releaseAll } from './release';
import { GardenScene } from './scene/GardenScene';
import './styles.css';

const noop = () => {};
const fail = (error: Error) => console.error('[garden-home]', error);

/** Federated entry until the shell lands (Task 5): the scene at once, on the site route. */
export function mount(target: HTMLElement, config?: MountConfig): MountHandle {
  const root = createRoot(target);
  root.render(
    <GardenScene
      route="site"
      assetBase={remoteBase(config?.assetBase)}
      ui
      search={location.search}
      onReady={noop}
      onFail={fail}
    />,
  );
  return () => {
    root.unmount();
    releaseAll();
  };
}

export default mount;
