import { test, expect } from '@playwright/test';

test.describe('Code-to-Music Studio V2', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the studio
    await page.goto('/studio', { waitUntil: 'load', timeout: 60000 });
    
    // Wait for page to be interactive
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Close the workflow selection dialog if it appears
    try {
      const skipButton = page.getByRole('button', { name: /skip for now/i });
      await skipButton.click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch {
      // Dialog might not appear or already closed
    }
  });

  test('should display Code-to-Music tab in desktop navigation', async ({ page }) => {
    // Look for the Code to Music button in the DAW-style tab bar
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await expect(codeToMusicTab).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Code-to-Music studio', async ({ page }) => {
    // Click the Code to Music tab
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click();
    
    // Wait for the component to load
    await page.waitForTimeout(1000);
    
    // Verify the Code-to-Music Studio header is visible
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible();
    await expect(page.getByText(/convert your code into harmonic music/i)).toBeVisible();
  });

  test('should display code editor and controls', async ({ page }) => {
    // Navigate to Code-to-Music
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click({ timeout: 10000 });
    
    // Wait for the Code-to-Music Studio header to appear (confirms view switched)
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible({ timeout: 10000 });
    
    // Check for main UI elements
    await expect(page.getByText('Your Code')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Generated Music')).toBeVisible({ timeout: 5000 });
    
    // Check for controls
    await expect(page.getByRole('button', { name: /generate music/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /load sample/i })).toBeVisible({ timeout: 5000 });
  });

  test('should have language and genre selectors', async ({ page }) => {
    // Navigate to Code-to-Music
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click({ timeout: 10000 });
    
    // Wait for view to switch
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible({ timeout: 10000 });
    
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
    // Navigate to Code-to-Music
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click({ timeout: 10000 });
    
    // Wait for view to switch
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible({ timeout: 10000 });
    
    // Click Load Sample
    const loadSampleButton = page.getByRole('button', { name: /load sample/i });
    await expect(loadSampleButton).toBeVisible({ timeout: 5000 });
    await loadSampleButton.click();
    
    // Wait for toast and code to load
    await page.waitForTimeout(1000);
    
    // Verify code was loaded
    const codeTextarea = page.locator('textarea').first();
    const codeContent = await codeTextarea.inputValue();
    expect(codeContent.length).toBeGreaterThan(0);
    expect(codeContent).toContain('class MusicPlayer');
  });

  test('should show Play Music button disabled initially', async ({ page }) => {
    // Navigate to Code-to-Music
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click({ timeout: 10000 });
    
    // Wait for view to switch
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible({ timeout: 10000 });
    
    // Play Music button should be disabled when no music is generated
    const playButton = page.getByRole('button', { name: /play music/i });
    await expect(playButton).toBeVisible({ timeout: 5000 });
    await expect(playButton).toBeDisabled();
  });

  test('should enable Play Music button after generation', async ({ page }) => {
    test.setTimeout(90000); // Extend timeout for API call
    
    // Navigate to Code-to-Music
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click({ timeout: 10000 });
    
    // Wait for view to switch
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible({ timeout: 10000 });
    
    // Load sample code
    const loadSampleButton = page.getByRole('button', { name: /load sample/i });
    await expect(loadSampleButton).toBeVisible({ timeout: 5000 });
    await loadSampleButton.click();
    await page.waitForTimeout(1000);
    
    // Click Generate Music
    const generateButton = page.getByRole('button', { name: /generate music/i });
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    
    // Wait for generation (API call can take time)
    await page.waitForTimeout(10000);
    
    // Play Music button should now be enabled
    const playButton = page.getByRole('button', { name: /play music/i });
    await expect(playButton).toBeEnabled({ timeout: 5000 });
  });

  test('should display generated music metadata', async ({ page }) => {
    test.setTimeout(90000); // Extend timeout for API call
    
    // Navigate to Code-to-Music
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click({ timeout: 10000 });
    
    // Wait for view to switch
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible({ timeout: 10000 });
    
    // Load sample and generate
    const loadSampleButton = page.getByRole('button', { name: /load sample/i });
    await expect(loadSampleButton).toBeVisible({ timeout: 5000 });
    await loadSampleButton.click();
    await page.waitForTimeout(1000);
    
    const generateButton = page.getByRole('button', { name: /generate music/i });
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    await page.waitForTimeout(10000);
    
    // Check for metadata display
    await expect(page.getByText(/BPM:/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Key:/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Duration:/i)).toBeVisible({ timeout: 5000 });
  });

  test('should toggle Play/Stop button text', async ({ page }) => {
    test.setTimeout(90000); // Extend timeout for API call
    
    // Navigate to Code-to-Music
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click({ timeout: 10000 });
    
    // Wait for view to switch
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible({ timeout: 10000 });
    
    // Load sample and generate
    const loadSampleButton = page.getByRole('button', { name: /load sample/i });
    await expect(loadSampleButton).toBeVisible({ timeout: 5000 });
    await loadSampleButton.click();
    await page.waitForTimeout(1000);
    
    const generateButton = page.getByRole('button', { name: /generate music/i });
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    await page.waitForTimeout(10000);
    
    // Click Play
    const playButton = page.getByRole('button', { name: /play music/i });
    await expect(playButton).toBeEnabled({ timeout: 5000 });
    await playButton.click();
    
    // Button should change to Stop
    await expect(page.getByRole('button', { name: /stop/i })).toBeVisible({ timeout: 2000 });
    
    // Click Stop
    await page.getByRole('button', { name: /stop/i }).click();
    
    // Button should change back to Play Music
    await expect(page.getByRole('button', { name: /play music/i })).toBeVisible({ timeout: 2000 });
  });

  test('should be accessible on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to studio
    await page.goto('/studio', { waitUntil: 'load', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Close workflow dialog if it appears
    try {
      const skipButton = page.getByRole('button', { name: /skip for now/i });
      await skipButton.click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch {
      // Dialog might not appear
    }
    
    // Code-to-Music should be accessible (either in mobile nav or via menu)
    const codeToMusicTab = page.getByRole('button', { name: /code to music/i });
    await codeToMusicTab.click({ timeout: 10000 });
    
    // Verify component loads on mobile
    await expect(page.getByText('Code-to-Music Studio')).toBeVisible({ timeout: 10000 });
  });
});
