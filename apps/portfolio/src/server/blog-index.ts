import { fetchArticleIndex, type BlogPostSummary } from '@ncam/cms';
import { createLogger } from '@ncam/logger';
import { getCmsEnv } from './cms-env';

const log = createLogger({ scope: 'portfolio' });

/**
 * Budget for the whole index, every page of it. Crawlers wait longer than
 * visitors, but a serverless function does not (10 s on Vercel Hobby), and a
 * CMS that is waking from sleep takes a minute however long we wait.
 */
const INDEX_TIMEOUT_MS = 4_000;

/**
 * Every published post, for the files crawlers read (sitemap, feed, llms.txt),
 * or null when the CMS did not answer in time: the caller then serves what it
 * knows without the CMS and caches that briefly. Server-only: call it from a
 * server-route handler, never from a loader.
 */
export async function getBlogIndex(file: string): Promise<BlogPostSummary[] | null> {
  const { apiBase } = getCmsEnv();
  try {
    return await fetchArticleIndex(apiBase, { signal: AbortSignal.timeout(INDEX_TIMEOUT_MS) });
  } catch (error) {
    log.warn('cms.index-unavailable', {
      file,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
