/**
 * Musical features: tempo and key.
 *
 * Built so a render can be checked against what was asked for ("96 bpm,
 * F minor") without anyone having to listen first. Both estimators report
 * their runners-up — tempo octave errors (48 / 96 / 192) and relative
 * major/minor are the classic confusions, and hiding them would make a
 * wrong answer look certain.
 *
 * Work happens at 22.05 kHz (2× decimation of the 44.1 kHz analysis rate):
 * nothing above ~11 kHz matters for beat or pitch class, and it halves the
 * FFT cost on four-minute files.
 */

// ── FFT (iterative radix-2, in place) ──────────────────────────────────────────

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k], aIm = im[i + k]
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe
        re[i + k] = aRe + bRe
        im[i + k] = aIm + bIm
        re[i + k + len / 2] = aRe - bRe
        im[i + k + len / 2] = aIm - bIm
        const nRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nRe
      }
    }
  }
}

function hann(n: number): Float64Array {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
  return w
}

/** Magnitude spectra of hopped, windowed frames. */
function* stft(x: Float32Array, size: number, hop: number): Generator<Float64Array> {
  const win = hann(size)
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (let off = 0; off + size <= x.length; off += hop) {
    for (let i = 0; i < size; i++) { re[i] = x[off + i] * win[i]; im[i] = 0 }
    fftInPlace(re, im)
    const mag = new Float64Array(size / 2)
    for (let k = 0; k < size / 2; k++) mag[k] = Math.hypot(re[k], im[k])
    yield mag
  }
}

/** 2× decimation with a short averaging low-pass. */
function decimate2(x: Float32Array): Float32Array {
  const out = new Float32Array(Math.floor(x.length / 2))
  for (let i = 0; i < out.length; i++) {
    const j = 2 * i
    out[i] = 0.25 * (x[j - 1] ?? x[j]) + 0.5 * x[j] + 0.25 * (x[j + 1] ?? x[j])
  }
  return out
}

// ── Tempo ─────────────────────────────────────────────────────────────────────

export interface TempoCandidate { bpm: number; strength: number }

const BPM_MIN = 50
const BPM_MAX = 220
/** Mild preference for the tempo range beats are actually written in, so a
 *  96 bpm groove doesn't report as 192 or 48. log2-gaussian, 1 octave wide. */
const PRIOR_CENTER_BPM = 110

function tempoPrior(bpm: number): number {
  const o = Math.log2(bpm / PRIOR_CENTER_BPM)
  return Math.exp(-0.5 * o * o)
}

export function estimateTempo(samples44k: Float32Array, sampleRate = 44100): TempoCandidate[] {
  const x = sampleRate >= 40000 ? decimate2(samples44k) : samples44k
  const sr = sampleRate >= 40000 ? sampleRate / 2 : sampleRate
  const SIZE = 1024
  const HOP = 256
  const frameRate = sr / HOP

  // Onset strength: half-wave-rectified spectral flux of log-compressed magnitude.
  const flux: number[] = []
  let prev: Float64Array | null = null
  for (const mag of stft(x, SIZE, HOP)) {
    for (let k = 0; k < mag.length; k++) mag[k] = Math.log1p(100 * mag[k])
    let f = 0
    if (prev) for (let k = 1; k < mag.length; k++) f += Math.max(0, mag[k] - prev[k])
    flux.push(f)
    prev = mag
  }
  if (flux.length < frameRate * 4) return [] // < ~4 s: no reliable beat

  // Remove the slow trend (≈0.5 s moving average) so only pulses remain.
  const W = Math.max(1, Math.round(frameRate * 0.5))
  const env = new Float64Array(flux.length)
  let acc = 0
  for (let i = 0; i < flux.length; i++) {
    acc += flux[i]
    if (i >= W) acc -= flux[i - W]
    env[i] = Math.max(0, flux[i] - acc / Math.min(i + 1, W))
  }

  const ac = (lag: number): number => {
    let s = 0
    for (let i = lag; i < env.length; i++) s += env[i] * env[i - lag]
    return s / (env.length - lag)
  }
  const ac0 = ac(0) || 1
  const lagMin = Math.floor((60 * frameRate) / BPM_MAX)
  const lagMax = Math.ceil((60 * frameRate) / BPM_MIN)
  const acv = new Float64Array(2 * lagMax + 2)
  for (let l = lagMin; l <= Math.min(2 * lagMax + 1, env.length - 1); l++) acv[l] = ac(l) / ac0

  // Score each beat-period lag: its own periodicity plus the bar-level echo at 2×.
  const score = new Float64Array(lagMax + 1)
  for (let l = lagMin; l <= lagMax; l++) {
    score[l] = (acv[l] + 0.5 * (acv[2 * l] ?? 0)) * tempoPrior((60 * frameRate) / l)
  }

  const peaks: TempoCandidate[] = []
  for (let l = lagMin + 1; l < lagMax; l++) {
    if (score[l] > 0 && score[l] >= score[l - 1] && score[l] > score[l + 1]) {
      // Parabolic interpolation for sub-frame lag → sub-bpm precision.
      const a = score[l - 1], b = score[l], c = score[l + 1]
      const den = a - 2 * b + c
      const shift = den !== 0 ? (0.5 * (a - c)) / den : 0
      peaks.push({ bpm: (60 * frameRate) / (l + shift), strength: b })
    }
  }
  peaks.sort((p, q) => q.strength - p.strength)
  const top = peaks[0]?.strength || 1
  return peaks.slice(0, 3).map(p => ({ bpm: Math.round(p.bpm * 10) / 10, strength: Math.round((p.strength / top) * 100) / 100 }))
}

