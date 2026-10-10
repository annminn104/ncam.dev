import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

// Self-contained React remote — bundles its own React and three (shared: {} in
// defineRemote), same model as viktor / bali / holodex.
export default defineRemote({
  name: 'chess',
  port: 9008,
  baseEnv: 'CHESS_BASE',
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react()],
});
