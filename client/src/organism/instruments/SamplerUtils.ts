import * as Tone from 'tone';

// Soundfonts are self-hosted under client/public/soundfonts/ so the app stops
// depending on a third-party CDN (gleitz.github.io) at runtime. Only the 20
// samples per instrument the app actually requests are bundled (~11 MB total).
const BASE_URL = '/soundfonts/';

const SELF_HOSTED_INSTRUMENTS = new Set([
  'acoustic_bass',
  'acoustic_grand_piano',
  'acoustic_guitar_nylon',
  'alto_sax',
  'cello',
  'choir_aahs',
  'clarinet',
  'distortion_guitar',
  'electric_bass_finger',
  'electric_guitar_clean',
  'electric_piano_1',
  'flute',
  'french_horn',
  'marimba',
  'oboe',
  'orchestral_harp',
  'sitar',
  'string_ensemble_1',
  'synth_bass_1',
  'trombone',
  'trumpet',
  'vibraphone',
  'violin',
]);

const SAMPLER_FALLBACKS: Record<string, string> = {
  electric_bass_pick: 'electric_bass_finger',
  fretless_bass: 'electric_bass_finger',
  slap_bass_1: 'electric_bass_finger',
  synth_bass_2: 'synth_bass_1',
};

function resolveSelfHostedInstrument(instrumentName: string): string {
  if (SELF_HOSTED_INSTRUMENTS.has(instrumentName)) return instrumentName;
  return SAMPLER_FALLBACKS[instrumentName] || 'acoustic_grand_piano';
}

/** Extended Sampler type with loading state tracking */
export type LoadableSampler = Tone.Sampler & {
  isLoaded: boolean;
  loadedPromise: Promise<void>;
};

/**
 * Creates a Tone.Sampler loaded with general MIDI soundfont files.
 * The returned sampler has two extra properties:
 *   - `isLoaded: boolean` — true once all samples have been fetched
 *   - `loadedPromise: Promise<void>` — resolves when loading completes
 *
 * Generators MUST check `isLoaded` before calling triggerAttackRelease.
 * Tone.Sampler silently produces no audio when samples aren't ready.
 *
 * @param instrumentName The folder name in MusyngKite (e.g. 'acoustic_grand_piano', 'acoustic_bass')
 * @param envelope Custom ADSR envelope (attack/release are respected by Sampler)
 * @param volume Initial volume level
 * @param onLoad Callback when loading completes
 */
export function createSoundfontSampler(
  instrumentName: string,
  envelope: { attack: number; release: number },
  volume: number = -12,
  onLoad?: () => void
): LoadableSampler {
  const resolvedInstrument = resolveSelfHostedInstrument(instrumentName);
  const sfUrl = `${BASE_URL}${resolvedInstrument}-mp3/`;

  // Sample every minor third across the most-used register. Keeping this to 12
  // files per instrument prevents cold-start decode pressure from delaying the
  // organism's first audible beat; Tone transposes these anchors for coverage.
  // The MusyngKite repo names black keys with FLATS (Db, Eb, Gb, Ab, Bb) — sharp
  // variants (Ds4.mp3, Fs4.mp3, etc.) return 404 and silently break every
  // sample-based instrument. Keep the enharmonic equivalents: D# = Eb, F# = Gb.
  // Tone.js normalizes sharp/flat spellings internally when looking up samples.
  const noteMap: Record<string, string> = {};
  const noteNames = ['C', 'Eb', 'Gb', 'A'];

  for (let octave = 3; octave <= 5; octave++) {
    for (const n of noteNames) {
      const key = `${n}${octave}`;
      noteMap[key] = `${sfUrl}${n}${octave}.mp3`;
    }
  }

  let resolveLoaded: () => void;
  const loadedPromise = new Promise<void>((resolve) => { resolveLoaded = resolve; });

  const sampler = new Tone.Sampler({
    urls: noteMap,
    attack: envelope.attack,
    release: envelope.release,
    volume,
    onload: () => {
      console.log(`🎵 Sampler loaded: ${instrumentName}`, {
        source: resolvedInstrument,
      });
      (sampler as LoadableSampler).isLoaded = true;
      resolveLoaded!();
      if (onLoad) onLoad();
    },
    onerror: (err) => {
      console.error(`💥 Failed to load sampler: ${instrumentName}`, err);
      resolveLoaded!();
    }
  }) as LoadableSampler;

  sampler.isLoaded = false;
  sampler.loadedPromise = loadedPromise;

  return sampler;
}
