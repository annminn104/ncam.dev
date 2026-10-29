import type { MountHandle } from '@ncam/mf-remote';
import { captureShape } from './capture';
import { mount } from './mount';

const el = document.getElementById('app');
if (el && captureShape(window.location.search)) {
  // scripts/capture-poster.mjs: the scene alone, never part of the federated entries.
  void import('./scene/CaptureScene').then((module) => module.mountCapture(el));
} else if (el) {
  const currentRoute = () => `${window.location.pathname}${window.location.search}`;
  const handle: MountHandle = mount(el, {
    route: currentRoute(),
    onNavigate: (to) => {
      window.history.pushState(null, '', to);
      handle.update?.(to);
    },
  });
  window.addEventListener('popstate', () => handle.update?.(currentRoute()));
}
