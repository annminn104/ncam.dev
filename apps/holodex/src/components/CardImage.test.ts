import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardImage } from './CardImage';
import { rememberShown } from './use-image-fallback';

const BASE = 'https://assets.tcgdex.net/en/swsh/swsh3/136';
const render = (props: Parameters<typeof CardImage>[0]) =>
  renderToString(createElement(CardImage, props));

/** Every <img> tag in the markup. */
const images = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag);

describe('CardImage', () => {
  it('holds a sharp image back behind its own low-res art, blurred, while it loads', () => {
    const [placeholder, art, ...rest] = images(
      render({ base: BASE, name: 'Furret', quality: 'high' }),
    );
    expect(rest).toEqual([]);
    expect(placeholder).toContain('data-placeholder="lqip"');
    expect(placeholder).toContain(`src="${BASE}/low.webp"`);
    expect(placeholder).toContain('aria-hidden="true"');
    expect(placeholder).toContain('alt=""');
    expect(placeholder).toMatch(/\bblur-/);
    expect(art).toContain(`src="${BASE}/high.webp"`);
    expect(art).toContain('alt="Furret"');
    expect(art).toContain('opacity-0');
  });

  it('holds a grid image back behind a blurred card silhouette, having no smaller art', () => {
    const html = render({ base: BASE, name: 'Furret' });
    const [art, ...rest] = images(html);
    expect(rest).toEqual([]);
    expect(art).toContain(`src="${BASE}/low.webp"`);
    expect(art).toContain('opacity-0');
    expect(html).toMatch(/<span[^>]*data-placeholder="silhouette"[^>]*aria-hidden="true"/);
  });

  it('shows a card that has no art as unavailable, naming it', () => {
    const html = render({ name: 'Furret' });
    expect(images(html)).toEqual([]);
    expect(html).toContain('data-fallback="unavailable"');
    expect(html).toContain('Image unavailable');
    expect(html).toContain('Furret');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Furret: image unavailable"');
  });

  it('keeps an unavailable card out of the accessible tree when something else names it', () => {
    const html = render({ name: 'Furret', decorative: true });
    expect(html).toMatch(
      /<span[^>]*aria-hidden="true"[^>]*data-fallback="unavailable"|<span[^>]*data-fallback="unavailable"[^>]*aria-hidden="true"/,
    );
    expect(html).not.toContain('role="img"');
  });

  it('shows art this page has shown before at once, sharp, with no placeholder or fade', () => {
    // A tile going live mounts a new image of the same art: it must not
    // blink through a placeholder it had already left behind.
    const base = 'https://assets.tcgdex.net/en/swsh/swsh3/2';
    rememberShown(`${base}/low.webp`);
    const html = render({ base, name: 'Butterfree VMAX' });
    const [art] = images(html);
    expect(art).toContain('opacity-100');
    expect(html).toMatch(/<span[^>]*data-placeholder="silhouette"[^>]*class="[^"]*opacity-0/);
    expect(html).not.toContain('animate-pulse');
  });
});
