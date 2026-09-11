import './fonts';
import * as hero from './modules/hero';
import * as stacks from './modules/stacks';
import * as experience from './modules/experience';
import * as projects from './modules/projects';
import * as blog from './modules/blog';
import * as contact from './modules/contact';

// Standalone dev page: mount every section in page order, the way the host
// does, but without the host shell (nav, manifest rail, background tween).
const app = document.getElementById('app');
if (app) {
  app.className = 'profile-standalone';
  const modules: { mount(target: HTMLElement): () => void }[] = [
    hero,
    stacks,
    experience,
    projects,
    blog,
    contact,
  ];
  for (const section of modules) {
    const slot = document.createElement('div');
    slot.className = 'mf-slot';
    app.appendChild(slot);
    section.mount(slot);
  }
}
