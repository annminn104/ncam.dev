import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 800 },
    // Deterministic software WebGL so the run does not depend on the GPU.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'pnpm build && pnpm exec vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
