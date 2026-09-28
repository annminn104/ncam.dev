import type { BlogPostSummary } from '@ncam/cms';
import { projects } from '@ncam/project-registry';
import {
  BLOG_DESCRIPTION,
  BLOG_FEED_URL,
  BLOG_NAME,
  BLOG_URL,
  isIndexable,
  postUrl,
} from './blog-seo';
import { AUTHOR_NAME, SITE_URL } from './site';

/**
 * The plain-text and XML files crawlers, feed readers and agents read, built
 * per request by the server routes in `src/routes/` (`robots[.]txt.ts`,
 * `sitemap[.]xml.ts`, `llms[.]txt.ts`, `blog/rss[.]xml.ts`). Nothing here
 * touches the network: the routes fetch the posts and pass them in, so a post
 * published in the CMS is listed without a deploy.
 */

/** Posts in the feed: the newest, which is what a reader polls it for. */
const FEED_POSTS = 20;
/** Posts in llms.txt: enough to show what the blog covers, not an archive. */
const LLMS_POSTS = 10;

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

/** An RFC 822 date, as RSS wants it, or undefined for a date that does not parse. */
function rfc822(iso: string): string | undefined {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? undefined : new Date(time).toUTCString();
}

/**
 * `/blog/rss.xml`: RSS 2.0 with the newest posts, each described by its
 * excerpt. Every published post qualifies, a noindexed one included: a feed
 * serves the people who subscribed, not a search index. `lastBuildDate` is the
 * newest change among the items, so an unchanged feed stays byte-identical.
 */
export function rssXml(posts: readonly BlogPostSummary[]): string {
  const newest = posts.slice(0, FEED_POSTS);
  const changed = newest.map((post) => Date.parse(post.updatedAt)).filter((t) => !Number.isNaN(t));
  const lastBuild = changed.length > 0 ? new Date(Math.max(...changed)).toUTCString() : undefined;
  const items = newest.map((post) => {
    const url = escapeXml(postUrl(post.slug));
    const published = rfc822(post.publishedAt);
    return [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <description>${escapeXml(post.excerpt)}</description>`,
      `      <dc:creator>${escapeXml(AUTHOR_NAME)}</dc:creator>`,
      ...(published ? [`      <pubDate>${published}</pubDate>`] : []),
      '    </item>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${escapeXml(BLOG_NAME)}</title>`,
    `    <link>${escapeXml(BLOG_URL)}</link>`,
    `    <description>${escapeXml(BLOG_DESCRIPTION)}</description>`,
    '    <language>en</language>',
    `    <atom:link href="${escapeXml(BLOG_FEED_URL)}" rel="self" type="application/rss+xml"/>`,
    ...(lastBuild ? [`    <lastBuildDate>${lastBuild}</lastBuildDate>`] : []),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

/** Link text that cannot end the link early: backslash, `[` and `]` escaped. */
function markdownLinkText(text: string): string {
  return text.replace(/[\\[\]]/g, (char) => `\\${char}`);
}

/** CMS text as one Markdown line: whitespace runs (newlines included) become one space. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** llms.txt's blockquote, on one line: some readers take only its first line. */
const LLMS_SUMMARY =
  `The portfolio of ${AUTHOR_NAME} (Matthew), a frontend developer: a gallery of projects, ` +
  'each an independent web app mounted into the site at runtime through Module Federation, ' +
  'and a blog about micro-frontends, server-side rendering and motion.';

/** A llms.txt list entry: `- [title](url): note`. */
function llmsLink(title: string, url: string, note: string): string {
  return `- [${markdownLinkText(title)}](${url}): ${oneLine(note)}`;
}

/**
 * `/llms.txt`, in the llmstxt.org format: an H1 with the site's name, a
 * blockquote saying what it is, then sections of links, each with a line on
 * what the page holds. Blog posts are the newest indexable ones, so this lists
 * nothing the sitemap would leave out; without the CMS that section is left
 * out and the rest still renders.
 */
export function llmsTxt(posts: readonly BlogPostSummary[]): string {
  const recent = posts.filter(isIndexable).slice(0, LLMS_POSTS);
  return [
    '# ncam.dev',
    '',
    `> ${LLMS_SUMMARY}`,
    '',
    '## Pages',
    '',
    llmsLink(
      'Home',
      `${SITE_URL}/`,
      `${AUTHOR_NAME}'s stacks, experience, projects, recent posts and contact details.`,
    ),
    llmsLink('Blog', BLOG_URL, BLOG_DESCRIPTION),
    '',
    '## Projects',
    '',
    ...projects
      .filter((project) => project.status === 'live')
      .map((project) =>
        llmsLink(project.name, `${SITE_URL}/projects/${project.id}`, project.tagline),
      ),
    ...(recent.length > 0
      ? [
          '',
          '## Blog posts',
          '',
          ...recent.map((post) => llmsLink(post.title, postUrl(post.slug), post.excerpt)),
        ]
      : []),
    '',
    '## Optional',
    '',
    llmsLink('RSS feed', BLOG_FEED_URL, 'Every post, newest first.'),
    llmsLink('Sitemap', `${SITE_URL}/sitemap.xml`, 'Every indexable page.'),
    '',
  ].join('\n');
}
