import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';
import { defineRemote } from '@ncam/mf-remote';
import { ASSET_PROXY_ROUTE, handleAssetProxy } from './src/lib/asset-proxy';

/**
 * The TCGdex asset proxy (src/lib/asset-proxy.ts) on the dev and preview
 * servers, at the route the deployed Vercel Function (api/tcgdex-asset.ts)
 * answers. A plugin's middleware runs ahead of Vite's own, its cors included,
 * so the answer carries the handler's headers and nothing else.
 */
function tcgdexAssetProxy(): Plugin {
  const serve = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== ASSET_PROXY_ROUTE) return next();
      handleAssetProxy(new Request(url, { method: req.method }))
        .then(async (response) => {
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        })
        .catch(next);
    });
  };
  return {
    name: 'holodex:tcgdex-asset-proxy',
    configureServer: (server) => serve(server.middlewares),
    configurePreviewServer: (server) => serve(server.middlewares),
  };
}

// Self-contained React remote — bundles its own React (shared: {} in
// defineRemote), same model as bali / viktor / mindloop / immersive-ocean.
export default defineRemote({
  name: 'holodex',
  port: 9007,
  baseEnv: 'HOLODEX_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react(), tailwindcss(), tcgdexAssetProxy()],
});
