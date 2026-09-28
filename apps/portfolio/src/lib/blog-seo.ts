import type { BlogImage, BlogPost, BlogPostSummary } from '@ncam/cms';
import { AUTHOR_NAME, PERSON_ID, SITE_URL } from './site';

/** What the URL helpers read; a `BlogPost` and a `BlogPostSummary` both qualify. */
type PostRef = Pick<BlogPostSummary, 'slug' | 'seo'>;

export const BLOG_URL = `${SITE_URL}/blog`;
/** JSON-LD `@id` of the Blog that `/blog` describes and every post is part of. */
export const BLOG_ID = `${BLOG_URL}#blog`;
/** The blog's own name: its JSON-LD, its feed's title. `BLOG_TITLE` is the page's. */
export const BLOG_NAME = 'ncam.dev blog';
export const BLOG_TITLE = 'Blog — ncam.dev';
export const BLOG_DESCRIPTION =
  'Long-form write-ups on micro-frontends, SSR and motion — the things this site is made of.';
/** The RSS feed (`src/routes/blog/rss[.]xml.ts`). */
export const BLOG_FEED_URL = `${BLOG_URL}/rss.xml`;

/** Lets feed readers find the feed from the blog's pages. */
const FEED_LINK = {
  rel: 'alternate',
  type: 'application/rss+xml',
  title: BLOG_NAME,
  href: BLOG_FEED_URL,
};

/** The site-wide social image (`public/og.png`), for pages without one of their own. */
const SITE_IMAGE: BlogImage = {
  url: `${SITE_URL}/og.png`,
  alt: 'ncam.dev',
  width: 1200,
  height: 630,
};

/** A post's own URL on this site. */
export function postUrl(slug: string): string {
  return `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
}

/**
 * The post's canonical URL: the CMS override when it parses as an http(s) URL
 * (a relative one resolves against the site), otherwise the post's own URL.
 */
export function canonicalUrl(post: PostRef): string {
  const own = postUrl(post.slug);
  if (!post.seo.canonicalUrl) return own;
  try {
    const url = new URL(post.seo.canonicalUrl, SITE_URL);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : own;
  } catch {
    return own;
  }
}

/** Robots directives that keep a page out of the index (`none` is noindex + nofollow). */
const NOINDEX = new Set(['noindex', 'none']);

/** Whether a robots value asks to stay out of the index. Lenient about separators. */
export function isNoindex(robots: string | null): boolean {
  if (!robots) return false;
  return robots.split(/[\s,]+/).some((directive) => NOINDEX.has(directive.toLowerCase()));
}

/**
 * Whether the post's own URL is meant to be indexed — neither noindexed nor
 * canonicalised to another URL. Only those belong in the sitemap and llms.txt,
 * which must not list a URL the page itself disowns.
 */
export function isIndexable(post: PostRef): boolean {
  return !isNoindex(post.seo.robots) && canonicalUrl(post) === postUrl(post.slug);
}

/** JSON-LD is inlined in a <script>: escape `<` so CMS-authored text can never close the tag. */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Open Graph / Twitter tags for an image; its size only when both sides are known. */
function imageMeta(image: BlogImage) {
  return [
    { property: 'og:image', content: image.url },
    ...(image.width && image.height
      ? [
          { property: 'og:image:width', content: String(image.width) },
          { property: 'og:image:height', content: String(image.height) },
        ]
      : []),
    { name: 'twitter:image', content: image.url },
  ];
}

/**
 * The author of every post. `/` holds the full Person under the same `@id`;
 * the name and URL are repeated here so a post's author reads on its own.
 */
function author() {
  return { '@type': 'Person', '@id': PERSON_ID, name: AUTHOR_NAME, url: `${SITE_URL}/` };
}

/** `head()` of `/blog/<slug>`. The CMS's canonical and robots overrides win when set. */
export function blogPostHead(post: BlogPost) {
  const title = `${post.seo.title} · ncam.dev`;
  const canonical = canonicalUrl(post);
  return {
    meta: [
      { title },
      { name: 'description', content: post.seo.description },
      { name: 'robots', content: post.seo.robots ?? 'index,follow' },
      { property: 'og:type', content: 'article' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: post.seo.description },
      { property: 'og:url', content: canonical },
      { property: 'article:published_time', content: post.publishedAt },
      { property: 'article:modified_time', content: post.updatedAt },
      // `seo.image` is already the post's own og image or, failing that, its cover.
      ...imageMeta(post.seo.image ?? SITE_IMAGE),
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: post.seo.description },
    ],
    links: [{ rel: 'canonical', href: canonical }, FEED_LINK],
  };
}

/** The post as a BlogPosting, by the `@id` the blog index lists it under. */
export function blogPostJsonLd(post: BlogPost) {
  const url = postUrl(post.slug);
  const image = post.seo.image;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.seo.description,
    ...(image
      ? {
          image:
            image.width && image.height
              ? { '@type': 'ImageObject', url: image.url, width: image.width, height: image.height }
              : image.url,
        }
      : {}),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: author(),
    publisher: { '@id': PERSON_ID },
    mainEntityOfPage: url,
    url,
    isPartOf: { '@type': 'Blog', '@id': BLOG_ID, url: BLOG_URL },
    inLanguage: 'en',
    ...(post.tags.length > 0 ? { keywords: post.tags.join(', ') } : {}),
  };
}

/** `head()` of `/blog`. */
export function blogIndexHead() {
  return {
    meta: [
      { title: BLOG_TITLE },
      { name: 'description', content: BLOG_DESCRIPTION },
      { name: 'robots', content: 'index,follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: BLOG_TITLE },
      { property: 'og:description', content: BLOG_DESCRIPTION },
      { property: 'og:url', content: BLOG_URL },
      ...imageMeta(SITE_IMAGE),
      { name: 'twitter:title', content: BLOG_TITLE },
      { name: 'twitter:description', content: BLOG_DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: BLOG_URL }, FEED_LINK],
  };
}

/**
 * `/blog` as a CollectionPage whose main entity is the Blog, which lists the
 * posts the page shows, each under the `@id` its own page gives it.
 */
export function blogIndexJsonLd(posts: readonly BlogPost[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': BLOG_URL,
        url: BLOG_URL,
        name: BLOG_TITLE,
        description: BLOG_DESCRIPTION,
        inLanguage: 'en',
        mainEntity: { '@id': BLOG_ID },
      },
      {
        '@type': 'Blog',
        '@id': BLOG_ID,
        url: BLOG_URL,
        name: BLOG_NAME,
        description: BLOG_DESCRIPTION,
        inLanguage: 'en',
        author: author(),
        publisher: { '@id': PERSON_ID },
        ...(posts.length > 0
          ? {
              blogPost: posts.map((post) => ({
                '@type': 'BlogPosting',
                '@id': `${postUrl(post.slug)}#article`,
                headline: post.title,
                url: postUrl(post.slug),
                datePublished: post.publishedAt,
                dateModified: post.updatedAt,
                author: { '@id': PERSON_ID },
              })),
            }
          : {}),
      },
    ],
  };
}
