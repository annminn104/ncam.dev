import { defineConfig } from 'vitest/config';

// Unit tests for the shared packages. These are pure logic (no DOM), so they run
// in Node. Component/mount smoke tests and end-to-end federation checks are best
// added separately (e.g. Playwright), and would use the jsdom environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
    passWithNoTests: false,
    clearMocks: true,
  },
});
