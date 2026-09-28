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
      'https://ncam.dev/projects/holodex/search',
      'https://ncam.dev/projects/holodex/collection',
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
