import { mount } from './mount';
import { standaloneView } from './routes';

const el = document.getElementById('app');
if (el) {
  const view = standaloneView(location.pathname, location.search);
  if (view === 'capture') void import('./capture-view').then((m) => m.startCapture(el));
  else if (view === 'wallpaper') void import('./wallpaper').then((m) => m.mountWallpaper(el));
  else mount(el);
}
