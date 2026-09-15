import { mapArticle } from './map';
import { buildBySlugQuery, buildListQuery } from './query';
import type { BlogPost, StrapiArticle, StrapiList } from './types';

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

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Drop every trailing `/` with a linear scan (a `/\/+$/` regex backtracks on long runs). */
function trimTrailingSlashes(url: string): string {
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
