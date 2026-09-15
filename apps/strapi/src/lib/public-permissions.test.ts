import { describe, expect, it, vi } from 'vitest';
import type { Core } from '@strapi/strapi';
import { PUBLIC_READ_ACTIONS, ensurePublicReadPermissions } from './public-permissions';

interface Fake {
  strapi: Core.Strapi;
  created: Array<{ action: string; role: number }>;
  log: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
}

/** Minimal stand-in for `strapi.db.query()` + `strapi.log`, scoped by the `where` clause. */
function fakeStrapi(options: {
  role: { id: number } | null;
  existing: Array<{ action: string; roleId: number }>;
}): Fake {
  const created: Fake['created'] = [];
  const log = { info: vi.fn(), warn: vi.fn() };
  const strapi = {
    db: {
      query: (uid: string) => ({
        findOne: vi.fn(async ({ where }: { where: { type: string } }) =>
          uid === 'plugin::users-permissions.role' && where.type === 'public' ? options.role : null,
        ),
        findMany: vi.fn(
          async ({ where }: { where: { role: { id: number }; action: { $in: string[] } } }) =>
            options.existing
              .filter(
                (permission) =>
                  permission.roleId === where.role.id &&
                  where.action.$in.includes(permission.action),
              )
              .map((permission) => ({ action: permission.action })),
        ),
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
      existing: [
        { action: 'api::article.article.find', roleId: 2 },
        { action: 'api::tag.tag.find', roleId: 2 },
        { action: 'api::tag.tag.findOne', roleId: 2 },
      ],
    });
    expect(await ensurePublicReadPermissions(strapi)).toEqual(['api::article.article.findOne']);
    expect(created).toHaveLength(1);
  });

  it('ignores permissions that belong to a different role', async () => {
    const { strapi, created } = fakeStrapi({
      role: { id: 2 },
      existing: [{ action: 'api::article.article.find', roleId: 1 }],
    });
    expect(await ensurePublicReadPermissions(strapi)).toEqual([...PUBLIC_READ_ACTIONS]);
    expect(created).toHaveLength(4);
    expect(created.every((c) => c.role === 2)).toBe(true);
  });

  it('is a silent no-op when everything is already granted', async () => {
    const { strapi, created, log } = fakeStrapi({
      role: { id: 2 },
      existing: PUBLIC_READ_ACTIONS.map((action) => ({ action, roleId: 2 })),
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
