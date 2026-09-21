import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_BASE,
  buildCardUrl,
  getCard,
  getSet,
  getSetCards,
  getSets,
  searchCards,
  SET_QUERY_PAGE_SIZE,
  TcgdexError,
} from './tcgdex';

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

  it('throws TcgdexError when getSet receives a body without a string id', async () => {
    mockFetch(() => ({ not: 'a set' }));
    await expect(getSet('swsh3')).rejects.toBeInstanceOf(TcgdexError);
    await expect(getSet('swsh3')).rejects.toMatchObject({ url: `${API_BASE}/sets/swsh3` });
  });

  it('throws TcgdexError when getCard receives a body without a string id', async () => {
    mockFetch(() => ({ not: 'a card' }));
    await expect(getCard('swsh3-1')).rejects.toBeInstanceOf(TcgdexError);
  });

  it('throws TcgdexError when the response body cannot be parsed as JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      })),
    );
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

const brief = (id: string) => ({ id, localId: id.split('-')[1] ?? '1', name: id });

describe('searchCards (global, probe pagination)', () => {
  it('asks for one extra row and reports hasNext when it arrives', async () => {
    const fetchMock = mockFetch(() => Array.from({ length: 25 }, (_, i) => brief(`sv1-${i}`)));
    const page = await searchCards({ name: 'char', page: 1, perPage: 24 });
    expect(
      new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('pagination:itemsPerPage'),
    ).toBe('25');
    expect(page.items).toHaveLength(24);
    expect(page.hasNext).toBe(true);
    expect(page.total).toBeUndefined();
  });

  it('reports no next page when the probe row does not arrive', async () => {
    mockFetch(() => Array.from({ length: 24 }, (_, i) => brief(`sv1-${i}`)));
    const page = await searchCards({ name: 'char', page: 1, perPage: 24 });
    expect(page.items).toHaveLength(24);
    expect(page.hasNext).toBe(false);
  });

  it('handles the empty last page the API returns for an overflowing page number', async () => {
    mockFetch(() => []);
    const page = await searchCards({ name: 'char', page: 99999, perPage: 24 });
    expect(page).toMatchObject({ items: [], hasNext: false, page: 99999 });
  });
});

describe('getSetCards (exact membership)', () => {
  const setBody = (ids: string[]) => ({
    id: 'swsh1',
    name: 'Sword & Shield',
    cardCount: { total: ids.length, official: ids.length },
    serie: { id: 'swsh', name: 'Sword & Shield' },
    cards: ids.map(brief),
  });

  it('pages the set endpoint in memory when there is no filter, and never calls /cards', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `swsh1-${i + 1}`);
    const fetchMock = mockFetch(() => setBody(ids));
    const page = await getSetCards('swsh1', {}, 2, 20);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/cards'))).toBe(true);
    expect(page.items.map((c) => c.id)).toEqual(ids.slice(20, 40));
    expect(page).toMatchObject({ page: 2, total: 50, hasNext: true, truncated: false });
  });

  it('reports the last page correctly', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `swsh1-${i + 1}`);
    mockFetch(() => setBody(ids));
    const page = await getSetCards('swsh1', {}, 3, 20);
    expect(page.items).toHaveLength(10);
    expect(page.hasNext).toBe(false);
  });

  it('drops the prefix bleed when a filter is active', async () => {
    const ids = ['swsh1-1', 'swsh1-2', 'swsh1-3'];
    mockFetch((url) =>
      url.includes('/cards')
        ? [brief('swsh1-1'), brief('swsh10-4'), brief('swsh12-9'), brief('swsh1-3')]
        : setBody(ids),
    );
    const page = await getSetCards('swsh1', { types: 'Fire' }, 1, 20);
    expect(page.items.map((c) => c.id)).toEqual(['swsh1-1', 'swsh1-3']);
    expect(page.total).toBe(2);
  });

  it('follows a capped response onto the next page', async () => {
    const ids = Array.from({ length: 4 }, (_, i) => `swsh1-${i + 1}`);
    const pages = [
      [
        ...Array.from({ length: SET_QUERY_PAGE_SIZE - 2 }, (_, i) => brief(`swsh10-${i}`)),
        brief('swsh1-1'),
        brief('swsh1-2'),
      ],
      [brief('swsh1-3')],
    ];
    let call = 0;
    mockFetch((url) => (url.includes('/cards') ? pages[call++] : setBody(ids)));
    const page = await getSetCards('swsh1', { types: 'Fire' }, 1, 20);
    expect(page.items.map((c) => c.id)).toEqual(['swsh1-1', 'swsh1-2', 'swsh1-3']);
    expect(page.truncated).toBe(false);
  });

  it('stops at the request cap and says so instead of lying', async () => {
    const ids = ['swsh1-1'];
    mockFetch((url) =>
      url.includes('/cards')
        ? Array.from({ length: SET_QUERY_PAGE_SIZE }, (_, i) => brief(`swsh10-${i}`))
        : setBody(ids),
    );
    const page = await getSetCards('swsh1', { types: 'Fire' }, 1, 20);
    expect(page.truncated).toBe(true);
  });

  it('keeps the set ordering rather than the API ordering', async () => {
    const ids = ['swsh1-1', 'swsh1-2', 'swsh1-3'];
    mockFetch((url) =>
      url.includes('/cards') ? [brief('swsh1-3'), brief('swsh1-1')] : setBody(ids),
    );
    const page = await getSetCards('swsh1', { name: 'x' }, 1, 20);
    expect(page.items.map((c) => c.id)).toEqual(['swsh1-1', 'swsh1-3']);
  });
});
