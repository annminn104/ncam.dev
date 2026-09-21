import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
// The stylesheet is linked from head() via `?url` (the TanStack Start pattern) so
// the server-rendered HTML is styled on first paint. A plain side-effect import
// would only attach the CSS once the client bundle runs (flash of unstyled page).
// app.css @imports the self-hosted fonts, styles.css (base + stage) and home.css.
import appCss from '../app.css?url';
import { THEME_SCRIPT } from '../lib/theme';

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
      // `theme-color` is NOT here: it is written before first paint by the theme
      // script in RootDocument, because it has to track the resolved theme.
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Sets <html data-theme> for a returning visitor and writes the
            `theme-color` meta. A synchronous script in <head> runs while the
            document is still being parsed, so both land before anything paints —
            no flash of the other theme. It touches only that one attribute of
            <html>, which is why the element carries suppressHydrationWarning;
            the meta it creates is outside React's tree on purpose (see
            THEME_SCRIPT). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
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
