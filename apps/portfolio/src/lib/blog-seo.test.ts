import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { BlogPostSummary } from '@ncam/cms';

type BlogSeoModule = typeof import('./blog-seo');

let seo: BlogSeoModule;

const SITE = 'https://ncam.dev';

beforeAll(async () => {
  // lib/site.ts bakes this in at build time from the Vite env; nothing defines
  // it under vitest, so stub it before the module graph is evaluated.
  vi.stubEnv('VITE_SITE_URL', SITE);
  seo = await import('./blog-seo');
});

function post(overrides: Partial<BlogPostSummary['seo']> = {}): BlogPostSummary {
  return {
    slug: 'hello-world',
    title: 'Hello, world',
    excerpt: 'The first post.',
    publishedAt: '2026-09-15T08:30:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    seo: { canonicalUrl: null, robots: null, ...overrides },
  };
}

describe('postUrl', () => {
  it('puts the slug under /blog on the site origin', () => {
    expect(seo.postUrl('hello-world')).toBe('https://ncam.dev/blog/hello-world');
  });
});

describe('canonicalUrl', () => {
  it("is the post's own URL without an override", () => {
    expect(seo.canonicalUrl(post())).toBe('https://ncam.dev/blog/hello-world');
  });

  it('takes an absolute override as is, and resolves a relative one against the site', () => {
    expect(seo.canonicalUrl(post({ canonicalUrl: 'https://dev.example/hello' }))).toBe(
      'https://dev.example/hello',
    );
    expect(seo.canonicalUrl(post({ canonicalUrl: '/blog/hello-again' }))).toBe(
      'https://ncam.dev/blog/hello-again',
    );
  });

  it('ignores an override that is not an http(s) URL', () => {
    expect(seo.canonicalUrl(post({ canonicalUrl: 'javascript:alert(1)' }))).toBe(
      'https://ncam.dev/blog/hello-world',
    );
    expect(seo.canonicalUrl(post({ canonicalUrl: 'http://[' }))).toBe(
      'https://ncam.dev/blog/hello-world',
    );
  });
});

describe('isNoindex', () => {
  it('reads noindex and none, in any case and with any separator', () => {
    expect(seo.isNoindex('noindex, nofollow')).toBe(true);
    expect(seo.isNoindex('NOINDEX')).toBe(true);
    expect(seo.isNoindex('nofollow noindex')).toBe(true);
    expect(seo.isNoindex('none')).toBe(true);
  });

  it('is false for indexable values and for no value', () => {
    expect(seo.isNoindex(null)).toBe(false);
    expect(seo.isNoindex('index, follow')).toBe(false);
    expect(seo.isNoindex('nofollow, max-snippet:-1')).toBe(false);
  });
});

describe('isIndexable', () => {
  it('keeps a post with no overrides, or with a canonical that is its own URL', () => {
    expect(seo.isIndexable(post())).toBe(true);
    expect(seo.isIndexable(post({ canonicalUrl: '/blog/hello-world' }))).toBe(true);
    expect(seo.isIndexable(post({ robots: 'index, follow' }))).toBe(true);
  });

  it('drops a noindexed post and one canonicalised to another URL', () => {
    expect(seo.isIndexable(post({ robots: 'noindex, follow' }))).toBe(false);
    expect(seo.isIndexable(post({ canonicalUrl: 'https://dev.example/hello' }))).toBe(false);
  });
});
