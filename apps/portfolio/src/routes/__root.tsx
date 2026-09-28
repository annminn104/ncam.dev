import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
// The stylesheet is linked from head() via `?url` (the TanStack Start pattern) so
// the server-rendered HTML is styled on first paint. A plain side-effect import
// would only attach the CSS once the client bundle runs (flash of unstyled page).
// app.css @imports the self-hosted fonts, styles.css (base + stage) and home.css.
import appCss from '../app.css?url';
import { NOT_FOUND_META } from '../lib/not-found';
import { SITE_URL } from '../lib/site';
import { THEME_COLOR_META, THEME_SCRIPT } from '../lib/theme';

const TITLE = 'Matthew (Minh Nguyen) — Frontend Developer · ncam.dev';
const DESCRIPTION =
  'Detail-oriented Frontend Developer with 5 years of experience building responsive, high-performance web apps in React, Next.js, Remix and Angular. Every project on this site is an independent app mounted at runtime via Module Federation.';

/**
 * public/og.png, 1200×630. Absolute, as Open Graph requires: scrapers resolve
 * no relative URL. A route that sends its own `og:image` must send its own
 * size and alt text too — tags merge by name, so these would otherwise
 * describe the wrong picture (projectHead does).
 */
const OG_IMAGE = `${SITE_URL}/og.png`;
const OG_IMAGE_ALT =
  'Project Showcase: micro-frontends with Module Federation — independent project apps, mounted at runtime.';

export const Route = createRootRoute({
  // `match._notFound` is how router-core marks the root match when a 404
  // settles here: a path no route matches, or a notFound() thrown by a route
  // with no notFoundComponent of its own (an unknown project id). The response
  // is then a 404 and no child's head() runs, so this is those pages' head.
  head: ({ match }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ...(match._notFound ? NOT_FOUND_META : [{ title: TITLE }]),
      { name: 'description', content: DESCRIPTION },
      // The no-JS default; the theme script in RootDocument retints it before
      // first paint to track the resolved theme (see THEME_COLOR_META).
      THEME_COLOR_META,
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'ncam.dev' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: OG_IMAGE_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
      { name: 'twitter:image:alt', content: OG_IMAGE_ALT },
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
        {/* Sets <html data-theme> for a returning visitor and retints the
            `theme-color` meta. A synchronous script in <head> runs while the
            document is still being parsed, so both land before anything paints —
            no flash of the other theme. It touches only that one attribute of
            <html>, which is why the element carries suppressHydrationWarning;
            how it shares the meta with React is in THEME_SCRIPT. */}
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
