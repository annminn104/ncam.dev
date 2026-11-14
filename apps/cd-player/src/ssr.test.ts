import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { PRESETS } from './presets';
import { clearInitialCache } from './server/initial';
import { ARTIST, page, PLAYLIST, TRACK } from './spotify/fixtures';
import { renderHeroSSR } from './ssr';
import { parseState, serialiseState } from './ssr-state';

function stubSpotify(answer?: () => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (answer) return answer();
      const url = String(input);
      if (url.includes('/embed/playlist/')) return new Response(page(PLAYLIST));
      if (url.includes('/embed/track/')) return new Response(page(TRACK));
      if (url.includes('/embed/artist/')) return new Response(page(ARTIST));
      return new Response('', { status: 404 });
    }),
  );
}

const rawStateOf = (html: string) =>
  /<script type="application\/json" id="cdp-state">([\s\S]*?)<\/script>/.exec(html)?.[1];
const stateOf = (html: string) => parseState(rawStateOf(html));

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  // A render that misses its data logs it on purpose: keep that out of the test output.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  vi.unstubAllGlobals();
  clearInitialCache();
});

describe('renderHeroSSR', () => {
  it('renders a playlist route with its tracks, its state, its fonts and its own head', async () => {
    stubSpotify();
    const result = await renderHeroSSR({ config: { route: `/playlist/${PLAYLIST.id}` } });
    expect(result.html).toContain('Housewife');
    expect(result.head).toEqual({
      title: 'Top 50 - Global',
      description: expect.stringMatching(
        /^Top 50 - Global by Spotify: a 2-track playlist on a 3D turntable or CD player\. /,
      ),
    });
    expect(stateOf(result.html)?.firstArtist?.name).toBe('Tate McRae');
    // ./hydrate renders the script back from the state it parsed: the very same text, so the
    // element in the markup has its counterpart in the tree.
    const raw = rawStateOf(result.html);
    expect(serialiseState(parseState(raw))).toBe(raw);
    expect(result.css).toContain('.cdp-root');
    expect(result.css).toContain('@font-face');
    // Only a miss is logged: a render whose three fetches arrive says nothing.
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders home with the default playlist and leaves the head to the host', async () => {
    stubSpotify();
    const result = await renderHeroSSR({ config: { route: '/' } });
    expect(result.html).toContain('Top 50 - Global');
    expect(result.head).toBeUndefined();
  });

  it("renders the loader in the scene's place, and no picture or canvas", async () => {
    stubSpotify();
    const { html, css } = await renderHeroSSR({ config: { route: '/' } });
    const loader = /<div class="cdp-loader">[\s\S]*?<\/div>/.exec(html)?.[0] ?? '';
    expect(loader).toMatch(/<svg class="cdp-loader__disc"[^>]*aria-hidden="true"/);
    expect(loader).toContain('<p class="cdp-loader__line">Loading the player</p>');
    // Nothing on the first screen is a picture of the scene, and nothing fetches with a high
    // priority: the only pictures are the presets' small covers, lazy, none of them in the stage.
    expect(html).not.toContain('<picture');
    const images = html.match(/<img [^>]*>/g) ?? [];
    expect(images).toHaveLength(PRESETS.length);
    for (const img of images) {
      expect(img).toMatch(/^<img class="cdp-preset__cover" [^>]*loading="lazy"/);
    }
    const stage = html.slice(
      html.indexOf('<div class="cdp-stage">'),
      html.indexOf('<div class="cdp-side">'),
    );
    expect(stage).toContain('<div class="cdp-loader">');
    expect(stage).not.toContain('<img');
    expect(html).not.toContain('cdp-poster');
    expect(html).not.toMatch(/fetchpriority/i);
    // "Open the player" waits for the page to settle: the server shows the loader alone.
    expect(html).not.toContain('Open the player');
    expect(html).not.toContain('<canvas');
    // The stylesheet the host inlines spins the disc from the first paint.
    expect(css).toMatch(/\.cdp-loader__disc\s*\{[^}]*animation:\s*cdp-spin/);
  });

  it('still renders, without a head, when Spotify fails or hangs', async () => {
    stubSpotify(async () => new Response('', { status: 503 }));
    const failed = await renderHeroSSR({ config: { route: `/playlist/${PLAYLIST.id}` } });
    expect(failed.head).toBeUndefined();
    expect(failed.html).toContain('Loading');

    clearInitialCache();
    stubSpotify(() => new Promise<Response>(() => {}));
    const started = Date.now();
    const hung = await renderHeroSSR();
    expect(Date.now() - started).toBeLessThan(2500);
    expect(hung.html).toContain('Loading');
  });
});
