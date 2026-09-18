/**
 * The site's public origin — the one canonical URLs, Open Graph tags, JSON-LD
 * and the sitemap must all agree on.
 *
 * Baked at build time from `SITE_URL` (see `resolveSiteUrl()` in vite.config.ts,
 * which also falls back to Vercel's production domain). It is a build input, not
 * a runtime one, because `head()` runs on the server AND again on client
 * navigations: reading it from `process.env` would leave the browser with
 * nothing, and threading it through every loader to reach `head()` would cost
 * more than a rebuild when the domain changes — which happens roughly never.
 *
 * Never trailing-slashed. Callers append their own path: `${SITE_URL}/blog`.
 */
export const SITE_URL = import.meta.env.VITE_SITE_URL;

/** Origin only, for deciding whether a link in CMS content leaves the site. */
export const SITE_ORIGIN = new URL(SITE_URL).origin;
