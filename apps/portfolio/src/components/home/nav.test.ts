import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeNav } from './nav';

const render = (active: string) => renderToString(createElement(HomeNav, { active }));

describe('HomeNav mobile drawer', () => {
  it('opens a modal dialog from a menu button that names it', () => {
    const html = render('top');
    const button = html.match(/<button[^>]*class="hnav__menu"[^>]*>/)?.[0] ?? '';
    expect(button).toContain('aria-label="Open menu"');
    expect(button).toContain('aria-haspopup="dialog"');
    expect(button).toContain('aria-expanded="false"');
    const controls = button.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();

    const dialog = html.match(/<dialog[^>]*>/)?.[0] ?? '';
    expect(dialog).toContain(`id="${controls}"`);
    expect(dialog).toContain('class="hnav-drawer"');
    // Closed until showModal(): the server never renders it open.
    expect(dialog).not.toMatch(/\sopen[\s=>]/);
    const title = dialog.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(html).toMatch(new RegExp(`<p id="${title}" class="hnav-drawer__title">Sections</p>`));
  });

  it('renders the dialog beside the header, never inside it', () => {
    // .hnav's backdrop-filter would contain a fixed drawer animating out of the top layer.
    const html = render('top');
    expect(html.indexOf('<dialog')).toBeGreaterThan(html.indexOf('</header>'));
  });

  it('lists every section but the intro, numbered, staggered and marked when current', () => {
    const html = render('projects');
    const drawer = html.slice(html.indexOf('<dialog'));
    const items = [...drawer.matchAll(/<li style="--i:(\d+)"><a href="#([a-z]+)"([^>]*)>/g)];
    expect(items.map(([, i, id]) => [Number(i), id])).toEqual([
      [0, 'stacks'],
      [1, 'experience'],
      [2, 'projects'],
      [3, 'blog'],
      [4, 'contact'],
    ]);
    expect(items[2][3]).toContain('aria-current="location"');
    expect(items[0][3]).not.toContain('aria-current');
    expect(drawer).toContain('<span class="hnav-drawer__index" aria-hidden="true">03</span>');
  });
});
