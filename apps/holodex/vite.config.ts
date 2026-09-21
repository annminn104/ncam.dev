import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

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
  plugins: [react(), tailwindcss()],
});
