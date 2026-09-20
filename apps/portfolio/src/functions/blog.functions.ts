import { createServerFn } from '@tanstack/react-start';
import { fetchArticleBySlug, fetchArticles, type BlogPost } from '@ncam/cms';
import { createLogger } from '@ncam/logger';
import { getCmsEnv } from '../server/cms-env';

const log = createLogger({ scope: 'portfolio' });

/**
 * Bounded below the callers' own budgets (the home loader allows 2.5 s) so this
 * handler, not the caller, is the one that gives up — only then can it answer
 * with the cached copy below instead of letting the caller fall back to nothing.
 */
const CMS_TIMEOUT_MS = 2_200;

/**
 * How long a cached copy may stand in for a CMS that stopped answering. Long
 * enough to cover a cold start on Render's free tier (~60 s to wake) or a blip
 * while the keep-awake workflow is between pings; short enough that an edited or
 * unpublished post cannot linger for a whole session.
 */
const STALE_POSTS_MAX_AGE_MS = 30 * 60_000;

/**
 * Last successful response, per server instance.
 *
 * Without it a single failed fetch renders the blog section empty, and — because
 * `/` and `/blog` are served with `swr: 60` — that empty render is what every
 * visitor gets for the next minute. Serving posts that are a few minutes old is
 * strictly better than serving none.
 */
let lastGood: { posts: BlogPost[]; at: number } | undefined;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`cms timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** All published posts as cards (newest first). Runs on the server only. */
export const getBlogPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BlogPost[]> => {
    const { apiBase, mediaBase } = getCmsEnv();
    try {
      const posts = await withTimeout(fetchArticles(apiBase, mediaBase), CMS_TIMEOUT_MS);
      // An empty list is a legitimate answer (nothing published yet), but it must
      // not overwrite a good copy — that would turn one bad deploy of the CMS
      // into a blog that looks deliberately empty.
      if (posts.length > 0) lastGood = { posts, at: Date.now() };
      return posts;
    } catch (error) {
      const age = lastGood ? Date.now() - lastGood.at : undefined;
      if (lastGood && age !== undefined && age < STALE_POSTS_MAX_AGE_MS) {
        log.warn('cms.posts-stale', {
          error: error instanceof Error ? error.message : String(error),
          ageMs: age,
          posts: lastGood.posts.length,
        });
        return lastGood.posts;
      }
      // Nothing worth serving: let the callers render their own empty state.
      throw error;
    }
  },
);

/** One published post with its body, or null for an unknown slug. */
export const getBlogPost = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<BlogPost | null> => {
    const { apiBase, mediaBase } = getCmsEnv();
    return fetchArticleBySlug(apiBase, slug, mediaBase);
  });
