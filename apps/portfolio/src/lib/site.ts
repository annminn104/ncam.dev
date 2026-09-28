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

/** A page's Open Graph / Twitter image. Absolute: scrapers resolve no relative URL. */
export interface SocialImage {
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}

/** public/og.png: the site's own social image, for pages without one of their own. */
export const SITE_IMAGE: SocialImage = {
  url: `${SITE_URL}/og.png`,
  alt: 'Project Showcase: micro-frontends with Module Federation — independent project apps, mounted at runtime.',
  width: 1200,
  height: 630,
};

/**
 * Open Graph and Twitter tags for a page's image: its alt text always (falling
 * back to `fallbackAlt` when the image has none), its size only when both sides
 * are known. Head tags merge by name and a child route's win, but a child
 * cannot drop a tag its parents send. So the root sends og.png without a size,
 * and a page that names its own image names its own alt, or it would describe
 * its picture with og.png's text and, unsized, with og.png's 1200×630.
 */
export function socialImageMeta(image: SocialImage, fallbackAlt = '') {
  const alt = image.alt || fallbackAlt;
  return [
    { property: 'og:image', content: image.url },
    ...(image.width && image.height
      ? [
          { property: 'og:image:width', content: String(image.width) },
          { property: 'og:image:height', content: String(image.height) },
        ]
      : []),
    ...(alt ? [{ property: 'og:image:alt', content: alt }] : []),
    { name: 'twitter:image', content: image.url },
    ...(alt ? [{ name: 'twitter:image:alt', content: alt }] : []),
  ];
}
