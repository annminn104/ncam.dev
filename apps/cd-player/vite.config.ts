import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';
import { defineRemote } from '@ncam/mf-remote';
import { handleSpotify } from './src/server/spotify-handler.js';
import { SPOTIFY_ROUTE } from './src/spotify/api-route.js';

/**
 * The Spotify proxy on the dev and preview servers, at the route the deployed Vercel Function
 * (api/spotify.ts) answers. Vite's own cors middleware (on, from defineRemote) runs ahead of a
 * plugin's: it answers a preflight itself, so OPTIONS reaches the handler only on Vercel, and on
 * any other request the handler's headers replace its Allow-Origin rather than double it.
 */
function spotifyProxy(): Plugin {
  const serve = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== SPOTIFY_ROUTE) return next();
      handleSpotify(new Request(url, { method: req.method }))
        .then(async (response) => {
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        })
        .catch(next);
    });
  };
  return {
    name: 'cd-player:spotify-proxy',
    configureServer: (server) => serve(server.middlewares),
    configurePreviewServer: (server) => serve(server.middlewares),
  };
}

// Self-contained React remote: bundles its own React, three and R3F (shared: {} in defineRemote),
// the same model as chess and garden-home.
export default defineRemote({
  name: 'cd_player',
  port: 9011,
  baseEnv: 'CD_PLAYER_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react(), spotifyProxy()],
});
