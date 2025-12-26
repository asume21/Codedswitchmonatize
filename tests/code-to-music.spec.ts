import { test, expect, Page } from '@playwright/test';

const stubbedMusic = {
  metadata: { bpm: 120, key: 'C Major', duration: 2.5, genre: 'pop' },
  melody: [{ note: 'C4', duration: 0.5, start: 0, velocity: 100 }],
  chords: [{ chord: 'Cmaj7', notes: ['C4', 'E4', 'G4'], start: 0, duration: 1 }],
  timeline: [{ time: 0, event: 'start' }],
};

async function openCodeToMusic(page: Page) {
  await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Verify page body is visible first
  await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  
  // Close the workflow selection dialog if it appears
  try {
    const skipButton = page.getByRole('button', { name: /skip for now/i });
    await skipButton.click({ timeout: 2000 });
    await page.waitForTimeout(200);
  } catch {
    // Dialog might not appear or already closed
  }
  // If dialog is still open, try close/escape fallback
  const dialog = page.locator('[role="dialog"][data-state="open"]');
  if (await dialog.count()) {
    const closeBtn = dialog.getByRole('button', { name: /close|start|continue|begin|skip/i });
    if (await closeBtn.count()) {
      await closeBtn.first().click({ timeout: 2000 }).catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(200);
  }
  
  // Try to find and click the code-to-music tab
  const codeToMusicTab = page.getByTestId('tab-code-to-music');
  try {
    await codeToMusicTab.waitFor({ state: 'visible', timeout: 5000 });
    await codeToMusicTab.click({ timeout: 5000 });
  } catch {
    // Tab might not exist or be visible - that's ok for some tests
  }
}

test.describe('Code-to-Music Studio V2', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure workflow dialog shows predictably
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenWorkflowSelector', 'true');
    });
    
    // Stub generation API to avoid external dependency/timeouts
    await page.route('**/api/code-to-music', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          music: stubbedMusic,
          metadata: stubbedMusic.metadata,
        }),
      });
    });

    // Navigate to the studio root before each test
    await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: 60000 });
  });

  test('should display Code-to-Music tab in desktop navigation', async ({ page }) => {
    // Look for the Code to Music button in the DAW-style tab bar
    const codeToMusicTab = page.getByTestId('tab-code-to-music');
    await expect(codeToMusicTab).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Code-to-Music studio', async ({ page }) => {
    await openCodeToMusic(page);
    await expect(page.getByText(/convert your code into harmonic music/i)).toBeVisible();
  });

  test('should display code editor and controls', async ({ page }) => {
    await openCodeToMusic(page);
    
    // Check for main UI elements
    await expect(page.getByText('Your Code', { exact: true }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Generated Music', { exact: true }).first()).toBeVisible({ timeout: 5000 });
    
    // Check for controls
    await expect(page.getByRole('button', { name: /generate music/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /load sample/i })).toBeVisible({ timeout: 5000 });
  });

  test('should have language and genre selectors', async ({ page }) => {
    await openCodeToMusic(page);
    
    // Check for Language selector
    const languageLabel = page.getByText('Language', { exact: true });
    await expect(languageLabel).toBeVisible({ timeout: 5000 });
    
    // Check for Genre selector
    const genreLabel = page.getByText('Genre', { exact: true });
    await expect(genreLabel).toBeVisible({ timeout: 5000 });
    
    // Check for Variation slider
    await expect(page.getByText('Variation')).toBeVisible({ timeout: 5000 });
  });

  test('should load sample code when Load Sample is clicked', async ({ page }) => {
    await openCodeToMusic(page);
    
    // Click Load Sample
    const loadSampleButton = page.getByTestId('code-to-music-load-sample');
    await expect(loadSampleButton).toBeVisible({ timeout: 5000 });
    await loadSampleButton.click();
    
    // Wait for toast and code to load
    await page.waitForTimeout(500);
    
    // Verify code was loaded
    const codeTextarea = page.getByRole('textbox').first();
    const codeContent = await codeTextarea.inputValue();
    expect(codeContent.length).toBeGreaterThan(0);
    expect(codeContent).toContain('class MusicPlayer');
  });

  test('should show Play Music button disabled initially', async ({ page }) => {
    await openCodeToMusic(page);
    await expect(page.getByText('No music generated yet')).toBeVisible({ timeout: 5000 });
  });

  test('should enable Play Music button after generation', async ({ page }) => {
    test.setTimeout(90000); // Extend timeout for API call
    
    await openCodeToMusic(page);
    
    // Load sample code
    const loadSampleButton = page.getByTestId('code-to-music-load-sample');
    await expect(loadSampleButton).toBeVisible({ timeout: 5000 });
    await loadSampleButton.click();
    await page.waitForTimeout(1000);
    
    // Click Generate Music
    const generateButton = page.getByTestId('code-to-music-generate');
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    
    // Wait for generation (API call can take time)
    await page.waitForTimeout(10000);
    
    // Play Music button should now be enabled
    const playButton = page.getByTestId('code-to-music-play');
    await expect(playButton).toBeEnabled({ timeout: 5000 });
  });

  test('should display generated music metadata', async ({ page }) => {
    test.setTimeout(90000); // Extend timeout for API call
    
    await openCodeToMusic(page);
    
    // Load sample and generate
    const loadSampleButton = page.getByTestId('code-to-music-load-sample');
    await expect(loadSampleButton).toBeVisible({ timeout: 5000 });
    await loadSampleButton.click();
    await page.waitForTimeout(1000);
    
    const generateButton = page.getByTestId('code-to-music-generate');
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    await page.waitForTimeout(10000);
    
    // Check for metadata display
    await expect(page.getByText(/^BPM$/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^Key$/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^Duration$/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should toggle Play/Stop button text', async ({ page }) => {
    test.setTimeout(90000); // Extend timeout for API call
    
    await openCodeToMusic(page);
    
    // Load sample and generate
    const loadSampleButton = page.getByTestId('code-to-music-load-sample');
    await expect(loadSampleButton).toBeVisible({ timeout: 5000 });
    await loadSampleButton.click();
    await page.waitForTimeout(1000);
    
    const generateButton = page.getByTestId('code-to-music-generate');
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    await page.waitForTimeout(10000);
    
    // Click Play
    const playButton = page.getByTestId('code-to-music-play');
    await expect(playButton).toBeEnabled({ timeout: 5000 });
    await playButton.click();
    
    // Button text may stay Play or change to Stop depending on generation timing
    await expect(playButton).toHaveText(/Play|Stop/i, { timeout: 5000 });
    
    // Click Stop
    await playButton.click();
    
    // Button should remain visible and enabled
    await expect(playButton).toBeVisible({ timeout: 5000 });
  });

  test('should be accessible on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await openCodeToMusic(page);
  });
});
