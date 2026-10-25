import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

// Self-contained React remote: bundles its own React, three and R3F (shared: {} in defineRemote),
// the same model as chess and mini-store.
export default defineRemote({
  name: 'garden_home',
  port: 9010,
  baseEnv: 'GARDEN_HOME_BASE',
  exposes: {
    './mount': './src/mount.tsx',
  },
  plugins: [react()],
});
