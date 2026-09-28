import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { BlogPostSummary } from '@ncam/cms';

type SiteFilesModule = typeof import('./site-files');

let files: SiteFilesModule;

const SITE = 'https://ncam.dev';

beforeAll(async () => {
  // lib/site.ts bakes this in at build time from the Vite env; nothing defines
  // it under vitest, so stub it before the module graph is evaluated.
  vi.stubEnv('VITE_SITE_URL', SITE);
  files = await import('./site-files');
});

function post(slug: string, overrides: Partial<BlogPostSummary> = {}): BlogPostSummary {
  return {
    slug,
    title: `Post ${slug}`,
    excerpt: `About ${slug}.`,
    publishedAt: '2026-09-15T08:30:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    seo: { canonicalUrl: null, robots: null },
    ...overrides,
  };
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);

describe('escapeXml', () => {
  it('escapes the five XML entities', () => {
    expect(files.escapeXml(`Tom & "Jerry" <'s>`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;&apos;s&gt;',
    );
  });

  it('drops characters XML 1.0 forbids and keeps everything else', () => {
    expect(files.escapeXml('a\u0000b\u000Bc\uD800d￾e')).toBe('abcde');
    expect(files.escapeXml('tab\there\nline 🃏 café')).toBe('tab\there\nline 🃏 café');
  });
});

describe('siteFileResponse', () => {
  it('sends the type as UTF-8 with the cache policy for its kind', () => {
    const fresh = files.siteFileResponse('x', 'application/xml', 'fresh');
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(fresh.headers.get('cache-control')).toContain('s-maxage=3600');
    const degraded = files.siteFileResponse('x', 'application/xml', 'degraded');
    expect(degraded.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60');
    expect(files.siteFileResponse('x', 'text/plain', 'static').headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=86400',
    );
  });
});

describe('robotsTxt', () => {
  const robots = () => files.robotsTxt();

  it('allows every crawler and points at the sitemap', () => {
    expect(robots().startsWith('User-agent: *\nAllow: /\n')).toBe(true);
    expect(robots()).toContain('\nSitemap: https://ncam.dev/sitemap.xml\n');
    expect(robots()).not.toMatch(/Disallow/);
  });

  it('names each AI crawler in a group that allows everything', () => {
    const lines = robots().split('\n');
    for (const agent of files.AI_CRAWLERS) expect(lines).toContain(`User-agent: ${agent}`);
    const group = lines.slice(lines.indexOf(`User-agent: ${files.AI_CRAWLERS[0]}`));
    expect(group.slice(files.AI_CRAWLERS.length)[0]).toBe('Allow: /');
    expect(files.AI_CRAWLERS).toEqual(
      expect.arrayContaining(['OAI-SearchBot', 'Claude-SearchBot', 'Google-Extended', 'CCBot']),
    );
  });

  it('holds only comments, blank lines and field lines', () => {
    for (const line of robots().split('\n')) {
      expect(line === '' || line.startsWith('#') || /^[A-Za-z-]+: \S+$/.test(line)).toBe(true);
    }
  });
});

describe('sitemapXml', () => {
  it('lists the static pages, every live project and the Holodex pages, without dates', () => {
    const xml = files.sitemapXml([]);
    expect(locs(xml)).toEqual([
      'https://ncam.dev/',
      'https://ncam.dev/blog',
      'https://ncam.dev/projects/toonhub',
      'https://ncam.dev/projects/mindloop',
      'https://ncam.dev/projects/immersive-ocean',
      'https://ncam.dev/projects/viktor',
      'https://ncam.dev/projects/bali',
      'https://ncam.dev/projects/holodex',
      'https://ncam.dev/projects/holodex/sets',
    ]);
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toMatch(/changefreq|priority/);
  });

  it('adds each indexable post with its last change as lastmod', () => {
    const xml = files.sitemapXml([
      post('newest', { updatedAt: '2026-09-27T12:00:00+07:00' }),
      post('hidden', { seo: { canonicalUrl: null, robots: 'noindex' } }),
      post('elsewhere', { seo: { canonicalUrl: 'https://dev.example/x', robots: null } }),
      post('older'),
    ]);
    expect(locs(xml).slice(-2)).toEqual([
      'https://ncam.dev/blog/newest',
      'https://ncam.dev/blog/older',
    ]);
    expect(xml).toContain(
      '<url><loc>https://ncam.dev/blog/newest</loc><lastmod>2026-09-27T05:00:00.000Z</lastmod></url>',
    );
    expect(xml).not.toContain('hidden');
    expect(xml).not.toContain('elsewhere');
  });

  it('leaves out a lastmod that does not parse rather than emitting it', () => {
    const xml = files.sitemapXml([post('odd', { updatedAt: 'not-a-date' })]);
    expect(xml).toContain('<url><loc>https://ncam.dev/blog/odd</loc></url>');
  });

  it('is one urlset document with a url element per loc', () => {
    const xml = files.sitemapXml([post('a'), post('b')]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset ')).toBe(true);
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(xml.match(/<url>/g)).toHaveLength(locs(xml).length);
    expect(xml.match(/<\/url>/g)).toHaveLength(locs(xml).length);
  });
});

describe('rssXml', () => {
  const items = (xml: string) => xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  it('describes the blog and links itself with atom:link rel=self', () => {
    const xml = files.rssXml([post('a')]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" ')).toBe(
      true,
    );
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain('<title>ncam.dev blog</title>');
    expect(xml).toContain('<link>https://ncam.dev/blog</link>');
    expect(xml).toContain(
      '<atom:link href="https://ncam.dev/blog/rss.xml" rel="self" type="application/rss+xml"/>',
    );
    expect(xml.trimEnd().endsWith('</channel>\n</rss>')).toBe(true);
  });

  it('gives each post a permalink guid, its excerpt, its author and an RFC 822 date', () => {
    const [item] = items(files.rssXml([post('a')]));
    expect(item).toContain('<title>Post a</title>');
    expect(item).toContain('<link>https://ncam.dev/blog/a</link>');
    expect(item).toContain('<guid isPermaLink="true">https://ncam.dev/blog/a</guid>');
    expect(item).toContain('<description>About a.</description>');
    expect(item).toContain('<dc:creator>Minh Nguyen</dc:creator>');
    expect(item).toContain('<pubDate>Tue, 15 Sep 2026 08:30:00 GMT</pubDate>');
  });

  it('escapes CMS text, keeps noindexed posts and caps the feed at the 20 newest', () => {
    const tricky = post('tricky', {
      title: 'Ship <it> & "go"',
      excerpt: 'a < b\u0000',
      seo: { canonicalUrl: null, robots: 'noindex' },
    });
    const many = Array.from({ length: 25 }, (_, i) => post(`p${i}`));
    const xml = files.rssXml([tricky, ...many]);
    expect(xml).toContain('<title>Ship &lt;it&gt; &amp; &quot;go&quot;</title>');
    expect(xml).toContain('<description>a &lt; b</description>');
    expect(items(xml)).toHaveLength(20);
  });

  it('dates the build by the newest change, and is a valid empty feed without posts', () => {
    const xml = files.rssXml([
      post('a', { updatedAt: '2026-09-18T00:00:00.000Z' }),
      post('b', { updatedAt: '2026-09-21T06:00:00.000Z' }),
    ]);
    expect(xml).toContain('<lastBuildDate>Mon, 21 Sep 2026 06:00:00 GMT</lastBuildDate>');
    const empty = files.rssXml([]);
    expect(items(empty)).toHaveLength(0);
    expect(empty).not.toContain('lastBuildDate');
    expect(empty).toContain('<channel>');
  });
});

describe('llmsTxt', () => {
  it('opens with the H1 and a one-line blockquote summary', () => {
    const [h1, blank, summary] = files.llmsTxt([]).split('\n');
    expect(h1).toBe('# ncam.dev');
    expect(blank).toBe('');
    expect(summary).toMatch(/^> The portfolio of Minh Nguyen \(Matthew\), a frontend developer: /);
  });

  it('links home, the blog and every live project with its tagline', () => {
    const text = files.llmsTxt([]);
    expect(text).toContain('## Pages');
    expect(text).toMatch(/^- \[Home\]\(https:\/\/ncam\.dev\/\): Minh Nguyen's stacks/m);
    expect(text).toMatch(/^- \[Blog\]\(https:\/\/ncam\.dev\/blog\): Long-form write-ups/m);
    expect(text).toContain('- [TOONHUB](https://ncam.dev/projects/toonhub): Collectible figurines');
    expect(text).toContain('- [Holodex](https://ncam.dev/projects/holodex): Pokémon TCG explorer');
    expect(text.match(/^- \[.+\]\(https:\/\/ncam\.dev\/projects\//gm)).toHaveLength(6);
  });

  it('lists the newest indexable posts on one line each, and omits the section with none', () => {
    const text = files.llmsTxt([
      post('first', { title: 'Arrays [and] more', excerpt: 'Line one.\nLine   two.' }),
      post('hidden', { seo: { canonicalUrl: null, robots: 'noindex' } }),
      ...Array.from({ length: 12 }, (_, i) => post(`p${i}`)),
    ]);
    expect(text).toContain('## Blog posts');
    expect(text).toContain(
      '- [Arrays \\[and\\] more](https://ncam.dev/blog/first): Line one. Line two.',
    );
    expect(text).not.toContain('/blog/hidden');
    const section = text.slice(text.indexOf('## Blog posts'), text.indexOf('## Optional'));
    expect(section.match(/^- /gm)).toHaveLength(10);
    expect(files.llmsTxt([])).not.toContain('## Blog posts');
  });

  it('ends with the optional feed and sitemap links', () => {
    const text = files.llmsTxt([]);
    const optional = text.slice(text.indexOf('## Optional'));
    expect(optional).toContain('- [RSS feed](https://ncam.dev/blog/rss.xml): ');
    expect(optional).toContain('- [Sitemap](https://ncam.dev/sitemap.xml): ');
  });
});
