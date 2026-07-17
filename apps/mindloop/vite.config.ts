import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

// Self-contained React remote — bundles its own React (shared: {} in
// defineRemote), so it runs standalone and mounts in the host without any
// shared-singleton races. Same model as toonhub.
export default defineRemote({
  name: 'mindloop',
  port: 9002,
  baseEnv: 'MINDLOOP_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react(), tailwindcss()],
});
