import { test, expect } from '@playwright/test';

// Bypass the global auth setup — Organism guest mode works without login
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Organism Audio Node Leak Tests
 *
 * Verifies that the fixes in c2cfd20 (GeneratorOrchestrator.dispose +
 * MixEngine explicit disconnect) and 4717bdd (Tone.Noise memory leak)
 * are holding. Each test instruments the Web Audio API via addInitScript
 * so we can count structural node creation/disposal without touching
 * production code.
 *
 * WHAT WE TRACK — structural nodes only:
 *   Gain, Filter, Compressor, Analyser, Delay, Panner, Convolver, etc.
 *
 * WHAT WE EXCLUDE — one-shot sources:
 *   createBufferSource, createOscillator, createConstantSource
 *   → Web Audio creates a new node per trigger by design (can't reuse a
 *     started source). These accumulate between GC cycles and look like
 *     leaks but are bounded and expected. Not structural leaks.
 *
 * NOTE: Web Audio is real in headless Chromium but silent — node counts
 * are accurate even though you can't hear the output. Perceptual testing
 * still needs a manual listen.
 */

// How long to let the organism run each cycle before stopping (ms)
const RUN_DURATION_MS = 1500;

// Max structural node growth allowed per cycle after warm-up.
// Pre-fix this was ~40+. Post-fix should be near zero.
const MAX_STRUCTURAL_NODES_PER_CYCLE = 8;

