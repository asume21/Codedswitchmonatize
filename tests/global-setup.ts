/**
 * Global Playwright setup — registers + logs in a test user and saves
 * the browser storage state so all tests that need auth can reuse it
 * without repeating the login flow.
 */

import { chromium, FullConfig } from '@playwright/test';

const TEST_EMAIL    = process.env.TEST_EMAIL    || 'playwright-test@codedswitch.test';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPass123!';
const API_BASE      = process.env.API_BASE_URL  || 'http://localhost:4000';
const BASE_URL      = process.env.BASE_URL      || 'http://localhost:5000';

export default async function globalSetup(_config: FullConfig) {
  // Try to register the test user (safe to fail if already exists)
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, username: 'playwright-test' }),
    });
    if (!res.ok && res.status !== 409) {
      console.warn('[setup] register:', res.status, await res.text());
    }
  } catch {
    // Server may not be up yet — the webServer config will start it
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.includes('login'), { timeout: 15000 }).catch(() => {
    // Login may fail in test env — continue anyway (tests skip if auth unavailable)
  });

  await context.storageState({ path: 'tests/.auth/user.json' });
  await browser.close();
}
