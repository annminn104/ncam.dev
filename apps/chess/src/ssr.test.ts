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
  it('server-renders the lobby with every arena and the start button', async () => {
    const { html } = await renderHeroSSR({ assetBase: 'https://chess.example.dev/' });
    for (const name of ['Jade Cloud Peak', 'Blood Moon Abyss', 'Lotus Moon Lake']) {
      expect(html).toContain(name);
    }
    expect(html).toContain('Enter battle');
    expect(html).toContain('https://chess.example.dev/arenas/cloud-peak-640.avif');
    // renderToString keeps the JSX casing (`fetchPriority`); HTML attribute names are
    // case-insensitive, so the browser reads it as `fetchpriority`.
    expect(html).toMatch(/fetchpriority="high"/i);
  });
  it('gives only the first arena preview the high-priority LCP treatment', async () => {
    const { html } = await renderHeroSSR({ assetBase: 'https://chess.example.dev/' });
    // React also hoists a preload <link> carrying the same attribute, so look at the <img> tags.
    const imgs = html.match(/<img\b[^>]*>/g) ?? [];
    expect(imgs).toHaveLength(6); // three arenas, three piece sets
    expect(imgs[0]).toMatch(/fetchpriority="high"/i);
    expect(imgs[0]).toContain('loading="eager"');
    for (const tag of imgs.slice(1)) {
      expect(tag).not.toMatch(/fetchpriority="high"/i);
      expect(tag).toContain('loading="lazy"');
    }
  });
  it('never marks a preview as failed in the server markup', async () => {
    // ArenaCard marks a failed preview only after mount, so the first client render matches.
    const { html } = await renderHeroSSR({ assetBase: 'https://chess.example.dev/' });
    expect(html).not.toContain('data-failed');
  });
  it('renders the piece-set picker with every ready set and its preview', async () => {
    const { html } = await renderHeroSSR({ assetBase: 'https://chess.example.dev/' });
    expect(html).toContain('Piece set');
    expect(html).toContain('Cultivation Treasures');
    expect(html).toContain('Holy Order');
    expect(html).toContain('https://chess.example.dev/presets/holy-order-640.avif');
    expect(html).toContain('https://chess.example.dev/presets/dark-court-640.avif');
    expect(html).toContain('https://chess.example.dev/presets/treasures-640.avif');
  });
  it('falls back to root-relative asset URLs when the module has no origin', async () => {
    // Under test import.meta.url is a file: URL, so there is no origin to derive a base from.
    const { html } = await renderHeroSSR({});
    expect(html).toContain('src="/arenas/cloud-peak-640.avif"');
  });
});
