import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearInitialCache } from './server/initial';
import { ARTIST, page, PLAYLIST, TRACK } from './spotify/fixtures';
import { renderHeroSSR } from './ssr';
import { parseState } from './ssr-state';

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

const stateOf = (html: string) =>
  parseState(
    /<script type="application\/json" id="cdp-state">([\s\S]*?)<\/script>/.exec(html)?.[1],
  );

afterEach(() => {
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
      description: expect.stringMatching(/Top 50 - Global by Spotify: a 2-track playlist/),
    });
    expect(stateOf(result.html)?.firstArtist?.name).toBe('Tate McRae');
    expect(result.css).toContain('.cdp-root');
    expect(result.css).toContain('@font-face');
  });

  it('renders home with the default playlist and leaves the head to the host', async () => {
    stubSpotify();
    const result = await renderHeroSSR({ config: { route: '/' } });
    expect(result.html).toContain('Top 50 - Global');
    expect(result.head).toBeUndefined();
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
