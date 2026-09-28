import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StageLoading, type StageLoadingProps } from './StageLoading';

const HOLODEX: StageLoadingProps['project'] = {
  name: 'Holodex',
  tagline: 'Pokémon TCG explorer',
  thumbnail: '/thumbnails/holodex.jpg',
};

const render = (props: StageLoadingProps) => renderToString(createElement(StageLoading, props));

describe('StageLoading', () => {
  it('announces the project over its blurred screenshot while the remote loads', () => {
    const html = render({ project: HOLODEX, done: false });
    expect(html).toMatch(/<div[^>]*class="stage__loading"[^>]*data-state="loading"/);
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"/);
    expect(html).toContain('Loading Holodex…');
    expect(html).toContain('Pokémon TCG explorer');
    // Decorative: the same screenshot is the page's og:image, not content.
    expect(html).toMatch(
      /<img[^>]*class="stage__loading-backdrop"[^>]*src="\/thumbnails\/holodex\.jpg"/,
    );
    expect(html).toMatch(/<img[^>]*alt=""/);
    expect(html).toMatch(/<span[^>]*class="stage__spinner"[^>]*aria-hidden="true"/);
  });

  it('stays in the DOM once the remote attaches, so it can fade out', () => {
    expect(render({ project: HOLODEX, done: true })).toMatch(/data-state="done"/);
  });

  it('keeps the name and tagline for a project without a screenshot', () => {
    const html = render({ project: { ...HOLODEX, thumbnail: undefined }, done: false });
    expect(html).not.toContain('<img');
    expect(html).toContain('Loading Holodex…');
  });

  it("lets the ellipsis replace a name's own full stop", () => {
    const html = render({ project: { ...HOLODEX, name: 'Viktor.' }, done: false });
    expect(html).toContain('Loading Viktor…');
    expect(html).not.toContain('Viktor.…');
  });
});
