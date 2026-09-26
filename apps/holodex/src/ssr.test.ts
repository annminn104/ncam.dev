import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHeroSSR } from './ssr';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('renderHeroSSR', () => {
  it('renders at once when TCGdex cannot be reached, having asked it once', async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        asked.push(String(url));
        throw new TypeError('Failed to fetch');
      }),
    );
    const started = Date.now();
    const { html } = await renderHeroSSR({ config: { route: '/card/swsh3-136' } });
    expect(asked).toEqual(['https://api.tcgdex.net/v2/en/cards/swsh3-136']);
    // Retries wait 1 s, then 2 s, before the render could begin.
    expect(Date.now() - started).toBeLessThan(900);
    expect(html).toContain('swsh3-136');
  });
});
