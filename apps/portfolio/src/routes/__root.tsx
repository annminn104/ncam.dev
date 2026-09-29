import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
// The stylesheet is inlined into the server-rendered <head> (`?inline`), so the
// first paint waits on the document alone. As a <link> it was the one
// render-blocking request on every page, and it cost mobile Lighthouse its
// first-contentful-paint budget. A plain side-effect import would only attach
// the CSS once the client bundle runs (a flash of unstyled page). app.css
// @imports the self-hosted fonts, styles.css (base + stage) and home.css.
import appCss from '../app.css?inline';
import { NOT_FOUND_META } from '../lib/not-found';
import { SITE_IMAGE, socialImageMeta } from '../lib/site';
import { THEME_COLOR_META, THEME_SCRIPT } from '../lib/theme';

const TITLE = 'Matthew (Minh Nguyen) — Frontend Developer · ncam.dev';
const DESCRIPTION =
  'Detail-oriented Frontend Developer with 5 years of experience building responsive, high-performance web apps in React, Next.js, Remix and Angular. Every project on this site is an independent app mounted at runtime via Module Federation.';

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
      // og.png for any page without an image of its own, deliberately unsized:
      // a child route cannot drop a tag sent here, so a size would stick to a
      // page whose own image has none known (see socialImageMeta). Pages that
      // use og.png themselves send it again with its size.
      ...socialImageMeta({ url: SITE_IMAGE.url, alt: SITE_IMAGE.alt }),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
  }),
  component: RootComponent,
});

/**
 * The site's stylesheet, on the server only. The root document is only ever
 * hydrated, never rendered fresh on the client, and React leaves a hydrated
 * element's server innerHTML alone while its `__html` stays the same, so the
 * client can pass an empty string and keep the ~40 KB of CSS out of its bundle.
 */
const APP_CSS = import.meta.env.SSR ? appCss : '';

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* After HeadContent, so <meta charset> stays in the first 1024 bytes. */}
        <style
          id="app-css"
          dangerouslySetInnerHTML={{ __html: APP_CSS }}
          suppressHydrationWarning
        />
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
