import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
// The stylesheet is linked from head() via `?url` (the TanStack Start pattern) so
// the server-rendered HTML is styled on first paint. A plain side-effect import
// would only attach the CSS once the client bundle runs (flash of unstyled page).
// app.css @imports the self-hosted fonts, styles.css (base + stage) and home.css.
import appCss from '../app.css?url';

const TITLE = 'Matthew (Minh Nguyen) — Frontend Developer · ncam.dev';
const DESCRIPTION =
  'Detail-oriented Frontend Developer with 5 years of experience building responsive, high-performance web apps in React, Next.js, Remix and Angular. Every project on this site is an independent app mounted at runtime via Module Federation.';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'theme-color', content: '#0b0b12' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'ncam.dev' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: '/og.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:image', content: '/og.png' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  component: RootComponent,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}
