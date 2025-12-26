import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    // Frontend runs on Vite (5000 per vite.config.ts); API tests use full URLs
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    // Wait for the Vite dev server (frontend) that Playwright pages hit
    url: process.env.BASE_URL || 'http://localhost:5000',
    reuseExistingServer: true,
    timeout: 150000,
    env: {
      PLAYWRIGHT: 'true',
      DISABLE_DEV_AUTO_LOGIN: 'true',
      NODE_ENV: process.env.NODE_ENV || 'test',
    },
  },
});
