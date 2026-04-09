import * as Tone from 'tone';

const BASE_URL = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/';

/**
 * Creates a Tone.Sampler loaded with general MIDI soundfont files.
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
): Tone.Sampler {
  const sfUrl = `${BASE_URL}${instrumentName}-mp3/`;
  
  // Sample every minor third for reasonable coverage without fetching 88 files
  const noteMap: Record<string, string> = {};
  const noteNames = ['C', 'D#', 'F#', 'A']; 
  
  // For bass we just want lower octaves, but we'll fetch 2 to 6 to be safe for all
  for (let octave = 2; octave <= 6; octave++) {
    for (const n of noteNames) {
      const key = `${n}${octave}`;
      // MusyngKite uses 's' instead of '#'
      noteMap[key] = `${sfUrl}${n.replace('#', 's')}${octave}.mp3`;
    }
  }

  const sampler = new Tone.Sampler({
    urls: noteMap,
    attack: envelope.attack,
    release: envelope.release,
    volume,
    onload: () => {
      console.log(`🎵 Sampler loaded gracefully: ${instrumentName}`);
      if (onLoad) onLoad();
    },
    onerror: (err) => {
      console.error(`💥 Failed to load sampler: ${instrumentName}`, err);
    }
  });

  return sampler;
}
