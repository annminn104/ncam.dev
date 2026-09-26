import { defineConfig } from 'vitest/config';

// Unit tests for the shared packages, for apps/strapi's pure helpers (reading time,
// permission bootstrap, env template) and for the apps' Node helper scripts (asset
// downloads). All are plain Node logic (no DOM). Component/mount smoke tests and
// end-to-end federation checks are best added separately (e.g. Playwright) and would use
// the jsdom environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/strapi/**/*.test.ts',
      'apps/*/scripts/**/*.test.ts',
      'apps/holodex/src/**/*.test.ts',
      'apps/portfolio/src/lib/**/*.test.ts',
    ],
    passWithNoTests: false,
    clearMocks: true,
  },
});
