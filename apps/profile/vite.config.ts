import react from '@vitejs/plugin-react';
import { defineRemote } from '@ncam/mf-remote';

// Self-contained React remote (bundles its own React + GSAP, `shared: {}` in
// defineRemote). Unlike the project remotes it exposes one module PER SECTION of
// the home page; every module has the same shape: { ssr, hydrate, mount }.
//
// Chunking note: the federation plugin owns chunk grouping (it ignores
// `manualChunks` / `codeSplitting.groups`). The SSR entry loader on the host
// cannot resolve cyclic chunks, so `src/modules/*` keep the lazy
// `import('react-dom/server')` in the entry files — see src/lib/section-module.tsx.
export default defineRemote({
  name: 'profile',
  port: 9006,
  baseEnv: 'PROFILE_BASE',
  exposes: {
    './hero': './src/modules/hero.tsx',
    './stacks': './src/modules/stacks.tsx',
    './experience': './src/modules/experience.tsx',
    './projects': './src/modules/projects.tsx',
    './blog': './src/modules/blog.tsx',
    './contact': './src/modules/contact.tsx',
  },
  plugins: [react()],
});
