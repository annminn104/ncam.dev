import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Public origin behind the nginx gateway / in Docker. `RENDER_EXTERNAL_URL` is
  // injected by Render with the service's own public URL, so a Render deploy is
  // correct without setting PUBLIC_URL by hand; an explicit value still wins,
  // which is what a custom domain needs. Empty everywhere becomes undefined, so
  // Strapi derives URLs from the incoming request (local dev).
  url: env('PUBLIC_URL') || env('RENDER_EXTERNAL_URL') || undefined,
  app: {
    keys: env.array('APP_KEYS')!,
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});

export default config;
