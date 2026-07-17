import { defineRemote } from '@ncam/mf-remote';

// Framework-free remote (vanilla TS). Self-contained via defineRemote's
// shared: {}.
export default defineRemote({
  name: 'toonhub',
  port: 9001,
  baseEnv: 'TOONHUB_BASE',
  exposes: {
    './mount': './src/mount.ts',
    './hydrate': './src/hydrate.ts',
    './ssr': './src/ssr.ts',
  },
});
