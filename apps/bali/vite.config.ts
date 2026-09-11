import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

// Self-contained React remote — bundles its own React (shared: {} in
// defineRemote), same model as viktor / mindloop / immersive-ocean / toonhub.
export default defineRemote({
  name: 'bali',
  port: 9005,
  baseEnv: 'BALI_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react(), tailwindcss()],
});
