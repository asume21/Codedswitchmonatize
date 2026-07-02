/** Everything an improviser is allowed to know. The Conductor/orchestrator
 *  INFORMS; the improviser writes the notes. */
export interface FreeplayContext {
  rootMidi: number            // bass-register chord root (conductor voicing)
  chordIntervals: number[]    // the chord's real intervals (3rd/7th quality)
  bars: number                // phrase length (4 = one chord cycle)
  swing: number               // swingForSubGenre value — the ONE swing source
  subGenre: string            // idiom skeleton selection
  energy: number              // 0..1 section arc
  density: number             // 0..1 section arc
  sectionName: string         // motif memory key component
  motifSeed: number           // hash(section + subGenre) — motif family
  kickTimes16ths: number[]    // absolute kick slots 0..(bars*16-1), for bass glue
  rng: () => number           // seeded — improvisers are deterministic per seed
}
