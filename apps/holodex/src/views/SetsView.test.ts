import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SetLogo } from './SetsView';

const LOGO = 'https://assets.tcgdex.net/en/swsh/swsh3/logo';
const SYMBOL = 'https://assets.tcgdex.net/univ/swsh/swsh3/symbol';
const render = (set: Parameters<typeof SetLogo>[0]['set']) =>
  renderToString(createElement(SetLogo, { set }));
/** An `<img>` whose src is exactly `url`, its `.`s matched literally. */
const imgWithSrc = (url: string) =>
  new RegExp(`<img[^>]*src="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);

describe('SetLogo', () => {
  it('puts the logo over a blurred placeholder, shown as it arrives in the server’s markup', () => {
    const html = render({ id: 'swsh3', logo: LOGO, symbol: SYMBOL });
    expect(html).toMatch(imgWithSrc(`${LOGO}.webp`));
    expect(html).toMatch(/<span[^>]*data-placeholder="blur"[^>]*aria-hidden="true"/);
    // It fades in only once mounted, and only if still loading then.
    expect(html).not.toContain('opacity-0');
  });

  it('shows the symbol for a set without a logo', () => {
    expect(render({ id: 'swsh3', symbol: SYMBOL })).toMatch(imgWithSrc(`${SYMBOL}.webp`));
  });

  it('badges a set with neither by its id, in place of a blank', () => {
    const html = render({ id: 'swsh3' });
    expect(html).not.toContain('<img');
    expect(html).toMatch(/<span[^>]*data-fallback="badge"[^>]*>SWSH3<\/span>/);
  });
});