test.describe('Organism — audio node leak detection', () => {

  // ─── inject structural node counter before any page script runs ───────
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__audioNodeStats = { created: 0, disposed: 0 };

      const OrigAudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!OrigAudioContext) return;

      // Only track structural nodes — excludes one-shot sources which are
      // expected per-trigger by Web Audio design (BufferSource, Oscillator).
      const structuralFactories = [
        'createGain',
        'createBiquadFilter',
        'createDelay',
        'createPanner',
        'createStereoPanner',
        'createDynamicsCompressor',
        'createConvolver',
        'createWaveShaper',
        'createAnalyser',
        'createChannelSplitter',
        'createChannelMerger',
        'createScriptProcessor',
        'createMediaStreamSource',
        'createMediaStreamDestination',
        'createIIRFilter',
        // Intentionally excluded: createBufferSource, createOscillator,
        // createConstantSource — these are one-shot and GC'd automatically.
      ];

      const proto = OrigAudioContext.prototype;
      for (const method of structuralFactories) {
        if (typeof proto[method] === 'function') {
          const original = proto[method];
          proto[method] = function (...args: any[]) {
            const node = original.apply(this, args);
            (window as any).__audioNodeStats.created++;
            const origDisconnect = node.disconnect.bind(node);
            node.disconnect = (...dArgs: any[]) => {
              if (dArgs.length === 0) {
                (window as any).__audioNodeStats.disposed++;
              }
              return origDisconnect(...dArgs);
            };
            return node;
          };
        }
      }
    });
  });

  // ─── helper: read live structural node count ──────────────────────────
  async function getLiveNodes(page: any): Promise<number> {
    return page.evaluate(() => {
      const s = (window as any).__audioNodeStats;
      return s ? s.created - s.disposed : -1;
    });
  }

  // ─── helper: open studio and wait for React mount ─────────────────────
  async function openOrganism(page: any) {
    await page.goto('/studio');
    await page.waitForLoadState('domcontentloaded');
    // Studio has persistent WebSockets + audio polling — networkidle never fires.
    // Wait for React to mount and providers to initialize.
    await page.waitForTimeout(3000);

    // Click into the Organism tab if present
    const organismTab = page.locator(
      'button:has-text("Organism"), [data-tab="organism"], [aria-label*="Organism"]'
    );
    if (await organismTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await organismTab.first().click();
      await page.waitForTimeout(500);
    }
  }

  async function clickStart(page: any) {
    const btn = page.locator(
      'button:has-text("Start"), button[aria-label*="Start"], button:has-text("▶")'
    );
    if (await btn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.first().click();
    }
  }

  async function clickStop(page: any) {
    const btn = page.locator(
      'button:has-text("Stop"), button[aria-label*="Stop"], button:has-text("■")'
    );
    if (await btn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.first().click();
    }
  }

  // ─── TEST 1: structural node count stays flat after warm-up ──────────
  test('structural node count stays flat across 4 start/stop cycles', async ({ page }) => {
    await openOrganism(page);

    // Warm-up cycle — PolySynth voice pool gets allocated on first playback.
    // We discard this cycle so the measurement starts from a stable pool.
    await clickStart(page);
    await page.waitForTimeout(RUN_DURATION_MS);
    await clickStop(page);
    await page.waitForTimeout(600);

    // Baseline after warm-up — pool should be fully allocated now
    const baseline = await getLiveNodes(page);

    const snapshots: number[] = [];

    for (let i = 0; i < 4; i++) {
      await clickStart(page);
      await page.waitForTimeout(RUN_DURATION_MS);
      await clickStop(page);
      await page.waitForTimeout(600);

      const live = await getLiveNodes(page);
      snapshots.push(live - baseline);
    }

    console.log('[organism-leak] structural node deltas per cycle (after warm-up):', snapshots);

    // After warm-up, each cycle should add at most MAX_STRUCTURAL_NODES_PER_CYCLE
    for (let i = 1; i < snapshots.length; i++) {
      const growth = snapshots[i] - snapshots[i - 1];
      expect(growth,
        `Cycle ${i + 1}: structural nodes grew by ${growth} (max: ${MAX_STRUCTURAL_NODES_PER_CYCLE}). ` +
        `A Gain/Filter/Compressor etc. is not being disposed on stop().`
      ).toBeLessThanOrEqual(MAX_STRUCTURAL_NODES_PER_CYCLE);
    }
  });

  // ─── TEST 2: remounting via input-source change doesn't leak ─────────
  test('switching input source 3× does not accumulate structural nodes', async ({ page }) => {
    await openOrganism(page);

    // Warm-up
    await clickStart(page);
    await page.waitForTimeout(RUN_DURATION_MS);
    await clickStop(page);
    await page.waitForTimeout(600);

    const baseline = await getLiveNodes(page);

    const sources = ['autoGenerate', 'midi', 'audioFile'];
    for (const src of sources) {
      const srcBtn = page.locator(
        `button:has-text("${src}"), [data-source="${src}"], button[aria-label*="${src}"]`
      );
      if (await srcBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await srcBtn.first().click();
        await page.waitForTimeout(800);
      }
    }

    const after = await getLiveNodes(page);
    const totalGrowth = after - baseline;

    console.log(`[organism-leak] structural node growth across 3 source switches: ${totalGrowth}`);

    expect(totalGrowth,
      `Structural node growth after 3 source switches: ${totalGrowth}. ` +
      `Expected < ${3 * MAX_STRUCTURAL_NODES_PER_CYCLE}. dispose() may not be freeing engine nodes.`
    ).toBeLessThan(3 * MAX_STRUCTURAL_NODES_PER_CYCLE);
  });

  // ─── TEST 3: JS heap stays under 512 MB after 5 cycles ───────────────
  test('JS heap stays under 512 MB after 5 start/stop cycles', async ({ page }) => {
    await openOrganism(page);

    for (let i = 0; i < 5; i++) {
      await clickStart(page);
      await page.waitForTimeout(RUN_DURATION_MS);
      await clickStop(page);
      await page.waitForTimeout(300);
    }

    const heapMB = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? mem.usedJSHeapSize / (1024 * 1024) : -1;
    });

    console.log(`[organism-leak] JS heap after 5 cycles: ${heapMB.toFixed(1)} MB`);

    if (heapMB > 0) {
      // Pre-fix: heap climbed to ~2 GB. Post-fix: should stay well under 512 MB.
      expect(heapMB,
        `JS heap is ${heapMB.toFixed(0)} MB — Tone.Noise or node leak may have returned.`
      ).toBeLessThan(512);
    } else {
      console.warn('[organism-leak] performance.memory unavailable, skipping heap check');
    }
  });

  // ─── TEST 4: no unexpected Tone.js errors in console ─────────────────
  test('no unexpected Tone.js errors in console during playback', async ({ page }) => {
    const unexpectedErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        const text = msg.text();

        // Skip expected headless Chromium AudioContext autoplay block —
        // this fires because Playwright can't simulate a user gesture to
        // resume AudioContext. Not a code bug.
        if (
          text.includes('AudioContext was not allowed to start') ||
          text.includes('must be resumed (or created) after a user gesture') ||
          text.includes('AudioContext is "suspended"')
        ) return;

        // Flag real Tone.js / Web Audio errors
        if (
          text.toLowerCase().includes('tone') ||
          text.toLowerCase().includes('audionode') ||
          text.toLowerCase().includes('already been disposed') ||
          text.toLowerCase().includes('cannot read properties of null')
        ) {
          unexpectedErrors.push(`[${msg.type()}] ${text}`);
        }
      }
    });

    await openOrganism(page);
    await clickStart(page);
    await page.waitForTimeout(RUN_DURATION_MS * 2);
    await clickStop(page);
    await page.waitForTimeout(500);

    if (unexpectedErrors.length > 0) {
      console.log('[organism-leak] Unexpected Tone/Audio errors:\n', unexpectedErrors.join('\n'));
    }

    expect(unexpectedErrors,
      `Found ${unexpectedErrors.length} unexpected Tone.js/AudioNode error(s):\n${unexpectedErrors.join('\n')}`
    ).toHaveLength(0);
  });

});