// ── Key ───────────────────────────────────────────────────────────────────────

export const PITCH_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

// Krumhansl–Kessler probe-tone profiles.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

export interface KeyCandidate { name: string; correlation: number }
export interface KeyEstimate {
  name: string
  correlation: number
  /** Gap to the runner-up. < ~0.05 = genuinely ambiguous. */
  margin: number
  alternatives: KeyCandidate[]
  chroma: number[]
}

function pearson(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}

const rotate = (p: number[], k: number) => p.map((_, i) => p[(i - k + 12) % 12])

export function chromaProfile(samples44k: Float32Array, sampleRate = 44100): number[] {
  const x = sampleRate >= 40000 ? decimate2(samples44k) : samples44k
  const sr = sampleRate >= 40000 ? sampleRate / 2 : sampleRate
  const SIZE = 8192 // 2.7 Hz bins at 22.05 kHz — resolves semitones down to ~65 Hz
  const binHz = sr / SIZE
  const kLo = Math.ceil(65 / binHz)
  const kHi = Math.floor(2100 / binHz)
  const pcOfBin = new Int8Array(SIZE / 2).fill(-1)
  for (let k = kLo; k <= kHi; k++) {
    const midi = 69 + 12 * Math.log2((k * binHz) / 440)
    pcOfBin[k] = ((Math.round(midi) % 12) + 12) % 12
  }

  const total = new Array(12).fill(0)
  for (const mag of stft(x, SIZE, SIZE / 2)) {
    const frame = new Array(12).fill(0)
    for (let k = kLo; k <= kHi; k++) frame[pcOfBin[k]] += mag[k]
    // Normalise per frame so loud drum hits don't outvote sustained harmony.
    const peak = Math.max(...frame)
    if (peak > 1e-6) for (let i = 0; i < 12; i++) total[i] += frame[i] / peak
  }
  const max = Math.max(...total) || 1
  return total.map(v => Math.round((v / max) * 1000) / 1000)
}

export function estimateKey(samples44k: Float32Array, sampleRate = 44100): KeyEstimate | null {
  const chroma = chromaProfile(samples44k, sampleRate)
  if (chroma.every(v => v === 0)) return null
  const all: KeyCandidate[] = []
  for (let k = 0; k < 12; k++) {
    all.push({ name: `${PITCH_NAMES[k]} major`, correlation: pearson(chroma, rotate(MAJOR, k)) })
    all.push({ name: `${PITCH_NAMES[k]} minor`, correlation: pearson(chroma, rotate(MINOR, k)) })
  }
  all.sort((a, b) => b.correlation - a.correlation)
  const r2 = (v: number) => Math.round(v * 100) / 100
  return {
    name: all[0].name,
    correlation: r2(all[0].correlation),
    margin: r2(all[0].correlation - all[1].correlation),
    alternatives: all.slice(1, 3).map(c => ({ name: c.name, correlation: r2(c.correlation) })),
    chroma,
  }
}
