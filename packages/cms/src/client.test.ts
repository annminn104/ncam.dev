import { describe, expect, it, vi } from 'vitest';
import {
  CmsError,
  articlesUrl,
  fetchArticleBySlug,
  fetchArticleIndex,
  fetchArticles,
  trimTrailingSlashes,
} from './client';
import type { StrapiArticle, StrapiArticleIndexEntry } from './types';

const BASE = 'http://cms.test:1337/';
const MEDIA = 'http://media.test';

const article: StrapiArticle = {
  documentId: 'doc-1',
  title: 'Hello',
  slug: 'hello',
  excerpt: 'Hi.',
  readingTime: 3,
  publishedAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
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

describe('fetchArticleIndex', () => {
  const entry = (slug: string): StrapiArticleIndexEntry => ({
    slug,
    title: slug,
    excerpt: '',
    publishedAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    seo: { canonicalURL: null, metaRobots: 'noindex' },
  });

  /** A CMS that holds `pageCount` pages of one entry each (`pageCount` null: not reported). */
  function pagedFetch(pageCount: number | null) {
    return vi.fn(async (input: RequestInfo | URL) => {
      const page = Number(new URL(String(input)).searchParams.get('pagination[page]'));
      const pagination = pageCount === null ? {} : { page, pageSize: 100, pageCount, total: 0 };
      return new Response(JSON.stringify({ data: [entry(`post-${page}`)], meta: { pagination } }));
    }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  }

  it('reads every page, in order, and maps the entries', async () => {
    const fetch = pagedFetch(3);
    const posts = await fetchArticleIndex(BASE, { fetch });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(posts.map((post) => post.slug)).toEqual(['post-1', 'post-2', 'post-3']);
    expect(posts[0]).toEqual({
      ...entry('post-1'),
      seo: { canonicalUrl: null, robots: 'noindex' },
    });
    const [url] = fetch.mock.calls[0] as [string];
    expect(url.startsWith('http://cms.test:1337/api/articles?')).toBe(true);
    expect(url).toContain('fields%5B4%5D=updatedAt');
    expect(url).toContain('populate%5Bseo%5D%5Bfields%5D%5B1%5D=metaRobots');
  });

  it('stops after one page when Strapi reports no page count', async () => {
    const fetch = pagedFetch(null);
    expect(await fetchArticleIndex(BASE, { fetch })).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never reads more than ten pages', async () => {
    const fetch = pagedFetch(1_000);
    expect(await fetchArticleIndex(BASE, { fetch })).toHaveLength(10);
    expect(fetch).toHaveBeenCalledTimes(10);
  });

  it('stops at an empty page and throws CmsError on a non-2xx one', async () => {
    const empty = fakeFetch(200, { data: [], meta: { pagination: { pageCount: 5 } } });
    expect(await fetchArticleIndex(BASE, { fetch: empty })).toEqual([]);
    expect(empty).toHaveBeenCalledTimes(1);
    await expect(
      fetchArticleIndex(BASE, { fetch: fakeFetch(502, { error: 'bad gateway' }) }),
    ).rejects.toMatchObject({ status: 502 });
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
