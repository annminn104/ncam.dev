import { createFileRoute } from '@tanstack/react-router';
import { robotsTxt, siteFileResponse } from '../lib/site-files';

// A server route like the sitemap it points to, so both come from one module
// and `vite dev` serves the same file as production.
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => siteFileResponse(robotsTxt(), 'text/plain', 'static'),
    },
  },
});
