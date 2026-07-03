// Pure fundamental-pitch detection for drum/808 samples. NO tone imports —
// operates on raw Float32Array channel data so it is unit-testable and can run
// on any decoded AudioBuffer.
//
// Used to tune kicks/808s to the song key: nothing in the sample profiles
// stores pitch, and the 808 sampler previously trusted `rootNote || 'C1'`,
// which plays every melodic 808 line consistently off against the chords when
// the metadata is wrong.

/**
 * Detect the fundamental frequency of a low-pitched one-shot (kick / 808).
 *
 * Autocorrelation over the sample's TAIL — kicks pitch-sweep downward, so the
 * first ~40ms transient is skipped and the settled sub region is measured.
 * Search is limited to the sub/bass range so hats or noise can never produce
 * a bogus "pitch".
 *
 * @returns frequency in Hz, or null when no confident pitch is found
 */
export function detectFundamentalHz(
  data: Float32Array,
  sampleRate: number,
  minHz = 25,
  maxHz = 200,
): number | null {
  if (sampleRate <= 0 || data.length === 0) return null

  // Decimate ×4 — plenty of bandwidth for a ≤200 Hz search, 16× cheaper.
  const dec = 4
  const sr = sampleRate / dec
  const decimated = new Float32Array(Math.floor(data.length / dec))
  for (let i = 0; i < decimated.length; i++) {
    const j = i * dec
    decimated[i] = (data[j] + data[j + 1] + data[j + 2] + data[j + 3]) / 4
  }

  // Analysis window: skip the 40ms transient, use up to 400ms of the body.
  const start = Math.floor(0.04 * sr)
  const maxLag = Math.floor(sr / minHz)
  const winLen = Math.min(decimated.length - start, Math.floor(0.4 * sr))
  // Need at least two periods of the lowest searchable pitch.
  if (winLen < maxLag * 2) return null

  // Remove DC so a sub-heavy asymmetric waveform doesn't bias the correlation.
  const seg = decimated.subarray(start, start + winLen)
  let mean = 0
  for (let i = 0; i < seg.length; i++) mean += seg[i]
  mean /= seg.length

  const minLag = Math.max(1, Math.ceil(sr / maxHz))
  const n = seg.length - maxLag

  const rs = new Float32Array(maxLag + 1)
  let bestR = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let dot = 0
    let e0 = 0
    let e1 = 0
    for (let i = 0; i < n; i++) {
      const a = seg[i] - mean
      const b = seg[i + lag] - mean
      dot += a * b
      e0 += a * a
      e1 += b * b
    }
    const denom = Math.sqrt(e0 * e1)
    const r = denom > 0 ? dot / denom : 0
    rs[lag] = r
    if (r > bestR) bestR = r
  }

  // Confidence gate — noise/inharmonic material (snares, claps) lands well
  // below this and correctly returns "no pitch".
  if (bestR < 0.5) return null

  // Octave-error guard: a periodic signal correlates equally well at 2×/3× the
  // true period, and the global max can land there. Take the SMALLEST lag whose
  // local peak is nearly as strong as the global best — that is the fundamental.
  let bestLag = -1
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (rs[lag] >= rs[lag - 1] && rs[lag] >= rs[lag + 1] && rs[lag] >= bestR * 0.95) {
      bestLag = lag
      break
    }
  }
  if (bestLag < 0) return null

  // Parabolic interpolation around the peak for sub-lag precision.
  let lag = bestLag
  if (bestLag > minLag && bestLag < maxLag) {
    const rAt = (l: number) => {
      let dot = 0
      for (let i = 0; i < n; i++) dot += (seg[i] - mean) * (seg[i + l] - mean)
      return dot
    }
    const y0 = rAt(bestLag - 1)
    const y1 = rAt(bestLag)
    const y2 = rAt(bestLag + 1)
    const denom = y0 - 2 * y1 + y2
    if (denom !== 0) {
      const shift = 0.5 * (y0 - y2) / denom
      if (Math.abs(shift) < 1) lag = bestLag + shift
    }
  }

  return sr / lag
}

/** Frequency → fractional MIDI note number (69 = A4 = 440 Hz). */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440)
}

/**
 * Semitones to retune a detected pitch onto a key root, or 0 when the sample
 * should be left alone.
 *
 * The shift targets the nearest octave of the key root's pitch class and is
 * only applied when small (≤ maxShift semitones): a kick pulled 4-5 semitones
 * becomes a different drum, which is worse than being off-key.
 */
export function tuneShiftSemitones(
  detectedHz: number,
  keyRootPitchClass: number,
  maxShift = 3,
): number {
  if (!(detectedHz > 0)) return 0
  const midi = hzToMidi(detectedHz)
  const pc = ((midi % 12) + 12) % 12
  // Wrapped pitch-class distance in (-6, 6]
  let shift = (((keyRootPitchClass - pc) % 12) + 12) % 12
  if (shift > 6) shift -= 12
  return Math.abs(shift) <= maxShift ? shift : 0
}
