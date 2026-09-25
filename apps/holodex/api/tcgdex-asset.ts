import { handleAssetProxy } from '../src/lib/asset-proxy.js';

/**
 * The TCGdex asset proxy (src/lib/asset-proxy.ts) as a Vercel Function, at
 * /api/tcgdex-asset, its route: a card's texture asks here first. The Vite
 * dev and preview servers answer the same route with the same handler
 * (vite.config.ts). vercel.json keeps its blanket Allow-Origin header off
 * /api, so the handler's own is the only one.
 */
export default {
  fetch(request: Request): Promise<Response> {
    return handleAssetProxy(request);
  },
};
