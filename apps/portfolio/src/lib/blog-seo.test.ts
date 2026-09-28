import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { BlogPost, BlogPostSummary } from '@ncam/cms';

type BlogSeoModule = typeof import('./blog-seo');

let seo: BlogSeoModule;
let site: typeof import('./site');

const SITE = 'https://ncam.dev';

beforeAll(async () => {
  // lib/site.ts bakes this in at build time from the Vite env; nothing defines
  // it under vitest, so stub it before the module graph is evaluated.
  vi.stubEnv('VITE_SITE_URL', SITE);
  seo = await import('./blog-seo');
  site = await import('./site');
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

const IMAGE = { url: 'https://cms.example/uploads/og.png', alt: 'Cover', width: 1200, height: 630 };

/** How both blog pages point feed readers at the feed. */
const FEED_LINK = {
  rel: 'alternate',
  type: 'application/rss+xml',
  title: 'ncam.dev blog',
  href: 'https://ncam.dev/blog/rss.xml',
};

function fullPost(overrides: Partial<BlogPost> = {}, seoOverrides: Partial<BlogPost['seo']> = {}) {
  const base: BlogPost = {
    id: 'doc-1',
    slug: 'hello-world',
    title: 'Hello, world',
    excerpt: 'The first post.',
    publishedAt: '2026-09-15T08:30:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    dateLabel: 'Sep 15, 2026',
    readingTime: 3,
    readingLabel: '3 min',
    tags: ['React', 'SSR'],
    cover: IMAGE,
    body: null,
    seo: {
      title: 'Hello, world — notes',
      description: 'What the first post is about.',
      image: IMAGE,
      canonicalUrl: null,
      robots: null,
    },
  };
  return { ...base, ...overrides, seo: { ...base.seo, ...seoOverrides } };
}

/** The content of the meta tag with this name or property. */
const meta = (head: { meta: readonly object[] }, key: string) =>
  (head.meta as Array<Record<string, string>>).find(
    (entry) => entry.name === key || entry.property === key,
  )?.content;

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

describe('site author constants', () => {
  it('name the Person the home page describes, by a stable @id on the site', () => {
    expect(site.PERSON_ID).toBe('https://ncam.dev/#person');
    expect(site.AUTHOR_NAME).toBe('Minh Nguyen');
  });
});

describe('blogPostHead', () => {
  it('describes the post, with both dates and a sized social image', () => {
    const head = seo.blogPostHead(fullPost());
    expect(head.meta[0]).toEqual({ title: 'Hello, world — notes · ncam.dev' });
    expect(meta(head, 'description')).toBe('What the first post is about.');
    expect(meta(head, 'robots')).toBe('index,follow');
    expect(meta(head, 'og:type')).toBe('article');
    expect(meta(head, 'og:url')).toBe('https://ncam.dev/blog/hello-world');
    expect(meta(head, 'article:published_time')).toBe('2026-09-15T08:30:00.000Z');
    expect(meta(head, 'article:modified_time')).toBe('2026-09-20T10:00:00.000Z');
    expect(meta(head, 'og:image')).toBe(IMAGE.url);
    expect(meta(head, 'og:image:width')).toBe('1200');
    expect(meta(head, 'og:image:height')).toBe('630');
    expect(meta(head, 'twitter:image')).toBe(IMAGE.url);
    // Its own alt text, never the one the root sends for og.png.
    expect(meta(head, 'og:image:alt')).toBe('Cover');
    expect(meta(head, 'twitter:image:alt')).toBe('Cover');
    expect(head.links).toEqual([
      { rel: 'canonical', href: 'https://ncam.dev/blog/hello-world' },
      FEED_LINK,
    ]);
  });

  it('describes an image uploaded without alt text by the post title', () => {
    const head = seo.blogPostHead(fullPost({}, { image: { ...IMAGE, alt: '' } }));
    expect(meta(head, 'og:image:alt')).toBe('Hello, world');
    expect(meta(head, 'twitter:image:alt')).toBe('Hello, world');
  });

  it("honours the CMS's canonical and robots overrides", () => {
    const head = seo.blogPostHead(
      fullPost({}, { canonicalUrl: 'https://dev.example/hello', robots: 'noindex, nofollow' }),
    );
    expect(meta(head, 'robots')).toBe('noindex, nofollow');
    expect(meta(head, 'og:url')).toBe('https://dev.example/hello');
    expect(head.links[0]).toEqual({ rel: 'canonical', href: 'https://dev.example/hello' });
  });

  it('gives an unsized image no size, and a post with none the site image', () => {
    const unsized = seo.blogPostHead(fullPost({}, { image: { ...IMAGE, width: null } }));
    expect(meta(unsized, 'og:image')).toBe(IMAGE.url);
    expect(meta(unsized, 'og:image:width')).toBeUndefined();
    expect(meta(unsized, 'og:image:height')).toBeUndefined();
    const none = seo.blogPostHead(fullPost({ cover: null }, { image: null }));
    expect(meta(none, 'og:image')).toBe('https://ncam.dev/og.png');
    expect(meta(none, 'og:image:width')).toBe('1200');
    expect(meta(none, 'og:image:alt')).toBe(site.SITE_IMAGE.alt);
  });
});

describe('blogPostJsonLd', () => {
  it('is a complete BlogPosting that credits the site Person by @id', () => {
    expect(seo.blogPostJsonLd(fullPost())).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': 'https://ncam.dev/blog/hello-world#article',
      headline: 'Hello, world',
      description: 'What the first post is about.',
      image: { '@type': 'ImageObject', url: IMAGE.url, width: 1200, height: 630 },
      datePublished: '2026-09-15T08:30:00.000Z',
      dateModified: '2026-09-20T10:00:00.000Z',
      author: {
        '@type': 'Person',
        '@id': 'https://ncam.dev/#person',
        name: 'Minh Nguyen',
        url: 'https://ncam.dev/',
      },
      publisher: { '@id': 'https://ncam.dev/#person' },
      mainEntityOfPage: 'https://ncam.dev/blog/hello-world',
      url: 'https://ncam.dev/blog/hello-world',
      isPartOf: {
        '@type': 'Blog',
        '@id': 'https://ncam.dev/blog#blog',
        url: 'https://ncam.dev/blog',
      },
      inLanguage: 'en',
      keywords: 'React, SSR',
    });
  });

  it('leaves out what the post does not have', () => {
    const jsonLd = seo.blogPostJsonLd(fullPost({ tags: [], cover: null }, { image: null }));
    expect(jsonLd).not.toHaveProperty('image');
    expect(jsonLd).not.toHaveProperty('keywords');
    const unsized = seo.blogPostJsonLd(fullPost({}, { image: { ...IMAGE, height: null } }));
    expect(unsized.image).toBe(IMAGE.url);
  });
});

