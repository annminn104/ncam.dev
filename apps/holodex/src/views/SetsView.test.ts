import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SetLogo } from './SetsView';

const LOGO = 'https://assets.tcgdex.net/en/swsh/swsh3/logo';
const SYMBOL = 'https://assets.tcgdex.net/univ/swsh/swsh3/symbol';
const render = (set: Parameters<typeof SetLogo>[0]['set']) =>
  renderToString(createElement(SetLogo, { set }));

describe('SetLogo', () => {
  it('fades the logo in over a blurred placeholder', () => {
    const html = render({ id: 'swsh3', logo: LOGO, symbol: SYMBOL });
    expect(html).toMatch(new RegExp(`<img[^>]*src="${LOGO}.webp"`));
    expect(html).toMatch(/<span[^>]*data-placeholder="blur"[^>]*aria-hidden="true"/);
    expect(html).toContain('opacity-0');
  });

  it('shows the symbol for a set without a logo', () => {
    expect(render({ id: 'swsh3', symbol: SYMBOL })).toMatch(
      new RegExp(`<img[^>]*src="${SYMBOL}.webp"`),
    );
  });

  it('badges a set with neither by its id, in place of a blank', () => {
    const html = render({ id: 'swsh3' });
    expect(html).not.toContain('<img');
    expect(html).toMatch(/<span[^>]*data-fallback="badge"[^>]*>SWSH3<\/span>/);
  });
});
