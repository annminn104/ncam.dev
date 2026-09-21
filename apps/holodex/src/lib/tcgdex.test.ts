import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, buildCardUrl, getCard, getSet, getSets, TcgdexError } from './tcgdex';

function mockFetch(handler: (url: string) => unknown, status = 200) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = handler(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildCardUrl', () => {
  it('sends pagination with a literal colon and nothing else by default', () => {
    const url = buildCardUrl({ page: 1, perPage: 24 });
    expect(url.startsWith(`${API_BASE}/cards?`)).toBe(true);
    const query = new URL(url).searchParams;
    expect(query.get('pagination:page')).toBe('1');
    expect(query.get('pagination:itemsPerPage')).toBe('24');
    expect([...query.keys()].sort()).toEqual(['pagination:itemsPerPage', 'pagination:page']);
  });

  it('maps setId onto the API set.id param', () => {
    const query = new URL(buildCardUrl({ setId: 'swsh3' })).searchParams;
    expect(query.get('set.id')).toBe('swsh3');
  });

  it('passes through the whitelisted filters', () => {
    const query = new URL(
      buildCardUrl({ name: 'char', types: 'Fire', rarity: 'Special illustration rare' }),
    ).searchParams;
    expect(query.get('name')).toBe('char');
    expect(query.get('types')).toBe('Fire');
    expect(query.get('rarity')).toBe('Special illustration rare');
  });

  it('drops empty and whitespace-only filters, because the API returns [] for them', () => {
    const query = new URL(buildCardUrl({ name: '   ', types: '', rarity: undefined })).searchParams;
    expect(query.has('name')).toBe(false);
    expect(query.has('types')).toBe(false);
    expect(query.has('rarity')).toBe(false);
  });

  it('never emits a param outside the whitelist', () => {
    const query = new URL(
      buildCardUrl({ nonsense: 'zzz' } as unknown as Parameters<typeof buildCardUrl>[0]),
    ).searchParams;
    expect(query.has('nonsense')).toBe(false);
  });

  it('clamps a nonsensical page or perPage to 1', () => {
    const query = new URL(buildCardUrl({ page: 0, perPage: -5 })).searchParams;
    expect(query.get('pagination:page')).toBe('1');
    expect(query.get('pagination:itemsPerPage')).toBe('1');
  });
});

describe('endpoints', () => {
  it('getSets returns the parsed array', async () => {
    mockFetch(() => [
      { id: 'swsh3', name: 'Darkness Ablaze', cardCount: { total: 201, official: 189 } },
    ]);
    await expect(getSets()).resolves.toHaveLength(1);
  });

  it('getSet requests the exact set endpoint, not a ?set.id= query', async () => {
    const fetchMock = mockFetch(() => ({
      id: 'swsh3',
      name: 'Darkness Ablaze',
      cards: [],
      cardCount: { total: 0, official: 0 },
      serie: { id: 'swsh', name: 'Sword & Shield' },
    }));
    await getSet('swsh3');
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/sets/swsh3`);
  });

  it('url-encodes a card id that needs it', async () => {
    const card = {
      id: 'x',
      name: 'x',
      localId: 'x',
      category: 'Pokemon',
      set: { id: 'x', name: 'x', cardCount: { total: 1, official: 1 } },
    };
    const fetchMock = mockFetch(() => card);
    // encodeURIComponent leaves "!" alone, so use a character it does escape.
    await getCard('sv1-a b');
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/cards/sv1-a%20b`);
  });

  it('throws TcgdexError with the status on a non-200', async () => {
    mockFetch(() => ({}), 503);
    await expect(getSet('swsh3')).rejects.toBeInstanceOf(TcgdexError);
    await expect(getSet('swsh3')).rejects.toMatchObject({ status: 503 });
  });

  it('throws TcgdexError when an array endpoint returns something else', async () => {
    mockFetch(() => ({ not: 'an array' }));
    await expect(getSets()).rejects.toBeInstanceOf(TcgdexError);
  });

  it('throws TcgdexError when the network rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    await expect(getSets()).rejects.toBeInstanceOf(TcgdexError);
  });
});
