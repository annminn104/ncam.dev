import { describe, expect, it } from 'vitest';
import { renderHeroSSR } from './ssr';

describe('renderHeroSSR', () => {
  it('renders the poster as the one high-priority image', async () => {
    const { html } = await renderHeroSSR();
    // renderToString keeps the JSX casing (`fetchPriority`); the browser reads it case-insensitively.
    const imgs = html.match(/<img\b[^>]*>/g) ?? [];
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toMatch(/fetchpriority="high"/i);
    expect(imgs[0]).toContain('landscape-1920.webp');
    expect(imgs[0]).toContain('width="2560"');
    expect(html).toContain('landscape-2560.avif 2560w');
    expect(html).toContain('portrait-750.avif 750w');
    expect(html).toContain('media="(max-aspect-ratio: 1/1)"');
  });

  it('renders the title, the help line and the Enter button', async () => {
    const { html } = await renderHeroSSR();
    expect(html).toContain('A glass villa on a garden island');
    expect(html).toContain('Zoom in to cut the house away');
    expect(html).toContain('Enter the garden');
  });

  it('leaves the scene out of the server markup', async () => {
    const { html } = await renderHeroSSR();
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('gh-scene');
    expect(html).not.toContain('floors');
  });

  it('ships its css and names the page', async () => {
    const { html, css, head } = await renderHeroSSR({ assetBase: 'https://ignored.example.test/' });
    // the host's assetBase is TOONHUB's alone: this remote names its own origin
    expect(html).not.toContain('ignored.example.test');
    expect(css).toContain('.garden-home-root');
    expect(css).not.toMatch(/(^|[\s,}])(html|body|:root)\s*[,{]/);
    expect(head?.title).toBe('Garden Home — a glass villa on a garden island');
    expect(head?.description).toMatch(/cut the house away floor by floor/);
  });
});
