import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

// Self-contained React remote — bundles its own React (shared: {} in
// defineRemote), same model as immersive-ocean / toonhub / mindloop.
export default defineRemote({
  name: 'viktor',
  port: 9004,
  baseEnv: 'VIKTOR_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react(), tailwindcss()],
});
