import { describe, expect, it } from 'vitest';
import { toonHubConfig } from './data/toonhub';
import { FIGURINE_WIDTHS } from './figurines';
import { renderHeroSSR } from './ssr';

const ORIGIN = 'https://toonhub.example';
const firstImage = toonHubConfig.items[0]!.image;

describe('renderHeroSSR', () => {
  it('renders the hero from the options the host passes every remote', () => {
    // The route-aware contract (MountConfig) the portfolio host sends to each
    // remote's SSR entry: `config` carries the route, not TOONHUB's own data.
    const { html, css } = renderHeroSSR({ config: { route: '/' }, assetBase: ORIGIN });

    expect(html).toContain('data-toonhub-root');
    expect(html).toContain(`src="${ORIGIN}${firstImage}-960.webp"`);
    expect(html).toContain(`${ORIGIN}${firstImage}-480.webp 480w`);
    expect(typeof css).toBe('string');
  });

  it("falls back to the contract's assetBase when no top-level one is given", () => {
    const { html } = renderHeroSSR({ config: { route: '/', assetBase: ORIGIN } });

    expect(html).toContain(`src="${ORIGIN}${firstImage}-960.webp"`);
  });

  it('leaves root-relative asset paths alone without an asset base', () => {
    const { html } = renderHeroSSR();

    expect(html).toContain(`src="${firstImage}-960.webp"`);
  });

  it('offers every published width in AVIF and WebP, and fetches the centre figurine first', () => {
    const { html } = renderHeroSSR();
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    const sources = html.match(/<source [^>]*>/g) ?? [];

    expect(imgs).toHaveLength(toonHubConfig.items.length);
    expect(sources).toHaveLength(toonHubConfig.items.length);
    for (const w of FIGURINE_WIDTHS) {
      expect(sources[0]).toContain(`${firstImage}-${w}.avif ${w}w`);
      expect(imgs[0]).toContain(`${firstImage}-${w}.webp ${w}w`);
    }
    expect(imgs.filter((img) => img.includes('fetchpriority="high"'))).toHaveLength(1);
  });
});
