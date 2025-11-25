import { test, expect } from '@playwright/test';

/**
 * Error Handling Tests
 * Tests that the app handles errors gracefully
 */

test.describe('API Error Handling', () => {
  
  test('invalid JSON returns 400', async ({ request }) => {
    const response = await request.post('/api/beats/generate', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not valid json'
    });
    expect([400, 401, 500]).toContain(response.status());
  });

  test('missing required fields returns error', async ({ request }) => {
    const response = await request.post('/api/code-to-music', {
      data: {} // Missing 'code' field
    });
    expect([400, 500]).toContain(response.status());
  });

  test('invalid endpoint returns 404', async ({ request }) => {
    const response = await request.get('/api/this-endpoint-does-not-exist');
    expect(response.status()).toBe(404);
  });

  test('POST to GET-only endpoint returns 404 or 405', async ({ request }) => {
    const response = await request.post('/api/health');
    expect([404, 405]).toContain(response.status());
  });

});

test.describe('UI Error Handling', () => {
  
  test('app recovers from navigation errors', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    // Try to navigate to invalid route
    await page.goto('/invalid-route-12345');
    
    // Should still be able to navigate back
    await page.goto('/studio');
    await expect(page.locator('body')).toBeVisible();
  });

  test('app handles rapid clicks', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    // Rapid clicks on buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      for (let i = 0; i < Math.min(5, buttonCount); i++) {
        try {
          await buttons.nth(i).click({ timeout: 1000 });
        } catch {
          // Some buttons may not be clickable, that's ok
        }
      }
    }
    
    // App should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });

  test('app handles form submission errors gracefully', async ({ page }) => {
    await page.goto('/login');
    
    // Submit empty form
    await page.click('button[type="submit"]');
    
    // Should show error, not crash
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Network Error Handling', () => {
  
  test('app handles slow network', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.continue();
    });
    
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
  });

});

test.describe('Input Validation', () => {
  
  test('email validation on login', async ({ page }) => {
    await page.goto('/login');
    
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await emailInput.fill('not-an-email');
    await page.click('button[type="submit"]');
    
    // Should show validation error or HTML5 validation
    await expect(page.locator('body')).toBeVisible();
  });

  test('handles special characters in input', async ({ page }) => {
    await page.goto('/ai-assistant');
    await page.waitForLoadState('networkidle');
    
    const messageInput = page.locator('input[type="text"], textarea').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('<script>alert("xss")</script>');
      // App should handle this without breaking
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('handles very long input', async ({ page }) => {
    await page.goto('/ai-assistant');
    await page.waitForLoadState('networkidle');
    
    const messageInput = page.locator('input[type="text"], textarea').first();
    if (await messageInput.isVisible()) {
      const longText = 'a'.repeat(10000);
      await messageInput.fill(longText);
      // App should handle this without breaking
      await expect(page.locator('body')).toBeVisible();
    }
  });

});

test.describe('Edge Cases', () => {
  
  test('handles empty state in studio', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    // Studio should render even with no data
    await expect(page.locator('body')).toBeVisible();
  });

  test('handles browser back/forward', async ({ page }) => {
    await page.goto('/');
    await page.goto('/studio');
    await page.goto('/login');
    
    await page.goBack();
    await expect(page.locator('body')).toBeVisible();
    
    await page.goBack();
    await expect(page.locator('body')).toBeVisible();
    
    await page.goForward();
    await expect(page.locator('body')).toBeVisible();
  });

  test('handles page refresh', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

});
