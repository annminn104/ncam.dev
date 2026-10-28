import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

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
  plugins: [react()],
});
