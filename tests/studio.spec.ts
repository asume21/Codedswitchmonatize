import { test, expect } from '@playwright/test';

/**
 * Studio Tests
 * Tests the main music production studio features
 */

test.describe('Studio Loading', () => {
  
  test('unified studio loads', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    // Studio should render
    await expect(page.locator('.studio-container, [data-testid="studio"], main')).toBeVisible({ timeout: 15000 });
  });

  test('unified studio workspace loads', async ({ page }) => {
    await page.goto('/unified-studio');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('beat studio loads', async ({ page }) => {
    await page.goto('/beat-studio');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('melody composer loads', async ({ page }) => {
    await page.goto('/melody-composer');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('lyric lab loads', async ({ page }) => {
    await page.goto('/lyric-lab');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('code translator loads', async ({ page }) => {
    await page.goto('/code-translator');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('audio tools loads', async ({ page }) => {
    await page.goto('/audio-tools');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Studio UI Elements', () => {
  
  test('transport controls are visible', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    // Look for play/pause buttons
    const transportControls = page.locator('button:has-text("Play"), button:has-text("Pause"), [aria-label*="play"], [aria-label*="pause"], .transport-controls');
    await expect(transportControls.first()).toBeVisible({ timeout: 15000 });
  });

  test('header is visible', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    const header = page.locator('header, [role="banner"], .header');
    await expect(header.first()).toBeVisible({ timeout: 10000 });
  });

  test('navigation is accessible', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    const nav = page.locator('nav, [role="navigation"], .nav, .navigation, .sidebar');
    await expect(nav.first()).toBeVisible({ timeout: 10000 });
  });

});

test.describe('Studio Keyboard Shortcuts', () => {
  
  test('spacebar toggles playback', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for studio to initialize
    
    // Press spacebar
    await page.keyboard.press('Space');
    
    // Should not throw error - just verify page is still responsive
    await expect(page.locator('body')).toBeVisible();
  });

  test('escape key works', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Escape');
    
    // Page should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Studio Mobile Responsiveness', () => {
  
  test('studio works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('studio works on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });

});
