/**
 * PCM Audio Analyzer
 *
 * Runs offline analysis on a Float32Array of mono PCM samples.
 * All frequency-domain work uses a simple DFT on 512-sample frames
 * (no external FFT library needed for this resolution).
 */

export interface BandEnergy {
  sub:     number  // 20–80 Hz
  bass:    number  // 80–250 Hz
  lowMid:  number  // 250–2000 Hz
  highMid: number  // 2000–6000 Hz
  high:    number  // 6000–20000 Hz
}

export interface AudioAnalysisReport {
  durationSeconds:       number
  sampleRate:            number
  sampleCount:           number

  // Loudness
  rmsLinear:             number
  rmsDb:                 number
  peakLinear:            number
  peakDb:                number
  clippedSampleCount:    number
  clippingPercent:       number

  // Tonality
  spectralCentroidHz:    number   // < 1.5kHz = muddy, 3–5kHz = balanced, > 6kHz = harsh
  dcOffset:              number   // should be ~0; > 0.01 = likely a bug

  // Dynamics
  dynamicRangeDb:        number
  crestFactor:           number   // peakLinear / rmsLinear

  // Frequency bands (energy fractions, sum ≈ 1.0)
  bandEnergy:            BandEnergy

  // Rhythm
  estimatedBpm:          number | null
  onsetCount:            number
  onsetTimingStdDevMs:   number   // low = tight, high = erratic

  // Quick diagnostics
  isSilent:              boolean
  hasClipping:           boolean
  hasDcOffset:           boolean

  // Human-readable summary
  summary:               string
}

// ── Simple DFT for a single frame ─────────────────────────────────────────────

function computeSpectrum(frame: Float32Array, _sampleRate: number): Float32Array {
  const N = frame.length
  const halfN = Math.floor(N / 2)
  const mag = new Float32Array(halfN)

  for (let k = 0; k < halfN; k++) {
    let re = 0
    let im = 0
    const angle = (2 * Math.PI * k) / N
    for (let n = 0; n < N; n++) {
      re += frame[n] * Math.cos(angle * n)
      im -= frame[n] * Math.sin(angle * n)
    }
    mag[k] = Math.sqrt(re * re + im * im) / N
  }

  return mag
}

function hfc(frame: Float32Array): number {
  // High-frequency content: weight each sample by its index squared
  // (approximation without FFT — emphasises transients)
  let h = 0
  const N = frame.length
  for (let i = 0; i < N; i++) h += frame[i] * frame[i] * (i / N)
  return h
}

// ── BPM estimation via onset autocorrelation ──────────────────────────────────

