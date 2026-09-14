import { describe, expect, it, vi } from 'vitest';
import type { Core } from '@strapi/strapi';
import { PUBLIC_READ_ACTIONS, ensurePublicReadPermissions } from './public-permissions';

interface Fake {
  strapi: Core.Strapi;
  created: Array<{ action: string; role: number }>;
  log: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
}

/** Minimal stand-in for `strapi.db.query()` + `strapi.log`. */
function fakeStrapi(options: { role: { id: number } | null; existing: string[] }): Fake {
  const created: Fake['created'] = [];
  const log = { info: vi.fn(), warn: vi.fn() };
  const strapi = {
    db: {
      query: (uid: string) => ({
        findOne: vi.fn(async () =>
          uid === 'plugin::users-permissions.role' ? options.role : null,
        ),
        findMany: vi.fn(async () => options.existing.map((action) => ({ action }))),
        create: vi.fn(async ({ data }: { data: { action: string; role: number } }) => {
          created.push(data);
          return data;
        }),
      }),
    },
    log,
  };
  return { strapi: strapi as unknown as Core.Strapi, created, log };
}

describe('PUBLIC_READ_ACTIONS', () => {
  it('covers find + findOne for article and tag only', () => {
    expect([...PUBLIC_READ_ACTIONS]).toEqual([
      'api::article.article.find',
      'api::article.article.findOne',
      'api::tag.tag.find',
      'api::tag.tag.findOne',
    ]);
  });
});

describe('ensurePublicReadPermissions', () => {
  it('grants every read action on a fresh database', async () => {
    const { strapi, created, log } = fakeStrapi({ role: { id: 2 }, existing: [] });
    const added = await ensurePublicReadPermissions(strapi);
    expect(added).toEqual([...PUBLIC_READ_ACTIONS]);
    expect(created.map((c) => c.action)).toEqual([...PUBLIC_READ_ACTIONS]);
    expect(created.every((c) => c.role === 2)).toBe(true);
    expect(log.info).toHaveBeenCalledOnce();
  });

  it('adds only the missing actions', async () => {
    const { strapi, created } = fakeStrapi({
      role: { id: 2 },
      existing: ['api::article.article.find', 'api::tag.tag.find', 'api::tag.tag.findOne'],
    });
    expect(await ensurePublicReadPermissions(strapi)).toEqual(['api::article.article.findOne']);
    expect(created).toHaveLength(1);
  });

  it('is a silent no-op when everything is already granted', async () => {
    const { strapi, created, log } = fakeStrapi({
      role: { id: 2 },
      existing: [...PUBLIC_READ_ACTIONS],
    });
    expect(await ensurePublicReadPermissions(strapi)).toEqual([]);
    expect(created).toHaveLength(0);
    expect(log.info).not.toHaveBeenCalled();
  });

  it('warns and grants nothing when the Public role is missing', async () => {
    const { strapi, created, log } = fakeStrapi({ role: null, existing: [] });
    expect(await ensurePublicReadPermissions(strapi)).toEqual([]);
    expect(created).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledOnce();
  });
});
