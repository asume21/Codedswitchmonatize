import { defineConfig, devices } from '@playwright/test';

/** Lightweight config for organism audio-leak tests only.
 *  No global-setup (no auth needed — runs as guest).
 *  Points at the already-running dev server. */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/organism-audio-leak.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 90000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5001',
    trace: 'on-first-retry',
    // No storageState — guest mode
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Expose GC so tests can call gc() between cycles for deterministic counts
        launchOptions: {
          args: ['--js-flags=--expose-gc'],
        },
      },
    },
  ],

  // Reuse the already-running server — don't spin up a new one
  webServer: {
    command: 'echo "using existing server"',
    url: process.env.BASE_URL || 'http://localhost:5001',
    reuseExistingServer: true,
    timeout: 5000,
  },
});
