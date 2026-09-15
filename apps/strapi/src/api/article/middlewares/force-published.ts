import type { Core } from '@strapi/strapi';

/**
 * The public read routes only ever serve published content. Strapi accepts a
 * `status=draft` query parameter even from anonymous callers, so the status is
 * forced here before the core controller reads `ctx.query`.
 */
export function forcePublished(query: Record<string, unknown>): void {
  query.status = 'published';
}

const middleware: Core.MiddlewareFactory = () => async (ctx, next) => {
  forcePublished(ctx.query as Record<string, unknown>);
  await next();
};

export default middleware;
