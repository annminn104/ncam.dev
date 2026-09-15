import { describe, expect, it, vi } from 'vitest';
import {
  CmsError,
  articlesUrl,
  fetchArticleBySlug,
  fetchArticles,
  trimTrailingSlashes,
} from './client';
import type { StrapiArticle } from './types';

const BASE = 'http://cms.test:1337/';
const MEDIA = 'http://media.test';

const article: StrapiArticle = {
  documentId: 'doc-1',
  title: 'Hello',
  slug: 'hello',
  excerpt: 'Hi.',
  readingTime: 3,
  publishedAt: '2026-09-15T00:00:00.000Z',
  cover: null,
  tags: [{ name: 'React', slug: 'react' }],
  seo: null,
};

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal?.aborted) throw init.signal.reason;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('articlesUrl', () => {
  it('joins base (with or without trailing slash) and query', () => {
    expect(articlesUrl('http://a/', 'x=1')).toBe('http://a/api/articles?x=1');
    expect(articlesUrl('http://a', 'x=1')).toBe('http://a/api/articles?x=1');
  });

  it('trims any run of trailing slashes in linear time', () => {
    expect(articlesUrl(`http://a${'/'.repeat(10_000)}`, 'x=1')).toBe('http://a/api/articles?x=1');
    expect(articlesUrl('/', 'x=1')).toBe('/api/articles?x=1');
  });
});

describe('trimTrailingSlashes', () => {
  it('removes only trailing slashes and leaves everything else alone', () => {
    expect(trimTrailingSlashes('http://a///')).toBe('http://a');
    expect(trimTrailingSlashes('http://a/b/')).toBe('http://a/b');
    expect(trimTrailingSlashes('http://a')).toBe('http://a');
    expect(trimTrailingSlashes('///')).toBe('');
    expect(trimTrailingSlashes('')).toBe('');
  });
});

describe('fetchArticles', () => {
  it('requests the list query with a JSON accept header and maps the result', async () => {
    const fetch = fakeFetch(200, { data: [article], meta: { pagination: {} } });
    const posts = await fetchArticles(BASE, MEDIA, { fetch });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith('http://cms.test:1337/api/articles?')).toBe(true);
    expect(url).toContain('sort=publishedAt%3Adesc');
    expect((init.headers as Record<string, string>).accept).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe('hello');
    expect(posts[0].readingLabel).toBe('3 min');
  });

  it('throws CmsError with the status on a non-2xx response', async () => {
    const fetch = fakeFetch(503, { error: 'down' });
    await expect(fetchArticles(BASE, MEDIA, { fetch })).rejects.toBeInstanceOf(CmsError);
    await expect(fetchArticles(BASE, MEDIA, { fetch })).rejects.toMatchObject({ status: 503 });
  });

  it('rejects with the abort reason when the caller signal is already aborted', async () => {
    const fetch = fakeFetch(200, { data: [], meta: { pagination: {} } });
    await expect(
      fetchArticles(BASE, MEDIA, { fetch, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal?.aborted).toBe(true);
  });
});

describe('fetchArticleBySlug', () => {
  it('returns the mapped first match', async () => {
    const fetch = fakeFetch(200, { data: [article], meta: { pagination: {} } });
    const post = await fetchArticleBySlug(BASE, 'hello', MEDIA, { fetch });
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('filters%5Bslug%5D%5B%24eq%5D=hello');
    expect(post?.title).toBe('Hello');
  });

  it('returns null when nothing matches', async () => {
    const fetch = fakeFetch(200, { data: [], meta: { pagination: {} } });
    expect(await fetchArticleBySlug(BASE, 'nope', MEDIA, { fetch })).toBeNull();
  });
});
