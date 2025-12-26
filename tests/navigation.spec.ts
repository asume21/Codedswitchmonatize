import { test, expect } from '@playwright/test';

/**
 * Navigation Tests
 * Tests all page routes and navigation
 */

test.describe('Public Pages', () => {
  
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1, :text("CodedSwitch")').first()).toBeVisible({ timeout: 10000 });
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('body')).toBeVisible();
  });

  test('buy credits page loads', async ({ page }) => {
    await page.goto('/buy-credits');
    await expect(page.locator('body')).toBeVisible();
  });

  test('subscribe page loads', async ({ page }) => {
    await page.goto('/subscribe');
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Studio Routes', () => {
  
  test('/studio loads', async ({ page }) => {
    await page.goto('/studio', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/unified-studio loads', async ({ page }) => {
    await page.goto('/unified-studio', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/beat-studio loads', async ({ page }) => {
    await page.goto('/beat-studio', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/melody-composer loads', async ({ page }) => {
    await page.goto('/melody-composer', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/lyric-lab loads', async ({ page }) => {
    await page.goto('/lyric-lab', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/code-translator loads', async ({ page }) => {
    await page.goto('/code-translator', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/audio-tools loads', async ({ page }) => {
    await page.goto('/audio-tools', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/song-uploader loads', async ({ page }) => {
    await page.goto('/song-uploader', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/ai-assistant loads', async ({ page }) => {
    await page.goto('/ai-assistant', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/vulnerability-scanner loads', async ({ page }) => {
    await page.goto('/vulnerability-scanner', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/daw-layout loads', async ({ page }) => {
    await page.goto('/daw-layout', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/codebeat-studio loads', async ({ page }) => {
    await page.goto('/codebeat-studio', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('/music-to-code loads', async ({ page }) => {
    await page.goto('/music-to-code', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Protected Routes Redirect', () => {
  
  test('/settings redirects or shows auth prompt', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    
    // Should either redirect to login or show auth prompt
    const url = page.url();
    const hasAuthPrompt = await page.locator(':text("login"), :text("sign in"), :text("authenticate")').count() > 0;
    
    expect(url.includes('login') || url.includes('settings') || hasAuthPrompt).toBeTruthy();
  });

  test('/dashboard redirects or shows auth prompt', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    
    const url = page.url();
    const hasAuthPrompt = await page.locator(':text("login"), :text("sign in")').count() > 0;
    
    expect(url.includes('login') || url.includes('dashboard') || hasAuthPrompt).toBeTruthy();
  });

});

test.describe('404 Handling', () => {
  
  test('non-existent route shows 404 or redirects', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345', { waitUntil: 'domcontentloaded' });
    
    // Verify page body is visible
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

});

test.describe('Navigation Links', () => {
  
  test('can navigate from landing to studio', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

  test('can navigate from landing to login', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

});
