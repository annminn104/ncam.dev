import { describe, expect, it } from 'vitest';
import { renderHeroSSR } from './ssr';

describe('renderHeroSSR', () => {
  it('renders the app shell with its css', async () => {
    const { html, css } = await renderHeroSSR({ assetBase: 'https://chess.example.dev/' });
    expect(html).toContain('Cultivation Chess');
    expect(css.length).toBeGreaterThan(0);
  });
  it('names the page for the host head', async () => {
    const { head } = await renderHeroSSR({});
    expect(head?.title).toBe('Cultivation Chess');
  });
});
