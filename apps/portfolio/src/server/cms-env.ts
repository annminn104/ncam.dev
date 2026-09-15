/**
 * Where the server finds the CMS. Read at request time from process.env so the
 * same build runs everywhere (Vercel env, docker-compose `environment`, shell).
 * The monorepo root `.env` is NOT loaded by the Nitro server, hence the local
 * default. Server-only: only import this from server-function handlers.
 */
export interface CmsEnv {
  /** Origin the server fetches from, e.g. http://strapi:1337 inside Docker. */
  apiBase: string;
  /** Origin browsers can reach for media, e.g. http://cms.localhost:1337. */
  mediaBase: string;
}

export const DEFAULT_STRAPI_URL = 'http://localhost:1337';

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

let warnedMissingUrl = false;

export function getCmsEnv(env: NodeJS.ProcessEnv = process.env): CmsEnv {
  const configured = env.STRAPI_URL?.trim();
  if (!configured && env.NODE_ENV === 'production' && !warnedMissingUrl) {
    console.warn(`[cms] STRAPI_URL is not set — falling back to ${DEFAULT_STRAPI_URL}`);
    warnedMissingUrl = true;
  }
  const apiBase = trimSlash(configured || DEFAULT_STRAPI_URL);
  const mediaBase = trimSlash(env.STRAPI_PUBLIC_URL?.trim() || apiBase);
  return { apiBase, mediaBase };
}
