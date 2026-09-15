import { createServerFn } from '@tanstack/react-start';
import { fetchArticleBySlug, fetchArticles, type BlogPost } from '@ncam/cms';
import { getCmsEnv } from '../server/cms-env';

/** All published posts as cards (newest first). Runs on the server only. */
export const getBlogPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BlogPost[]> => {
    const { apiBase, mediaBase } = getCmsEnv();
    return fetchArticles(apiBase, mediaBase);
  },
);

/** One published post with its body, or null for an unknown slug. */
export const getBlogPost = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<BlogPost | null> => {
    const { apiBase, mediaBase } = getCmsEnv();
    return fetchArticleBySlug(apiBase, slug, mediaBase);
  });
