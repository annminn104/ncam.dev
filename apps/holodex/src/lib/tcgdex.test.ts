import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_BASE,
  buildCardUrl,
  getCard,
  getSet,
  getSets,
  requestSignal,
  searchCards,
  selectSetCards,
  SET_QUERY_PAGE_SIZE,
  TcgdexError,
  type SetDetail,
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

  it('passes name and types through as typed, still substring matches', () => {
    const query = new URL(
      buildCardUrl({ name: 'char', types: 'Fire', rarity: 'Special illustration rare' }),
    ).searchParams;
    expect(query.get('name')).toBe('char');
    expect(query.get('types')).toBe('Fire');
  });

  it('asks for a rarity exactly, since the API matches a bare value as a substring', () => {
    // Bare, ?rarity=Common also returns every Uncommon: 10,790 cards, of which
    // eq:Common is the 5,873 Commons (TCGdex, 2026-09-25).
    const query = new URL(buildCardUrl({ rarity: 'Common' })).searchParams;
    expect(query.get('rarity')).toBe('eq:Common');
  });

  it('trims a rarity before it asks for it exactly', () => {
    const query = new URL(buildCardUrl({ rarity: '  Illustration rare ' })).searchParams;
    expect(query.get('rarity')).toBe('eq:Illustration rare');
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

describe('selectSetCards (exact membership)', () => {
  // The set document now arrives from the caller's cache, never from a fetch
  // inside this function: that is the whole point of the restructure.
  const setBody = (ids: string[]): SetDetail => ({
    id: 'swsh1',
    name: 'Sword & Shield',
    cardCount: { total: ids.length, official: ids.length },
    serie: { id: 'swsh', name: 'Sword & Shield' },
    cards: ids.map(brief),
  });

  it('pages the cached set in memory when there is no filter, fetching nothing', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `swsh1-${i + 1}`);
    const fetchMock = mockFetch(() => []);
    const page = await selectSetCards(setBody(ids), {}, 2, 20);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(page.items.map((c) => c.id)).toEqual(ids.slice(20, 40));
    expect(page).toMatchObject({ page: 2, total: 50, hasNext: true, truncated: false });
  });

  it('reports the last page correctly', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `swsh1-${i + 1}`);
    mockFetch(() => []);
    const page = await selectSetCards(setBody(ids), {}, 3, 20);
    expect(page.items).toHaveLength(10);
    expect(page.hasNext).toBe(false);
  });

  it('drops the prefix bleed when a filter is active', async () => {
    const ids = ['swsh1-1', 'swsh1-2', 'swsh1-3'];
    mockFetch(() => [brief('swsh1-1'), brief('swsh10-4'), brief('swsh12-9'), brief('swsh1-3')]);
    const page = await selectSetCards(setBody(ids), { types: 'Fire' }, 1, 20);
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
    mockFetch(() => pages[call++]);
    const page = await selectSetCards(setBody(ids), { types: 'Fire' }, 1, 20);
    expect(page.items.map((c) => c.id)).toEqual(['swsh1-1', 'swsh1-2', 'swsh1-3']);
    expect(page.truncated).toBe(false);
  });

  it('stops at the request cap and says so instead of lying', async () => {
    const ids = ['swsh1-1'];
    mockFetch(() => Array.from({ length: SET_QUERY_PAGE_SIZE }, (_, i) => brief(`swsh10-${i}`)));
    const page = await selectSetCards(setBody(ids), { types: 'Fire' }, 1, 20);
    expect(page.truncated).toBe(true);
  });

  it('keeps the set ordering rather than the API ordering', async () => {
    const ids = ['swsh1-1', 'swsh1-2', 'swsh1-3'];
    mockFetch(() => [brief('swsh1-3'), brief('swsh1-1')]);
    const page = await selectSetCards(setBody(ids), { name: 'x' }, 1, 20);
    expect(page.items.map((c) => c.id)).toEqual(['swsh1-1', 'swsh1-3']);
  });
});

describe('requestSignal', () => {
  const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('installs the timeout when no caller signal is passed', async () => {
    const signal = requestSignal(undefined, 5);
    expect(signal.aborted).toBe(false);
    await settle(30);
    expect(signal.aborted).toBe(true);
  });

  it('still installs the timeout when a caller signal is passed', async () => {
    // The regression: every query factory passes react-query's signal, so
    // `opts.signal ?? timeout` meant no request ever had a deadline.
    const controller = new AbortController();
    const signal = requestSignal(controller.signal, 5);
    expect(signal.aborted).toBe(false);
    await settle(30);
    expect(signal.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });

  it('aborts as soon as the caller aborts, without waiting for the timeout', () => {
    const controller = new AbortController();
    const signal = requestSignal(controller.signal, 60_000);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it('is what the endpoints hand to fetch, even when the caller passes one', async () => {
    let installed: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        installed = init?.signal ?? undefined;
        return { ok: true, status: 200, json: async () => [] } as Response;
      }),
    );
    const controller = new AbortController();
    await getSets({ signal: controller.signal });
    // Not the caller's signal verbatim — that is precisely how the deadline
    // went missing — but still driven by it.
    expect(installed).toBeDefined();
    expect(installed).not.toBe(controller.signal);
    controller.abort();
    expect(installed?.aborted).toBe(true);
  });
});
