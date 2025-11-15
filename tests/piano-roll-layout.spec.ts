import { test, expect } from '@playwright/test';

test.describe('Piano Roll Layout Tests', () => {
  test('notes should not overlap - each note should have unique horizontal position', async ({ page }) => {
    await page.goto('http://localhost:3211');
    
    // Wait for piano roll to load
    await page.waitForSelector('[data-testid="piano-roll"]', { timeout: 10000 });
    
    // Get all note elements
    const notes = await page.locator('.piano-roll-note').all();
    
    if (notes.length > 1) {
      // Get positions of all notes
      const positions = await Promise.all(
        notes.map(async (note) => {
          const box = await note.boundingBox();
          return box ? { left: box.x, width: box.width } : null;
        })
      );
      
      // Check that no two notes have the same left position
      const leftPositions = positions
        .filter(p => p !== null)
        .map(p => Math.round(p!.left));
      
      const uniquePositions = new Set(leftPositions);
      
      expect(uniquePositions.size).toBe(leftPositions.length);
      
      console.log('Note positions:', leftPositions);
    }
  });
  
  test('grid should have proper width for all steps', async ({ page }) => {
    await page.goto('http://localhost:3211');
    
    await page.waitForSelector('[data-testid="piano-roll-grid"]', { timeout: 10000 });
    
    const grid = page.locator('[data-testid="piano-roll-grid"]');
    const box = await grid.boundingBox();
    
    // Grid should be at least 32 steps * 40px = 1280px wide
    expect(box?.width).toBeGreaterThanOrEqual(1280);
  });
});