describe('blogIndexHead', () => {
  it('points og:image at the absolute site image and the canonical at /blog', () => {
    const head = seo.blogIndexHead();
    expect(meta(head, 'og:image')).toBe('https://ncam.dev/og.png');
    expect(meta(head, 'og:image:width')).toBe('1200');
    expect(meta(head, 'og:image:alt')).toBe(site.SITE_IMAGE.alt);
    expect(meta(head, 'og:url')).toBe('https://ncam.dev/blog');
    expect(head.links).toEqual([{ rel: 'canonical', href: 'https://ncam.dev/blog' }, FEED_LINK]);
  });
});

describe('socialImageMeta', () => {
  it('always names alt text and sizes only a fully sized image', () => {
    // The root sends og.png unsized through this, so no page inherits a size
    // it cannot override; a page with its own image names its own alt.
    expect(site.socialImageMeta({ url: `${SITE}/og.png`, alt: 'Card' })).toEqual([
      { property: 'og:image', content: `${SITE}/og.png` },
      { property: 'og:image:alt', content: 'Card' },
      { name: 'twitter:image', content: `${SITE}/og.png` },
      { name: 'twitter:image:alt', content: 'Card' },
    ]);
    const sized = site.socialImageMeta({ url: 'x', alt: '', width: 800, height: 400 }, 'Fallback');
    expect(sized).toContainEqual({ property: 'og:image:width', content: '800' });
    expect(sized).toContainEqual({ property: 'og:image:height', content: '400' });
    expect(sized).toContainEqual({ property: 'og:image:alt', content: 'Fallback' });
  });
});

describe('blogIndexJsonLd', () => {
  it('is a CollectionPage whose Blog lists the posts by the @id their pages use', () => {
    const jsonLd = seo.blogIndexJsonLd([fullPost()]);
    const [page, blog] = jsonLd['@graph'];
    expect(page).toMatchObject({
      '@type': 'CollectionPage',
      url: 'https://ncam.dev/blog',
      // The WebSite node `/` declares, so the blog joins the site's graph.
      isPartOf: { '@id': 'https://ncam.dev/#website' },
      mainEntity: { '@id': 'https://ncam.dev/blog#blog' },
    });
    expect(blog).toMatchObject({
      '@type': 'Blog',
      '@id': 'https://ncam.dev/blog#blog',
      author: { '@id': 'https://ncam.dev/#person', name: 'Minh Nguyen' },
      publisher: { '@id': 'https://ncam.dev/#person' },
      blogPost: [
        {
          '@type': 'BlogPosting',
          '@id': 'https://ncam.dev/blog/hello-world#article',
          headline: 'Hello, world',
          dateModified: '2026-09-20T10:00:00.000Z',
        },
      ],
    });
  });

  it('lists no posts when there are none (the CMS was down, or nothing is out)', () => {
    expect(seo.blogIndexJsonLd([])['@graph'][1]).not.toHaveProperty('blogPost');
  });
});
