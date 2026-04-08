import * as Tone from 'tone';

const BASE_URL = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/';

/** Extended Sampler type with loading state tracking */
export type LoadableSampler = Tone.Sampler & {
  isLoaded: boolean;
  loadedPromise: Promise<void>;
};

// ── Audio buffer cache ──────────────────────────────────────────────────
// When multiple generators pick the same soundfont instrument (e.g.
// 'acoustic_grand_piano' for both melody and chords), the cache prevents
// re-fetching the same MP3 files. Buffers persist for the session lifetime.
const bufferCache = new Map<string, Promise<ToneAudioBuffer>>();
type ToneAudioBuffer = InstanceType<typeof Tone.ToneAudioBuffer>;

function getCachedBuffer(url: string): Promise<ToneAudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;

  const promise = new Promise<ToneAudioBuffer>((resolve, reject) => {
    const buf = new Tone.ToneAudioBuffer(url, () => resolve(buf), reject);
  });
  bufferCache.set(url, promise);
  return promise;
}

// ── Concurrency gate ────────────────────────────────────────────────────
// Limits how many instruments load simultaneously. Each instrument loads
// up to 12 samples. Without gating, 3 generators switching to samplers
// at once would fire ~36 HTTP requests simultaneously.
const MAX_CONCURRENT_INSTRUMENTS = 3;
let activeInstrumentLoads = 0;
const instrumentQueue: Array<() => void> = [];

function acquireInstrumentSlot(): Promise<void> {
  if (activeInstrumentLoads < MAX_CONCURRENT_INSTRUMENTS) {
    activeInstrumentLoads++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    instrumentQueue.push(() => { activeInstrumentLoads++; resolve(); });
  });
}

function releaseInstrumentSlot(): void {
  activeInstrumentLoads--;
  const next = instrumentQueue.shift();
  if (next) next();
}

/**
 * Creates a Tone.Sampler loaded with general MIDI soundfont files.
 * The returned sampler has two extra properties:
 *   - `isLoaded: boolean` — true once all samples have been fetched
 *   - `loadedPromise: Promise<void>` — resolves when loading completes
 *
 * Features:
 *   - Audio buffer cache: same instrument across generators shares cached buffers
 *   - Instrument-level concurrency gate: max 3 instruments loading simultaneously
 *   - Reduced sample set: 12 notes (octaves 2-4) for performance
 *
 * Generators MUST check `isLoaded` before calling triggerAttackRelease.
 * Tone.Sampler silently produces no audio when samples aren't ready.
 */
export function createSoundfontSampler(
  instrumentName: string,
  envelope: { attack: number; release: number },
  volume: number = -12,
  onLoad?: () => void
): LoadableSampler {
  const sfUrl = `${BASE_URL}${instrumentName}-mp3/`;

  // Sample every minor third — Tone.Sampler interpolates between these.
  // Octaves 2-5 cover the full bass-to-melody range used by generators.
  // (Was 2-6 = 20 samples; now 2-5 = 16 samples — 20% fewer HTTP requests)
  const noteMap: Record<string, string> = {};
  const noteNames = ['C', 'D#', 'F#', 'A'];

  for (let octave = 2; octave <= 5; octave++) {
    for (const n of noteNames) {
      const key = `${n}${octave}`;
      noteMap[key] = `${sfUrl}${n.replace('#', 's')}${octave}.mp3`;
    }
  }

  let resolveLoaded: () => void;
  const loadedPromise = new Promise<void>((resolve) => { resolveLoaded = resolve; });

  // Create the sampler immediately with empty urls — no network requests yet.
  // Generators can connect() this to their audio chain right away.
  const sampler = new Tone.Sampler({
    urls: {},
    attack: envelope.attack,
    release: envelope.release,
    volume,
  }) as LoadableSampler;

  sampler.isLoaded = false;
  sampler.loadedPromise = loadedPromise;

  // Load samples asynchronously through the concurrency gate + buffer cache
  acquireInstrumentSlot().then(async () => {
    try {
      const entries = Object.entries(noteMap);
      // Load all samples for this instrument in parallel (using cached buffers)
      const results = await Promise.allSettled(
        entries.map(async ([note, url]) => {
          const buffer = await getCachedBuffer(url);
          return { note, buffer };
        })
      );

      // Add successfully loaded buffers to the sampler
      for (const result of results) {
        if (result.status === 'fulfilled') {
          try {
            sampler.add(result.value.note as Tone.Unit.Note, result.value.buffer);
          } catch { /* sampler may have been disposed during loading */ }
        }
      }

      sampler.isLoaded = true;
      console.log(`🎵 Sampler loaded: ${instrumentName}`);
      if (onLoad) onLoad();
    } catch (err) {
      console.error(`💥 Failed to load sampler: ${instrumentName}`, err);
    } finally {
      releaseInstrumentSlot();
      resolveLoaded!();
    }
  });

  return sampler;
}
