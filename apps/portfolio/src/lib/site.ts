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

/**
 * The site's author, as the home page names its Person (`profile.name` in
 * apps/profile/src/data/profile.ts; the full name is an `alternateName`).
 */
export const AUTHOR_NAME = 'Minh Nguyen';

/**
 * JSON-LD `@id` of that Person. `/` describes it in full; every other page's
 * structured data (a post's author and publisher) points at this id, so search
 * engines see one author across the site instead of one per page.
 */
export const PERSON_ID = `${SITE_URL}/#person`;
