import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { formatRoute } from '../routes';
import { renderView } from '../views/render-view.test-util';
import { HOME, NAV, Shell } from './Shell';

/** The Shell alone, at `route`, around an empty page. */
const renderShell = (route: string) => renderView(createElement(Shell, null, null), route);

/** Every <button> in the header: its attributes and its text. */
function buttons(html: string) {
  const header = /<header\b[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
  return [...header.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, inner]) => ({
    attrs,
    text: inner.replace(/<[^>]*>/g, ''),
  }));
}

/** The tab text marked as the current page. */
const current = (html: string) =>
  buttons(html).flatMap(({ attrs, text }) => (attrs.includes('aria-current="page"') ? [text] : []));

describe('Shell', () => {
  it('opens on the effects page, the default', () => {
    expect(formatRoute(HOME)).toBe('/');
    expect(NAV.find(({ label }) => label === 'Effects')?.route).toEqual(HOME);
    expect(formatRoute(NAV.find(({ label }) => label === 'Sets')?.route ?? HOME)).toBe('/sets');
  });

  it('makes the Holodex logo a button, like the tabs beside it', () => {
    const logo = buttons(renderShell('/')).find(({ text }) => text === 'Holodex');
    expect(logo?.attrs).toContain('type="button"');
  });

  it('marks Effects current on the default page and every effects URL, and Sets on its own', () => {
    for (const route of ['/', '/effects', '/effects/v-max?card=swsh3-2']) {
      expect(current(renderShell(route)), route).toEqual(['Effects']);
    }
    for (const route of ['/sets', '/sets/swsh3']) {
      expect(current(renderShell(route)), route).toEqual(['Sets']);
    }
  });
});
