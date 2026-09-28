import { createFileRoute } from '@tanstack/react-router';
import { siteFileResponse, sitemapXml } from '../lib/site-files';
import { getBlogIndex } from '../server/blog-index';

// Built per request: posts change in the CMS without a deploy. Without the CMS
// it still lists every static page, cached only briefly.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const posts = await getBlogIndex('sitemap.xml');
        return siteFileResponse(
          sitemapXml(posts ?? []),
          'application/xml',
          posts ? 'fresh' : 'degraded',
        );
      },
    },
  },
});
