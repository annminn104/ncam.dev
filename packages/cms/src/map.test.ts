import { describe, expect, it } from 'vitest';
import { absolutizeBlockImages, formatDateLabel, mapArticle, resolveMediaUrl } from './map';
import type { StrapiArticle } from './types';

const MEDIA_BASE = 'http://cms.test:1337';

const raw: StrapiArticle = {
  documentId: 'doc-1',
  title: 'Federating React 19',
  slug: 'federating-react-19',
  excerpt: 'Why every remote bundles its own React.',
  readingTime: 9,
  publishedAt: '2026-09-15T08:30:00.000Z',
  cover: { url: '/uploads/cover.png', alternativeText: 'Cover art', width: 1200, height: 630 },
  tags: [
    { name: 'Module Federation', slug: 'module-federation' },
    { name: 'React', slug: 'react' },
  ],
  seo: {
    metaTitle: 'Federating React 19 — notes',
    metaDescription: 'SEO description.',
    ogImage: { url: 'https://cdn.example/og.png', alternativeText: null, width: 1200, height: 630 },
  },
  body: [
    { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] },
    {
      type: 'image',
      image: { url: '/uploads/inline.png', alternativeText: 'Inline', width: 10, height: 20 },
      children: [{ type: 'text', text: '' }],
    },
  ],
};

describe('resolveMediaUrl', () => {
  it('resolves relative upload paths against the media base', () => {
    expect(resolveMediaUrl('/uploads/a.png', MEDIA_BASE)).toBe(
      'http://cms.test:1337/uploads/a.png',
    );
  });

  it('leaves absolute URLs untouched', () => {
    expect(resolveMediaUrl('https://cdn.example/a.png', MEDIA_BASE)).toBe(
      'https://cdn.example/a.png',
    );
  });
});

describe('formatDateLabel', () => {
  it('formats in UTC as "Mon D, YYYY"', () => {
    expect(formatDateLabel('2026-09-15T23:59:00.000Z')).toBe('Sep 15, 2026');
    expect(formatDateLabel('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatDateLabel('not-a-date')).toBe('');
  });
});

describe('absolutizeBlockImages', () => {
  it('rewrites only image nodes, recursively, without mutating the input', () => {
    const input = [
      { type: 'paragraph', children: [{ type: 'text', text: 'x' }] },
      { type: 'image', image: { url: '/uploads/i.png', width: 1, height: 1 }, children: [] },
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'y' }] }],
      },
    ];
    const snapshot = JSON.stringify(input);
    const out = absolutizeBlockImages(input, MEDIA_BASE) as Array<Record<string, unknown>>;
    expect((out[1].image as { url: string }).url).toBe('http://cms.test:1337/uploads/i.png');
    expect(out[0]).toEqual(input[0]);
    expect(out[2]).toEqual(input[2]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('passes through non-object input', () => {
    expect(absolutizeBlockImages(null, MEDIA_BASE)).toBeNull();
    expect(absolutizeBlockImages('text', MEDIA_BASE)).toBe('text');
  });
});

describe('mapArticle', () => {
  it('maps every field of a full article', () => {
    const post = mapArticle(raw, { mediaBase: MEDIA_BASE });
    expect(post).toEqual({
      id: 'doc-1',
      slug: 'federating-react-19',
      title: 'Federating React 19',
      excerpt: 'Why every remote bundles its own React.',
      publishedAt: '2026-09-15T08:30:00.000Z',
      dateLabel: 'Sep 15, 2026',
      readingTime: 9,
      readingLabel: '9 min',
      tags: ['Module Federation', 'React'],
      cover: {
        url: 'http://cms.test:1337/uploads/cover.png',
        alt: 'Cover art',
        width: 1200,
        height: 630,
      },
      body: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] },
        {
          type: 'image',
          image: {
            url: 'http://cms.test:1337/uploads/inline.png',
            alternativeText: 'Inline',
            width: 10,
            height: 20,
          },
          children: [{ type: 'text', text: '' }],
        },
      ],
      seo: {
        title: 'Federating React 19 — notes',
        description: 'SEO description.',
        image: {
          url: 'https://cdn.example/og.png',
          alt: 'Federating React 19',
          width: 1200,
          height: 630,
        },
      },
    });
  });

  it('fills defaults when relations and optional fields are missing', () => {
    const post = mapArticle(
      { ...raw, readingTime: null, cover: null, tags: null, seo: null, body: undefined },
      { mediaBase: MEDIA_BASE },
    );
    expect(post.readingTime).toBe(1);
    expect(post.readingLabel).toBe('1 min');
    expect(post.tags).toEqual([]);
    expect(post.cover).toBeNull();
    expect(post.body).toBeNull();
    expect(post.seo).toEqual({ title: raw.title, description: raw.excerpt, image: null });
  });

  it('uses the cover as the social image when seo has none', () => {
    const post = mapArticle(
      { ...raw, seo: { metaTitle: null, metaDescription: null, ogImage: null } },
      {
        mediaBase: MEDIA_BASE,
      },
    );
    expect(post.seo.image?.url).toBe('http://cms.test:1337/uploads/cover.png');
    expect(post.seo.title).toBe(raw.title);
  });
});
