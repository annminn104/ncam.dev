import { handleSpotify } from '../src/server/spotify-handler.js';

/**
 * The Spotify proxy (src/server/spotify-handler.ts) as a Vercel Function at /api/spotify. The Vite
 * dev and preview servers answer the same route with the same handler (vite.config.ts).
 * vercel.json keeps its blanket Allow-Origin header off /api, so the handler's own is the only one.
 * Its graph's runtime imports end in .js: Node ESM in the Function resolves specifiers as written.
 */
export default {
  fetch(request: Request): Promise<Response> {
    return handleSpotify(request);
  },
};
