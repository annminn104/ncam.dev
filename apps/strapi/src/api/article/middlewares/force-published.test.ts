import { describe, expect, it, vi } from 'vitest';
import middleware, { forcePublished } from './force-published';

describe('forcePublished', () => {
  it('overrides a caller-supplied status and keeps every other param', () => {
    const query: Record<string, unknown> = {
      status: 'draft',
      sort: 'publishedAt:desc',
      filters: { slug: { $eq: 'hello' } },
    };
    forcePublished(query);
    expect(query).toEqual({
      status: 'published',
      sort: 'publishedAt:desc',
      filters: { slug: { $eq: 'hello' } },
    });
  });

  it('adds status=published when the caller sent none', () => {
    const query: Record<string, unknown> = {};
    forcePublished(query);
    expect(query.status).toBe('published');
  });
});

describe('force-published middleware', () => {
  it('mutates ctx.query in place and calls next exactly once', async () => {
    const ctx = { query: { status: 'draft' } };
    const next = vi.fn(async () => {});
    const handler = middleware({}, { strapi: {} as never });
    await handler(ctx as never, next);
    expect(ctx.query.status).toBe('published');
    expect(next).toHaveBeenCalledOnce();
  });
});
