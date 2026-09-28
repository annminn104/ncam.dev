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

  it('names the page after the card TCGdex returned, for the host head', async () => {
    const charizard = {
      id: 'base1-4',
      localId: '4',
      name: 'Charizard',
      category: 'Pokemon',
      rarity: 'Rare Holo',
      set: { id: 'base1', name: 'Base Set', cardCount: { total: 102, official: 102 } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => charizard }) as Response),
    );
    const { head } = await renderHeroSSR({ config: { route: '/card/base1-4' } });
    expect(head?.title).toBe('Charizard — Base Set #4');
    expect(head?.description).toContain('card 4 of Base Set (Rare Holo)');
  });

  it('sends no head for a card TCGdex could not serve, so the host keeps its own', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const result = await renderHeroSSR({ config: { route: '/card/swsh3-136' } });
    expect(result).not.toHaveProperty('head');
  });

  it('names a page that needs no data without asking TCGdex', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { head } = await renderHeroSSR({ config: { route: '/collection' } });
    expect(head?.title).toBe('Your collection');
    expect(fetch).not.toHaveBeenCalled();
  });
});
