import { createFileRoute } from '@tanstack/react-router';
import { llmsTxt, siteFileResponse } from '../lib/site-files';
import { getBlogIndex } from '../server/blog-index';

// Built per request so the newest posts are listed; without the CMS the rest
// of the file still renders, cached only briefly.
export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const posts = await getBlogIndex('llms.txt');
        return siteFileResponse(llmsTxt(posts ?? []), 'text/plain', posts ? 'fresh' : 'degraded');
      },
    },
  },
});
