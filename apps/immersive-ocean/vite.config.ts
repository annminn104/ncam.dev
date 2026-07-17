import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

// Self-contained React remote — bundles its own React (shared: {} in
// defineRemote), same model as toonhub / mindloop.
export default defineRemote({
  name: 'immersive_ocean',
  port: 9003,
  baseEnv: 'IMMERSIVE_OCEAN_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react(), tailwindcss()],
});
