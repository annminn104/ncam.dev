import type { MountHandle } from '@ncam/mf-remote';
import { mount } from './mount';

const el = document.getElementById('app');
if (el) {
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
