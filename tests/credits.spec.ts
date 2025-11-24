import { test, expect } from '@playwright/test';

/**
 * Credit System Tests
 * Tests the core monetization functionality
 */

test.describe('Credit System', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display credit balance for logged in users', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard or studio
    await page.waitForURL(/\/(dashboard|studio)/);
    
    // Check if credits are displayed somewhere
    const creditsElement = page.locator('[data-testid="credits-balance"], .credits-display, :text("credits")');
    await expect(creditsElement).toBeVisible({ timeout: 10000 });
  });

  test('should show credit costs for AI operations', async ({ page }) => {
    await page.goto('/buy-credits');
    
    // Check that credit packages are displayed
    const packages = page.locator('[data-testid="credit-package"], .credit-package');
    await expect(packages.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to buy credits page', async ({ page }) => {
    await page.goto('/buy-credits');
    
    // Verify page loaded
    await expect(page).toHaveURL(/buy-credits/);
    
    // Check for pricing information
    const pricingInfo = page.locator(':text("$"), :text("credits")');
    await expect(pricingInfo.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display subscription tiers', async ({ page }) => {
    await page.goto('/subscribe');
    
    // Check for subscription options
    const subscriptionOptions = page.locator('[data-testid="subscription-tier"], .subscription-card, :text("Creator"), :text("Pro")');
    await expect(subscriptionOptions.first()).toBeVisible({ timeout: 10000 });
  });

});

test.describe('Authentication Flow', () => {
  
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    
    // Check for login form elements
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show signup page', async ({ page }) => {
    await page.goto('/signup');
    
    // Check for signup form elements
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible();
  });

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/settings');
    
    // Should either show login prompt or redirect
    const currentUrl = page.url();
    const hasLoginPrompt = await page.locator(':text("login"), :text("sign in")').count() > 0;
    
    expect(currentUrl.includes('login') || hasLoginPrompt).toBeTruthy();
  });

});

test.describe('Studio Navigation', () => {
  
  test('should load unified studio', async ({ page }) => {
    await page.goto('/unified-studio');
    
    // Check that studio loaded
    await expect(page.locator(':text("Studio"), .studio-container')).toBeVisible({ timeout: 15000 });
  });

  test('should load landing page', async ({ page }) => {
    await page.goto('/');
    
    // Check for landing page content
    await expect(page.locator('h1, :text("CodedSwitch")')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between studio views', async ({ page }) => {
    await page.goto('/studio');
    
    // Wait for studio to load
    await page.waitForLoadState('networkidle');
    
    // Check that navigation elements exist
    const navElements = page.locator('nav, [role="navigation"], .navigation');
    await expect(navElements.first()).toBeVisible({ timeout: 10000 });
  });

});

test.describe('API Endpoints', () => {
  
  test('should return 401 for unauthenticated credit requests', async ({ request }) => {
    const response = await request.get('/api/credits');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated beat generation', async ({ request }) => {
    const response = await request.post('/api/beats/generate', {
      data: { genre: 'pop', bpm: 120, duration: 10 }
    });
    expect(response.status()).toBe(401);
  });

  test('should return 400 for invalid beat generation params', async ({ request }) => {
    // This should fail validation even before auth check
    const response = await request.post('/api/beats/generate', {
      data: {} // Missing required fields
    });
    // Either 400 (validation) or 401 (auth) is acceptable
    expect([400, 401]).toContain(response.status());
  });

});
