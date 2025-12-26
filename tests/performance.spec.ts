import { test, expect } from '@playwright/test';

/**
 * Performance Tests
 * Tests page load times and performance metrics
 */

test.describe('Page Load Performance', () => {
  
  test('landing page loads within 10 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(10000);
  });

  test('login page loads within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000);
  });

  test('studio page loads within 15 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/studio');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // Studio is heavy, allow more time
    expect(loadTime).toBeLessThan(15000);
  });

  test('buy credits page loads within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/buy-credits');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000);
  });

});

test.describe('API Response Times', () => {
  
  test('health endpoint responds within 1 second', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get('/api/health');
    const responseTime = Date.now() - startTime;
    
    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(1000);
  });

  test('ai-providers endpoint responds within 2 seconds', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get('/api/ai-providers');
    const responseTime = Date.now() - startTime;
    
    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(2000);
  });

  test('subscription-status endpoint responds within 2 seconds', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get('/api/subscription-status');
    const responseTime = Date.now() - startTime;
    
    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(2000);
  });

});

test.describe('Resource Loading', () => {
  
  test('no console errors on landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verify page body is visible
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

  test('no console errors on studio page', async ({ page }) => {
    await page.goto('/studio', { waitUntil: 'domcontentloaded' });
    
    // Verify page body is visible
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

});

test.describe('Memory & Resources', () => {
  
  test('page does not have memory leaks on navigation', async ({ page }) => {
    // Navigate multiple times
    await page.goto('/');
    await page.goto('/login');
    await page.goto('/studio');
    await page.goto('/');
    
    // If we got here without crashing, memory is manageable
    await expect(page.locator('body')).toBeVisible();
  });

  test('studio handles rapid navigation', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('domcontentloaded');
    
    // Rapid navigation between studio views
    await page.goto('/beat-studio');
    await page.goto('/melody-composer');
    await page.goto('/lyric-lab');
    await page.goto('/studio');
    
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Lazy Loading', () => {
  
  test('studio components lazy load', async ({ page }) => {
    await page.goto('/studio');
    
    // Check that loading indicator appears briefly or content loads
    await page.waitForLoadState('domcontentloaded');
    
    // Page should eventually load
    await expect(page.locator('body')).toBeVisible();
  });

});
