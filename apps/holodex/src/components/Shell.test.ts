import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { formatRoute } from '../routes';
import { renderView } from '../views/render-view.test-util';
import { HOME, NAV, Shell } from './Shell';

/** The Shell alone, at `route`, around an empty page. */
const renderShell = (route: string) => renderView(createElement(Shell, null, null), route);

/**
 * Every <button> in the header: its attributes, its markup and its text, the
 * runs between its tags joined. Only read, never rendered, so it takes the
 * text as a reader sees it rather than stripping tags out of the markup,
 * which CodeQL rightly flags wherever the result is trusted as safe HTML.
 */
function buttons(html: string) {
  const header = /<header\b[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
  return [...header.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, inner]) => ({
    attrs,
    inner,
    text: inner.split(/<[^>]*>/).join(''),
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

  it('shows a phone the tabs as icons, each still named', () => {
    // The labels made the nav 512px wide at 375px: every page scrolled
    // sideways and Effects, the default page, sat off the screen.
    const tabs = buttons(renderShell('/')).filter(({ text }) => text !== 'Holodex');
    expect(tabs.map(({ text }) => text)).toEqual(NAV.map(({ label }) => label));
    for (const [index, { attrs, inner }] of tabs.entries()) {
      const { label } = NAV[index];
      expect(attrs, label).toContain(`aria-label="${label}"`);
      expect(attrs, label).toContain(`title="${label}"`);
      expect(inner, label).toContain(`<span class="hidden sm:inline">${label}</span>`);
    }
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
