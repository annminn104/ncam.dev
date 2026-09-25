import { QueryObserver, skipToken } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_FILTERS } from '../routes';
import { createQueryClient, retryTransient, setCardsQuery, setQuery } from './queries';
import { TcgdexError, type SetDetail } from './tcgdex';

const URL = 'https://api.tcgdex.net/v2/en/cards/swsh3-136';

describe('retryTransient', () => {
  it('retries twice what may pass: no response at all, a 5xx, a 408, a 429', () => {
    const errors = [
      new TcgdexError('Could not reach TCGdex: Failed to fetch', URL),
      new TcgdexError('TCGdex responded 503', URL, 503),
      new TcgdexError('TCGdex responded 408', URL, 408),
      new TcgdexError('TCGdex responded 429', URL, 429),
    ];
    for (const error of errors) {
      expect(
        [0, 1, 2].map((failures) => retryTransient(failures, error)),
        error.message,
      ).toEqual([true, true, false]);
    }
  });

  it('never retries a 404 or another client error, which would fail the same way', () => {
    for (const status of [400, 403, 404, 410]) {
      expect(retryTransient(0, new TcgdexError(`TCGdex responded ${status}`, URL, status))).toBe(
        false,
      );
    }
  });
});

describe('createQueryClient', () => {
  async function attempts(error: TcgdexError, options?: { server?: boolean }): Promise<number> {
    const client = createQueryClient(options);
    const queries = client.getDefaultOptions().queries;
    client.setDefaultOptions({ queries: { ...queries, retryDelay: 0 } });
    let calls = 0;
    await client
      .fetchQuery({
        queryKey: ['probe'],
        queryFn: () => {
          calls += 1;
          throw error;
        },
      })
      .catch(() => undefined);
    client.clear();
    return calls;
  }

  it('asks once for a card TCGdex does not have, and three times for one it could not reach', async () => {
    expect(await attempts(new TcgdexError('TCGdex responded 404', URL, 404))).toBe(1);
    expect(await attempts(new TcgdexError('Could not reach TCGdex: Failed to fetch', URL))).toBe(3);
  });

  it('never retries on the server, where a failed prefetch is the client’s to fetch again', async () => {
    // A retry there only held the page back: about 3 s per failing endpoint.
    const unreachable = new TcgdexError('Could not reach TCGdex: Failed to fetch', URL);
    expect(await attempts(unreachable, { server: true })).toBe(1);
  });
});

describe('setCardsQuery', () => {
  const SET: SetDetail = {
    id: 'swsh3',
    name: 'Darkness Ablaze',
    cardCount: { official: 3, total: 3 },
    serie: { id: 'swsh', name: 'Sword & Shield' },
    cards: [1, 2, 3].map((n) => ({ id: `swsh3-${n}`, localId: String(n), name: `Card ${n}` })),
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** fetch, stubbed: every URL asked for, and a network failure for each. */
  function unreachable(): string[] {
    const asked: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        asked.push(String(url));
        throw new TypeError('Failed to fetch');
      }),
    );
    return asked;
  }

  it('waits for its set: without one it asks for nothing', () => {
    expect(setCardsQuery('swsh3', EMPTY_FILTERS, 2).queryFn).toBe(skipToken);
  });

  it('pages the set it is given, without asking TCGdex for it again', async () => {
    const asked = unreachable();
    const client = createQueryClient();
    const page = await client.fetchQuery(setCardsQuery('swsh3', EMPTY_FILTERS, 2, SET));
    expect(page.items.map((card) => card.id)).toEqual(['swsh3-1', 'swsh3-2']);
    expect(asked).toEqual([]);
    client.clear();
  });

  it('asks for a failing set three times in all, as the set page watches it', async () => {
    // SetView's two queries, as it builds them: the page's from the set's data.
    const asked = unreachable();
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } });
    const set = new QueryObserver(client, setQuery('swsh3'));
    const cards = new QueryObserver(client, setCardsQuery('swsh3', EMPTY_FILTERS, 2));
    const stop = [
      set.subscribe((result) =>
        cards.setOptions(setCardsQuery('swsh3', EMPTY_FILTERS, 2, result.data)),
      ),
      cards.subscribe(() => undefined),
    ];
    await vi.waitFor(() => expect(set.getCurrentResult().status).toBe('error'));
    // Room for any retry of the page's to run and ask again.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked.filter((url) => url.endsWith('/sets/swsh3'))).toHaveLength(3);
    expect(set.getCurrentResult().status).toBe('error');
    for (const unsubscribe of stop) unsubscribe();
    client.clear();
  });
});
