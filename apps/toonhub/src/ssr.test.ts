import { describe, expect, it } from 'vitest';
import { toonHubConfig } from './data/toonhub';
import { renderHeroSSR } from './ssr';

const ORIGIN = 'https://toonhub.example';
const firstSrc = toonHubConfig.items[0]!.src;

describe('renderHeroSSR', () => {
  it('renders the hero from the options the host passes every remote', () => {
    // The route-aware contract (MountConfig) the portfolio host sends to each
    // remote's SSR entry: `config` carries the route, not TOONHUB's own data.
    const { html, css } = renderHeroSSR({ config: { route: '/' }, assetBase: ORIGIN });

    expect(html).toContain('data-toonhub-root');
    expect(html).toContain(`${ORIGIN}${firstSrc}`);
    expect(typeof css).toBe('string');
  });

  it("falls back to the contract's assetBase when no top-level one is given", () => {
    const { html } = renderHeroSSR({ config: { route: '/', assetBase: ORIGIN } });

    expect(html).toContain(`${ORIGIN}${firstSrc}`);
  });

  it('leaves root-relative asset paths alone without an asset base', () => {
    const { html } = renderHeroSSR();

    expect(html).toContain(`src="${firstSrc}"`);
  });
});
