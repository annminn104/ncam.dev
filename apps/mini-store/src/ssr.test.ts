import { describe, expect, it } from 'vitest';
import { renderHeroSSR } from './ssr';

describe('renderHeroSSR', () => {
  it('renders the poster as the one high-priority image', async () => {
    const { html } = await renderHeroSSR();
    // renderToString keeps the JSX casing (`fetchPriority`); HTML attribute names are
    // case-insensitive, so the browser reads it as `fetchpriority`.
    const imgs = html.match(/<img\b[^>]*>/g) ?? [];
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toMatch(/fetchpriority="high"/i);
    expect(imgs[0]).toContain('landscape-1920.webp');
    expect(imgs[0]).toContain('width="2560"');
    expect(html).toContain('landscape-2560.avif 2560w');
    expect(html).toContain('portrait-750.avif 750w');
    expect(html).toContain('media="(max-aspect-ratio: 1/1)"');
  });

  it('renders the HUD, the help bar and the Enter button', async () => {
    const { html } = await renderHeroSSR();
    expect(html).toContain('A rainy night on the corner');
    expect(html).toContain('Click the glass door to open it (O)');
    expect(html).toContain('Enter the store');
  });

  it('leaves the engine and the settings out of the server markup', async () => {
    const { html } = await renderHeroSSR();
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('ms-scene');
    expect(html).not.toContain('ms-panel');
  });

  it('ships its css and names the page', async () => {
    const { html, css, head } = await renderHeroSSR({ assetBase: 'https://ignored.example.test/' });
    // the host's assetBase is TOONHUB's alone: this remote names its own origin
    expect(html).not.toContain('ignored.example.test');
    expect(css).toContain('.mini-store-root');
    expect(head?.title).toBe('Mini Store — a rainy night on the corner');
    expect(head?.description).toMatch(/WebGL2 diorama/);
  });
});
