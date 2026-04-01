import { test, expect } from '@playwright/test';

test.describe('Piano Roll Diagnostic', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to studio
    await page.goto('/studio', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click the Piano Roll / Melody tab
    const pianoRollTab = page.locator('button, [role="tab"]').filter({ hasText: /piano.?roll|melody/i }).first();
    if (await pianoRollTab.isVisible()) {
      await pianoRollTab.click();
      await page.waitForTimeout(1000);
    } else {
      // Try clicking a tab that might reveal piano roll
      const melodyTab = page.locator('[data-tab="melody"], [data-value="melody"], button').filter({ hasText: /melody/i }).first();
      if (await melodyTab.isVisible()) await melodyTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test('1. Piano roll canvas/grid renders', async ({ page }) => {
    // Check that the piano roll container exists and is visible
    const pianoRoll = page.locator('.piano-roll, [data-testid="piano-roll"], canvas').first();
    const gridArea = page.locator('[class*="piano"], [class*="roll"], [class*="grid"]').first();

    const hasPianoRoll = await pianoRoll.isVisible().catch(() => false)
      || await gridArea.isVisible().catch(() => false);

    // Take screenshot regardless
    await page.screenshot({ path: 'tests/screenshots/01-piano-roll-render.png', fullPage: false });

    console.log('Piano roll visible:', hasPianoRoll);
    expect(hasPianoRoll).toBe(true);
  });

  test('2. Keyboard keys are visible on left side', async ({ page }) => {
    await page.screenshot({ path: 'tests/screenshots/02-keyboard.png' });

    // Look for piano key elements
    const keys = page.locator('[class*="key"], [class*="piano-key"], [data-note]');
    const keyCount = await keys.count();
    console.log('Piano keys found:', keyCount);

    expect(keyCount).toBeGreaterThan(0);
  });

  test('3. Can click to place a note', async ({ page }) => {
    await page.screenshot({ path: 'tests/screenshots/03-before-note.png' });

    // Find the note grid area (right side of piano roll, excluding keyboard)
    const noteGrid = page.locator('[class*="note-grid"], [class*="roll-grid"], [class*="grid-area"], canvas').first();

    if (await noteGrid.isVisible().catch(() => false)) {
      const box = await noteGrid.boundingBox();
      if (box) {
        // Click in the middle of the grid
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/screenshots/03-after-note-click.png' });

        // Check if a note appeared
        const notes = page.locator('[class*="note "], [class*="note-block"], [class*="midi-note"]');
        const noteCount = await notes.count();
        console.log('Notes after click:', noteCount);
      }
    } else {
      console.log('Note grid not found with expected selectors');
      await page.screenshot({ path: 'tests/screenshots/03-grid-not-found.png', fullPage: true });
    }
  });

  test('4. Playback controls work', async ({ page }) => {
    // Find play button
    const playBtn = page.locator('button').filter({ hasText: /^play|▶/i }).first();
    const playIcon = page.locator('[aria-label*="play" i], [title*="play" i], button svg').first();

    const playVisible = await playBtn.isVisible().catch(() => false)
      || await playIcon.isVisible().catch(() => false);

    console.log('Play button visible:', playVisible);
    await page.screenshot({ path: 'tests/screenshots/04-transport.png' });
  });

  test('5. Note count and state after navigation away and back', async ({ page }) => {
    // Place a note (if grid is accessible)
    const notesBefore = await page.locator('[class*="note"]').count();

    // Navigate away (switch tabs)
    const beatTab = page.locator('button, [role="tab"]').filter({ hasText: /beat/i }).first();
    if (await beatTab.isVisible()) {
      await beatTab.click();
      await page.waitForTimeout(500);

      // Come back
      const pianoTab = page.locator('button, [role="tab"]').filter({ hasText: /piano|melody/i }).first();
      if (await pianoTab.isVisible()) {
        await pianoTab.click();
        await page.waitForTimeout(500);
      }
    }

    const notesAfter = await page.locator('[class*="note"]').count();
    console.log(`Notes before nav: ${notesBefore}, after nav: ${notesAfter}`);

    await page.screenshot({ path: 'tests/screenshots/05-after-nav.png' });

    // State should be preserved
    expect(notesAfter).toBe(notesBefore);
  });

  test('6. Console errors during piano roll use', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    // Interact with the piano roll
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(500, 300);
    await page.mouse.up();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'tests/screenshots/06-after-drag.png' });

    if (errors.length > 0) {
      console.log('ERRORS FOUND:');
      errors.forEach(e => console.log(' -', e));
    } else {
      console.log('No console errors');
    }

    // Log but don't fail on errors - we want to see them
    console.log(`Total errors: ${errors.length}`);
  });

  test('7. Full page screenshot for visual inspection', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'tests/screenshots/07-full-piano-roll.png',
      fullPage: true
    });
    console.log('Screenshot saved to tests/screenshots/07-full-piano-roll.png');
    expect(true).toBe(true);
  });
});
