import type { BlogPostSummary } from '@ncam/cms';
import { SITE_URL } from './site';

/** What the URL helpers read; a `BlogPost` and a `BlogPostSummary` both qualify. */
type PostRef = Pick<BlogPostSummary, 'slug' | 'seo'>;

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
