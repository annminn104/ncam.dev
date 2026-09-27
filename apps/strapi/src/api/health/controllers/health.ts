import type { Core } from '@strapi/strapi';

/** The part of Koa's context the health check writes. */
export interface HealthContext {
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/**
 * Answer `GET /api/health`: 200 when the database answers a trivial query, 503
 * when it does not. Strapi's own `/_health` only proves the process is up; this
 * also exercises the database the content API reads from. Anyone can call it,
 * so the body says whether the database answered and nothing about why not.
 */
export async function checkHealth(
  ctx: HealthContext,
  pingDatabase: () => Promise<unknown>,
  onError?: (error: unknown) => void,
): Promise<void> {
  ctx.set('Cache-Control', 'no-store');
  const uptime = Math.round(process.uptime());
  try {
    await pingDatabase();
    ctx.status = 200;
    ctx.body = { status: 'ok', database: 'ok', uptime };
  } catch (error) {
    onError?.(error);
    ctx.status = 503;
    ctx.body = { status: 'error', database: 'unreachable', uptime };
  }
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async check(ctx: HealthContext) {
    await checkHealth(
      ctx,
      () => strapi.db.connection.raw('select 1'),
      (error) => strapi.log.warn(`health check: the database did not answer: ${String(error)}`),
    );
  },
});
