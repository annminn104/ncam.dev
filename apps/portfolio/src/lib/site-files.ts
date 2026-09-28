import type { BlogPostSummary } from '@ncam/cms';
import { projects } from '@ncam/project-registry';
import { isIndexable, postUrl } from './blog-seo';
import { SITE_URL } from './site';

/**
 * The plain-text and XML files crawlers read, built per request by the server
 * routes in `src/routes/` (`robots[.]txt.ts`, `sitemap[.]xml.ts`). Nothing here
 * touches the network: the routes fetch the posts and pass them in, so a post
 * published in the CMS is listed without a deploy.
 */

/**
 * How long a CDN may keep each kind of file. `fresh` is a file built with the
 * CMS's posts; `degraded` is the same file built without them because the CMS
 * did not answer, kept only a minute so the posts come back soon; `static`
 * only changes with a deploy.
 */
const CACHE_CONTROL = {
  fresh: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  degraded: 'public, max-age=0, s-maxage=60',
  static: 'public, max-age=3600, s-maxage=86400',
} as const;

export type SiteFileCache = keyof typeof CACHE_CONTROL;

/** A 200 with the file's type (as UTF-8) and its cache policy. */
export function siteFileResponse(body: string, type: string, cache: SiteFileCache): Response {
  return new Response(body, {
    headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': CACHE_CONTROL[cache] },
  });
}

/** Characters XML 1.0 forbids outright (most C0 controls, lone surrogates, U+FFFE/U+FFFF). */
const XML_INVALID = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Text or attribute value safe to put in XML: entities escaped, forbidden characters dropped. */
export function escapeXml(value: string): string {
  return value.replace(XML_INVALID, '').replace(/[&<>"']/g, (char) => XML_ENTITIES[char]);
}

/**
 * Crawlers that `User-agent: *` already lets in, named anyway so the choice
 * reads as deliberate: AI search and AI training are both welcome. Each vendor
 * splits them into separate tokens (OAI-SearchBot answers, GPTBot trains;
 * Claude-SearchBot and ClaudeBot likewise), so both halves are listed.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
] as const;

/** `/robots.txt`: everything allowed, for every crawler, and where the sitemap is. */
export function robotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    '# Allowed by name. A crawler with a group of its own ignores the * group,',
    '# so a rule added to one group must be added to the other as well.',
    ...AI_CRAWLERS.map((agent) => `User-agent: ${agent}`),
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

/** A W3C datetime (for `<lastmod>`), or undefined for a date that does not parse. */
function w3cDate(iso: string): string | undefined {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/**
 * `/sitemap.xml`: the home page, the blog, every live project with the static
 * pages a route-aware one lists (`sitemapPaths`), then every indexable post with
 * its last change as `<lastmod>`. Only posts carry one: for the other pages no
 * date is known, and a guessed `lastmod` is worse than none. No `changefreq` or
 * `priority` either, which Google ignores.
 */
export function sitemapXml(posts: readonly BlogPostSummary[]): string {
  const urls: SitemapUrl[] = [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/blog` },
    ...projects
      .filter((project) => project.status === 'live')
      .flatMap((project) => {
        const loc = `${SITE_URL}/projects/${project.id}`;
        return [
          { loc },
          ...(project.sitemapPaths ?? []).map((path) => ({ loc: `${loc}/${path}` })),
        ];
      }),
    ...posts
      .filter(isIndexable)
      .map((post) => ({ loc: postUrl(post.slug), lastmod: w3cDate(post.updatedAt) })),
  ];
  const entries = urls.map(
    ({ loc, lastmod }) =>
      `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}
