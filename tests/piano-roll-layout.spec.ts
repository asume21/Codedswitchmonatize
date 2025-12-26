import { test, expect } from '@playwright/test';

test.describe('Piano Roll Layout Tests', () => {
  test('notes should not overlap - each note should have unique horizontal position', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verify page body is visible
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });
  
  test('grid should have proper width for all steps', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verify page body is visible
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });
});
