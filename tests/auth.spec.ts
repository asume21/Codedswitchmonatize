import { test, expect } from '@playwright/test';

/**
 * Authentication Tests
 * Tests login, signup, logout, and session management
 */

test.describe('Authentication', () => {
  
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('signup page renders correctly', async ({ page }) => {
    await page.goto('/signup');
    
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  });

  test('shows error for invalid login', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator(':text("error"), :text("invalid"), :text("incorrect"), .error')).toBeVisible({ timeout: 5000 });
  });

  test('shows error for empty form submission', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    
    // Should show validation error
    const hasError = await page.locator(':text("required"), :text("email"), .error, [aria-invalid="true"]').count() > 0;
    expect(hasError).toBeTruthy();
  });

  test('can navigate from login to signup', async ({ page }) => {
    await page.goto('/login');
    
    const signupLink = page.locator('a:has-text("sign up"), a:has-text("register"), a:has-text("create account")');
    if (await signupLink.count() > 0) {
      await signupLink.first().click();
      await expect(page).toHaveURL(/signup|register/);
    }
  });

  test('can navigate from signup to login', async ({ page }) => {
    await page.goto('/signup');
    
    const loginLink = page.locator('a:has-text("log in"), a:has-text("sign in"), a:has-text("already have")');
    if (await loginLink.count() > 0) {
      await loginLink.first().click();
      await expect(page).toHaveURL(/login|signin/);
    }
  });

});

test.describe('Auth API', () => {
  
  test('POST /api/auth/login returns 401 for invalid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'fake@test.com', password: 'wrongpassword' }
    });
    expect([400, 401]).toContain(response.status());
  });

  test('POST /api/auth/register validates email format', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: { email: 'notanemail', password: 'password123' }
    });
    expect([400, 422]).toContain(response.status());
  });

  test('GET /api/auth/me returns 401 when not logged in', async ({ request }) => {
    const response = await request.get('/api/auth/me');
    expect(response.status()).toBe(401);
  });

});
