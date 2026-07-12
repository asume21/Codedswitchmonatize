/** Everything an improviser is allowed to know. The Conductor/orchestrator
 *  INFORMS; the improviser writes the notes. */
export interface FreeplayContext {
  rootMidi: number            // bass-register chord root (conductor voicing)
  nextRootMidi?: number       // bass-register root the phrase RESOLVES INTO (conductor lookahead).
                              // Same as rootMidi (or absent) = the harmony is holding, so there is
                              // nothing for a bassline to connect — the bass hits instead of walking.
  chordIntervals: number[]    // the chord's real intervals (3rd/7th quality)
  bars: number                // phrase length (4 = one chord cycle)
  swing: number               // swingForSubGenre value — the ONE swing source
  subGenre: string            // idiom skeleton selection
  energy: number              // 0..1 section arc
  density: number             // 0..1 section arc
  sectionName: string         // motif memory key component
  motifSeed: number           // hash(section + subGenre) — motif family
  kickTimes16ths: number[]    // absolute kick slots 0..(bars*16-1), for bass glue
  leadBusy16ths?: number[]    // per-bar slots 0..15 the melody occupies — comp dodges the lead (empty/absent = deaf)
  rng: () => number           // seeded — improvisers are deterministic per seed
  compGesture?: CompGesture   // chord comp gesture override; absent = derive from motifSeed
}

// Chord comping "animator" gesture (2026-07-09 reference study). Defined here so
// the orchestrator can pin one per section; the vocabulary lives in ChordImproviser.
export type CompGesture =
  | 'stabs'
  | 'sustain'
  | 'roll'
  | 'phrase-end'
  | 'alternate'
  | 'call-response'
