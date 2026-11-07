import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../presets';
import { textOf } from '../testing/markup';
import { Presets } from './Presets';

type Props = Parameters<typeof Presets>[0];

const render = (over: Partial<Props> = {}) =>
  renderToString(createElement(Presets, { current: null, busy: null, onPick: () => {}, ...over }));

/** The text a button holds, tags left out: what a screen reader names it by. */
const buttonTexts = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(([, inside]) => textOf(inside));

describe('Presets', () => {
  it('lists every preset as a button, under its labelled heading', () => {
    const html = render();
    expect(html).toContain('<section class="cdp-presets" aria-labelledby="cdp-presets-title">');
    expect(html).toContain('<p class="cdp-eyebrow" id="cdp-presets-title">Popular on Spotify</p>');
    expect(html.match(/<button type="button" class="cdp-preset"/g)).toHaveLength(PRESETS.length);
  });

  it('names each button by its playlist and its tag, a space between them', () => {
    const texts = buttonTexts(render());
    expect(texts).toHaveLength(PRESETS.length);
    expect(texts[0]).toBe('Top 50 - Global Global chart');
    PRESETS.forEach((preset, i) => expect(texts[i]).toBe(`${preset.name} ${preset.tag}`));
  });

  it('shows each cover small, lazy and silent: never the page’s largest paint', () => {
    const covers = render().match(/<img [^>]*>/g) ?? [];
    expect(covers).toHaveLength(PRESETS.length);
    covers.forEach((img, i) => {
      expect(img).toContain('class="cdp-preset__cover"');
      expect(img).toContain(`src="${PRESETS[i].cover}"`);
      expect(img).toContain('alt=""');
      expect(img).toMatch(/width="48" height="48"/);
      expect(img).toContain('loading="lazy"');
      expect(img).toContain('decoding="async"');
      expect(img).not.toMatch(/fetchpriority/i);
    });
  });

  it('marks the collection in view, and none for one that is not a preset', () => {
    const html = render({ current: PRESETS[2].ref });
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<button type="button" class="cdp-preset is-current" aria-current="true">(?:(?!<\/button>)[\s\S])*RapCaviar/,
    );
    const album = { type: 'album', id: '4yP0hdKOZPNshxUOjY0cZj' } as const;
    expect(render({ current: album })).not.toContain('aria-current');
    expect(render({ current: { ...PRESETS[2].ref, type: 'album' } })).not.toContain('aria-current');
  });

  it('says "Loading…" in place of the tag of the one being loaded, and marks it busy', () => {
    const html = render({ busy: PRESETS[1].ref });
    const texts = buttonTexts(html);
    expect(texts[1]).toBe(`${PRESETS[1].name} Loading…`);
    expect(texts[0]).toBe('Top 50 - Global Global chart');
    expect(html.match(/aria-busy="true"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<button type="button" class="cdp-preset" aria-busy="true">(?:(?!<\/button>)[\s\S])*Today/,
    );
  });
});
