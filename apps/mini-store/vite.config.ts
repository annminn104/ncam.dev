import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

// Self-contained React remote — bundles its own React (shared: {} in
// defineRemote), same model as viktor / bali / chess. The WebGL engine is a
// lazy chunk of its own: nothing of it loads before the visitor's first
// interaction (src/App.tsx).
export default defineRemote({
  name: 'mini_store',
  port: 9009,
  baseEnv: 'MINI_STORE_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react()],
});