function estimateBpm(onsetTimesMs: number[]): number | null {
  if (onsetTimesMs.length < 4) return null

  const iois: number[] = []
  for (let i = 1; i < onsetTimesMs.length; i++) {
    const gap = onsetTimesMs[i] - onsetTimesMs[i - 1]
    if (gap >= 200 && gap <= 2000) iois.push(gap)  // 30–300 BPM range
  }

  if (iois.length < 3) return null

  // Convert IOIs to BPM candidates and bin-count with 8% tolerance
  const bpmCandidates: number[] = []
  for (const ioi of iois) {
    bpmCandidates.push(60000 / ioi)
    bpmCandidates.push(60000 / (ioi * 2))
    bpmCandidates.push(60000 / (ioi / 2))
  }

  const bins = new Map<number, number>()
  for (const bpm of bpmCandidates) {
    if (bpm < 40 || bpm > 240) continue
    const rounded = Math.round(bpm)
    let found = false
    for (const [key] of bins) {
      if (Math.abs(key - rounded) <= key * 0.08) {
        bins.set(key, (bins.get(key) ?? 0) + 1)
        found = true
        break
      }
    }
    if (!found) bins.set(rounded, 1)
  }

  let bestBpm = 0
  let bestCount = 0
  for (const [bpm, count] of bins) {
    if (count > bestCount) { bestCount = count; bestBpm = bpm }
  }

  return bestBpm > 0 ? bestBpm : null
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// ── Main analysis entry point ─────────────────────────────────────────────────

export function analyzePcm(samples: Float32Array, sampleRate: number): AudioAnalysisReport {
  const N = samples.length
  const durationSeconds = N / sampleRate

  // ── Loudness ───────────────────────────────────────────────────────────────
  let sumSq = 0
  let peak = 0
  let dcSum = 0
  let clipped = 0

  for (let i = 0; i < N; i++) {
    const s = samples[i]
    sumSq += s * s
    dcSum += s
    const abs = Math.abs(s)
    if (abs > peak) peak = abs
    if (abs >= 0.99) clipped++
  }

  const rmsLinear = Math.sqrt(sumSq / N)
  const rmsDb     = rmsLinear > 0 ? 20 * Math.log10(rmsLinear) : -Infinity
  const peakDb    = peak       > 0 ? 20 * Math.log10(peak)      : -Infinity
  const dcOffset  = dcSum / N
  const clippingPercent = (clipped / N) * 100
  const dynamicRangeDb = peakDb - rmsDb
  const crestFactor = rmsLinear > 0 ? peak / rmsLinear : 0

  // ── Onset detection (HFC-based) ────────────────────────────────────────────
  const FRAME_SIZE  = 512
  const HOP_SIZE    = 256
  const HFC_THRESH  = 0.003
  const MIN_GAP_MS  = 60

  const onsetTimesMs: number[] = []
  let prevHfc = 0
  let lastOnsetMs = -Infinity

  for (let offset = 0; offset + FRAME_SIZE <= N; offset += HOP_SIZE) {
    const frame   = samples.slice(offset, offset + FRAME_SIZE)
    const h       = hfc(frame)
    const delta   = Math.max(0, h - prevHfc)
    const nowMs   = (offset / sampleRate) * 1000

    if (delta > HFC_THRESH && nowMs - lastOnsetMs > MIN_GAP_MS) {
      onsetTimesMs.push(nowMs)
      lastOnsetMs = nowMs
    }

    prevHfc = h
  }

  const iois = onsetTimesMs.slice(1).map((t, i) => t - onsetTimesMs[i])
  const onsetTimingStdDevMs = stdDev(iois)
  const estimatedBpmValue = estimateBpm(onsetTimesMs)

  // ── Spectral centroid + band energy ────────────────────────────────────────
  const NUM_SPECTRAL_FRAMES = Math.min(8, Math.floor(N / FRAME_SIZE))
  let centroidSum = 0
  const bandSums = { sub: 0, bass: 0, lowMid: 0, highMid: 0, high: 0 }
  let totalMag = 0

  for (let fi = 0; fi < NUM_SPECTRAL_FRAMES; fi++) {
    const offset = Math.floor((fi / NUM_SPECTRAL_FRAMES) * (N - FRAME_SIZE))
    const frame  = samples.slice(offset, offset + FRAME_SIZE)
    const mag    = computeSpectrum(frame, sampleRate)
    const binHz  = sampleRate / FRAME_SIZE

    for (let k = 0; k < mag.length; k++) {
      const freq = k * binHz
      const m    = mag[k]
      centroidSum += freq * m
      totalMag    += m

      if      (freq <   80) bandSums.sub     += m
      else if (freq <  250) bandSums.bass    += m
      else if (freq < 2000) bandSums.lowMid  += m
      else if (freq < 6000) bandSums.highMid += m
      else                  bandSums.high    += m
    }
  }

  const spectralCentroidHz = totalMag > 0 ? centroidSum / totalMag : 0
  const bandTotal = Object.values(bandSums).reduce((a, b) => a + b, 0) || 1
  const bandEnergy: BandEnergy = {
    sub:     bandSums.sub     / bandTotal,
    bass:    bandSums.bass    / bandTotal,
    lowMid:  bandSums.lowMid  / bandTotal,
    highMid: bandSums.highMid / bandTotal,
    high:    bandSums.high    / bandTotal,
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────
  const isSilent   = rmsLinear < 0.001
  const hasClipping = clippingPercent > 0.01
  const hasDcOffset = Math.abs(dcOffset) > 0.01

  // ── Human-readable summary ────────────────────────────────────────────────
  const parts: string[] = []

  if (isSilent) {
    parts.push('Audio is silent — nothing was captured or the app was not producing audio.')
  } else {
    parts.push(`Loudness: ${rmsDb.toFixed(1)} dBFS RMS, peak ${peakDb.toFixed(1)} dBFS.`)

    if (hasClipping) parts.push(`⚠ Clipping detected on ${clippingPercent.toFixed(2)}% of samples — gain staging issue.`)
    if (hasDcOffset) parts.push(`⚠ DC offset ${dcOffset.toFixed(4)} — possible filter or gain bug.`)

    if      (spectralCentroidHz < 800)  parts.push('Tone: very dark / sub-heavy (centroid below 800 Hz).')
    else if (spectralCentroidHz < 2000) parts.push(`Tone: warm / bass-heavy (centroid ${spectralCentroidHz.toFixed(0)} Hz).`)
    else if (spectralCentroidHz < 4000) parts.push(`Tone: balanced (centroid ${spectralCentroidHz.toFixed(0)} Hz).`)
    else                                parts.push(`Tone: bright / harsh (centroid ${spectralCentroidHz.toFixed(0)} Hz).`)

    parts.push(`Band mix — sub: ${(bandEnergy.sub*100).toFixed(0)}% | bass: ${(bandEnergy.bass*100).toFixed(0)}% | mid: ${(bandEnergy.lowMid*100).toFixed(0)}% | hi-mid: ${(bandEnergy.highMid*100).toFixed(0)}% | high: ${(bandEnergy.high*100).toFixed(0)}%.`)

    if (estimatedBpmValue) {
      parts.push(`Rhythm: estimated ${estimatedBpmValue} BPM, ${onsetTimesMs.length} onsets detected.`)
      if      (onsetTimingStdDevMs < 5)  parts.push('Timing: very tight (< 5 ms jitter).')
      else if (onsetTimingStdDevMs < 15) parts.push(`Timing: acceptable (${onsetTimingStdDevMs.toFixed(1)} ms jitter).`)
      else                               parts.push(`⚠ Timing: loose (${onsetTimingStdDevMs.toFixed(1)} ms jitter) — may feel unsteady.`)
    } else {
      parts.push('Rhythm: no clear beat detected (ambient / textural audio).')
    }
  }

  return {
    durationSeconds,
    sampleRate,
    sampleCount: N,
    rmsLinear,
    rmsDb,
    peakLinear: peak,
    peakDb,
    clippedSampleCount: clipped,
    clippingPercent,
    spectralCentroidHz,
    dcOffset,
    dynamicRangeDb,
    crestFactor,
    bandEnergy,
    estimatedBpm: estimatedBpmValue,
    onsetCount: onsetTimesMs.length,
    onsetTimingStdDevMs,
    isSilent,
    hasClipping,
    hasDcOffset,
    summary: parts.join(' '),
  }
}
