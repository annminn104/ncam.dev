import { mapArticle, mapIndexEntry } from './map';
import { buildBySlugQuery, buildIndexQuery, buildListQuery } from './query';
import type {
  BlogPost,
  BlogPostSummary,
  StrapiArticle,
  StrapiArticleIndexEntry,
  StrapiList,
} from './types';

/** A non-2xx answer from the CMS. `status` is the HTTP status code. */
export class CmsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CmsError';
  }
}

export interface CmsOptions {
  /** Injectable for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
  signal?: AbortSignal;
  /** Per-request timeout, default 5 s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/** Pages `fetchArticleIndex` reads at most: 1,000 posts, and a bound on a CMS that misreports. */
const MAX_INDEX_PAGES = 10;

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * Drop every trailing `/` with a linear scan (a `/\/+$/` regex backtracks on long
 * runs). Shared with the host's `STRAPI_*` env parsing so both trim the same way.
 */
export function trimTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47 /* '/' */) end -= 1;
  return url.slice(0, end);
}

/** `${origin}/api/articles?${query}` — tolerates trailing slashes on the base. */
export function articlesUrl(baseUrl: string, query: string): string {
  return `${trimTrailingSlashes(baseUrl)}/api/articles?${query}`;
}

async function getJson<T>(url: string, options: CmsOptions): Promise<T> {
  const doFetch = options.fetch ?? fetch;
  const response = await doFetch(url, {
    headers: { accept: 'application/json' },
    signal: withTimeout(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new CmsError(response.status, `CMS request failed with ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

/** Every published article as cards, newest first (≤ 100). */
export async function fetchArticles(
  baseUrl: string,
  mediaBase: string,
  options: CmsOptions = {},
): Promise<BlogPost[]> {
  const list = await getJson<StrapiList<StrapiArticle>>(
    articlesUrl(baseUrl, buildListQuery()),
    options,
  );
  return list.data.map((raw) => mapArticle(raw, { mediaBase }));
}

/**
 * Every published article as a summary, newest first — all of them, page after
 * page, unlike the ≤ 100 cards of `fetchArticles`: a sitemap or a feed that
 * silently drops the oldest posts is wrong. Timeouts apply per page; pass a
 * `signal` to bound the whole walk.
 */
export async function fetchArticleIndex(
  baseUrl: string,
  options: CmsOptions = {},
): Promise<BlogPostSummary[]> {
  const posts: BlogPostSummary[] = [];
  for (let page = 1; page <= MAX_INDEX_PAGES; page += 1) {
    const list = await getJson<StrapiList<StrapiArticleIndexEntry>>(
      articlesUrl(baseUrl, buildIndexQuery(page)),
      options,
    );
    posts.push(...list.data.map(mapIndexEntry));
    // No page count (Strapi's `withCount` off) reads as a single page.
    if (list.data.length === 0 || page >= (list.meta?.pagination?.pageCount ?? page)) break;
  }
  return posts;
}

/** One published article with its body, or null when the slug is unknown. */
export async function fetchArticleBySlug(
  baseUrl: string,
  slug: string,
  mediaBase: string,
  options: CmsOptions = {},
): Promise<BlogPost | null> {
  const list = await getJson<StrapiList<StrapiArticle>>(
    articlesUrl(baseUrl, buildBySlugQuery(slug)),
    options,
  );
  const raw = list.data[0];
  return raw ? mapArticle(raw, { mediaBase }) : null;
}
