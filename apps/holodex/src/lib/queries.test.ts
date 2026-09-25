import { describe, expect, it } from 'vitest';
import { createQueryClient, retryTransient } from './queries';
import { TcgdexError } from './tcgdex';

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
  async function attempts(error: TcgdexError): Promise<number> {
    const client = createQueryClient();
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
});
