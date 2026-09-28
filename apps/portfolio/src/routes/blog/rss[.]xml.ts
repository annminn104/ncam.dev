import { createFileRoute } from '@tanstack/react-router';
import { rssXml, siteFileResponse } from '../../lib/site-files';
import { getBlogIndex } from '../../server/blog-index';

// Built per request. The path falls under the `/blog/**` swr rule in
// vite.config.ts, so production caches it for 60 s like the pages it lists,
// whatever cache header is set here. Without the CMS it is still a valid feed,
// with no items, rather than an error.
export const Route = createFileRoute('/blog/rss.xml')({
  server: {
    handlers: {
      GET: async () => {
        const posts = await getBlogIndex('rss.xml');
        return siteFileResponse(
          rssXml(posts ?? []),
          'application/rss+xml',
          posts ? 'fresh' : 'degraded',
        );
      },
    },
  },
});
