import { defineConfig } from 'vitest/config';

// Unit tests for the shared packages and for apps/strapi's pure helpers (reading time,
// permission bootstrap, env template). All are plain Node logic (no DOM). Component/mount
// smoke tests and end-to-end federation checks are best added separately (e.g. Playwright)
// and would use the jsdom environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/strapi/**/*.test.ts'],
    passWithNoTests: false,
    clearMocks: true,
  },
});
