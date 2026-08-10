// Hip-hop Quality Audit
// ────────────────────────────────────────────────────────────────────────────
// Scores a deterministic capture without pretending that a waveform alone can
// prove taste. It combines WebEar analysis JSON with the capture manifest's
// Transport/runtime metadata, and marks missing evidence instead of inventing a
// confident score.
//
// Usage:
//   npm run hiphop-audit -- marketing/output/fire-beats/remediation-clean-20260808/manifest.json

import fs from 'node:fs'
import path from 'node:path'

const manifestPath = path.resolve(process.argv[2] || 'marketing/output/fire-beats/remediation-clean-20260808/manifest.json')
const manifestDir = path.dirname(manifestPath)
const outputDir = path.join('marketing', 'output', 'hip-hop-quality')
fs.mkdirSync(outputDir, { recursive: true })

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const captures = Object.fromEntries((manifest.captures ?? []).map((capture) => [capture.stem, capture]))

function resolveArtifact(value) {
  if (!value) return null
  if (path.isAbsolute(value)) return value
  // Capture manifests historically store paths relative to the repository;
  // newer callers may store paths beside the manifest. Accept both formats.
  const repoRelative = path.resolve(value)
  if (fs.existsSync(repoRelative)) return repoRelative
  return path.resolve(manifestDir, value)
}

function readAnalysis(stem) {
  const capture = captures[stem]
  const file = resolveArtifact(capture?.analysis)
  if (!file || !fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const analysis = Object.fromEntries(['full', 'drum', 'bass', 'melody', 'chord', 'texture'].map((stem) => [stem, readAnalysis(stem)]))
const runtime = manifest.presets?.[Object.keys(manifest.presets ?? {})[0]]?.runtime ?? null
const fullTimeline = captures.full?.timeline ?? []
const uniqueSections = new Set(fullTimeline.map((point) => point.section).filter((section) => section && section !== 'none'))
const uniqueChords = new Set(fullTimeline.map((point) => point.chord).filter(Boolean))
const stemNames = ['full', 'drum', 'bass', 'melody', 'chord', 'texture']
const fullStart = fullTimeline[0]
const synchronizedStemEvidence = stemNames.every((stem) => {
  const timeline = captures[stem]?.timeline ?? []
  const first = timeline[0]
  return Boolean(first && fullStart && first.section === fullStart.section && first.chord === fullStart.chord && first.transport?.bpm === fullStart.transport?.bpm)
})
const bpm = runtime?.transport?.bpm ?? null
const duration = analysis.full?.durationSeconds ?? 0
const findings = []

function clamp(value, min = 0, max = 10) {
  return Math.max(min, Math.min(max, value))
}

function metric(name, score, evidence, reasons = [], confidence = 'high') {
  const result = { score: Number(clamp(score).toFixed(1)), confidence, evidence, reasons }
  findings.push({ name, ...result })
  return result
}

function percent(value) {
  return `${Number(value ?? 0).toFixed(1)}%`
}

const allAnalyses = Object.values(analysis).filter(Boolean)
const clipped = allAnalyses.filter((item) => (item.clippingPercent ?? 0) > 0)
const silent = allAnalyses.filter((item) => item.isSilent)
const technical = metric(
  'technical cleanliness',
  10 - clipped.length * 2.5 - silent.length * 3,
  allAnalyses.length === 6,
  [
    clipped.length ? `${clipped.length} stem(s) show clipping` : 'no clipping detected',
    silent.length ? `${silent.length} stem(s) are silent` : 'no silent stems',
    `full peak ${Number(analysis.full?.peakDb ?? -Infinity).toFixed(1)} dBFS`,
  ],
  allAnalyses.length === 6 ? 'high' : 'low',
)

const fullBand = analysis.full?.bandEnergy ?? {}
const drum = analysis.drum
const drumScore =
  (drum && drum.onsetCount >= 8 ? 2.5 : 0) +
  (drum && drum.dynamicRangeDb >= 8 ? 2.5 : drum && drum.dynamicRangeDb >= 4 ? 1.5 : 0) +
  (drum && drum.peakDb <= -0.5 ? 2 : drum && drum.peakDb <= 0.5 ? 1 : 0) +
  (drum && drum.rmsDb > -25 && drum.rmsDb < -10 ? 2 : 0)
const drums = metric(
  'drum programming and authority',
  drumScore,
  Boolean(drum),
  [
    `isolated drum onsets ${drum?.onsetCount ?? 'unknown'}`,
    `isolated drum RMS ${drum?.rmsDb?.toFixed(1) ?? 'unknown'} dBFS`,
    'onset placement alone cannot prove a convincing backbeat or fill vocabulary',
  ],
  drum ? 'medium' : 'low',
)

const sub = Number(fullBand.sub ?? 0) * 100
const bassBand = Number(fullBand.bass ?? 0) * 100
const lowMid = Number(fullBand.lowMid ?? 0) * 100
const lowEnd = metric(
  'kick/bass/sub relationship',
  (sub >= 5 && sub <= 20 ? 3.5 : sub >= 3 ? 2 : 0) +
    (bassBand >= 12 && bassBand <= 38 ? 3.5 : bassBand >= 8 ? 2 : 0) +
    (lowMid < 48 ? 2 : lowMid < 58 ? 1 : 0) +
    (analysis.bass?.isSilent ? 0 : 1),
  Boolean(analysis.full && analysis.bass),
  [`full sub ${percent(sub)}`, `full bass ${percent(bassBand)}`, `full low-mid ${percent(lowMid)}`],
  analysis.full && analysis.bass ? 'medium' : 'low',
)

const timingStd = analysis.full?.onsetTimingStdDevMs
const groove = metric(
  'groove and pocket',
  (bpm >= 70 && bpm <= 180 ? 2 : 0) +
    (timingStd == null ? 1 : timingStd <= 12 ? 4 : timingStd <= 20 ? 3 : timingStd <= 35 ? 1.5 : 0) +
    (analysis.full?.onsetCount >= 8 ? 2 : 0) +
    (analysis.drum?.onsetCount >= 8 ? 2 : 0),
  Boolean(bpm && timingStd != null),
  [
    `Transport BPM ${bpm ?? 'unknown'}`,
    `full onset timing deviation ${timingStd == null ? 'unknown' : `${timingStd.toFixed(1)} ms`}`,
    'audio timing cannot prove whether the swing feels intentional',
  ],
  bpm && timingStd != null ? 'medium' : 'low',
)

const melodyEvents = runtime?.gainReport?.melody?.part?.events ?? null
const chordVoice = runtime?.gainReport?.chord?.voice?.performerId ?? null
// Part-event counts and a performer id prove that something was scheduled;
// they do not prove a memorable phrase. Keep this dimension deliberately
// conservative until the capture includes note-level motif/interval evidence.
const musicality = metric(
  'musical idea and harmonic support',
  Math.min(4,
    (melodyEvents >= 8 ? 1.5 : melodyEvents > 0 ? 0.75 : 0) +
    (chordVoice ? 1 : 0) +
    (analysis.melody?.isSilent === false ? 0.75 : 0) +
    (analysis.chord?.isSilent === false ? 0.75 : 0)),
  false,
  [
    `melody Part events ${melodyEvents ?? 'unknown'}`,
    `chord voice ${chordVoice ?? 'unknown'}`,
    'motif coherence, scale correctness, and musical taste require note-level data or listening',
  ],
  'low',
)

const arrangementEvidence = Boolean(
  !manifest.comparable &&
  duration >= 28 &&
  uniqueSections.size >= 3 &&
  fullTimeline.length >= 5,
)
const arrangement = metric(
  'song-level arrangement',
  arrangementEvidence ? 8 : uniqueSections.size >= 2 ? 5 : 2,
  arrangementEvidence,
  arrangementEvidence
    ? [`${uniqueSections.size} sections across ${fullTimeline.length} snapshots`, `${uniqueChords.size} distinct chord labels observed`]
    : [`capture duration ${duration.toFixed(1)} seconds`, `${uniqueSections.size} distinct sections observed`, 'need >=28s Song Mode with >=3 sections and a timeline'],
  arrangementEvidence ? 'medium' : 'low',
)

const weighted =
  technical.score * 0.15 +
  drums.score * 0.22 +
  lowEnd.score * 0.20 +
  groove.score * 0.20 +
  musicality.score * 0.13 +
  arrangement.score * 0.10
// A full Song Mode timeline plus all six independently captured stems is
// enough for a high-confidence *quality score*.  Exact cross-stem alignment
// is a separate claim: restarts can legitimately advance the live arranger,
// so we expose that evidence independently instead of hiding it in the score.
const allStemEvidence = ['full', 'drum', 'bass', 'melody', 'chord', 'texture']
  .every((role) => Boolean(analysis[role]))
const machineConfidence = arrangementEvidence && allStemEvidence && technical.confidence === 'high' && groove.confidence === 'medium' && musicality.score >= 6
  ? 'high'
  : arrangementEvidence ? 'medium' : 'low'
const crossStemConfidence = synchronizedStemEvidence ? 'high' : allStemEvidence ? 'medium' : 'low'
const tasteConfidence = 'low'
const confidence = machineConfidence
const verdict = musicality.score < 6
  ? 'Technically correct foundation, but the capture does not demonstrate a memorable musical hook or strong identity yet.'
  : arrangement.score < 5
  ? 'Hip-hop foundation is measurable, but this capture cannot prove a real full-song hip-hop beat yet.'
  : weighted >= 7.5
    ? 'Strong hip-hop candidate; human listening is still required for “fire” and commercial taste.'
    : weighted >= 5.5
      ? 'Usable hip-hop foundation with musical or arrangement weaknesses to fix.'
      : 'Technically active beat, but it does not yet clear the hip-hop quality bar.'

const report = {
  manifest: manifestPath,
  preset: Object.keys(manifest.presets ?? {})[0] ?? null,
  durationSeconds: duration,
  bpm,
  weightedScore: Number(weighted.toFixed(1)),
  confidence,
  machineConfidence,
  crossStemConfidence,
  tasteConfidence,
  synchronizedStemEvidence,
  verdict,
  dimensions: Object.fromEntries(findings.map(({ name, ...value }) => [name, value])),
  evidenceGaps: [
    ...(arrangementEvidence ? [] : ['longer Song Mode capture']),
    ...(synchronizedStemEvidence ? [] : ['same-timeline stem restart evidence']),
    'note-level melody/chord timeline for motif and scale checks',
    'human or audio-capable-model listening for timbre, pocket, and taste',
  ],
}

const reportName = path.basename(manifestPath, path.extname(manifestPath)) === 'manifest'
  ? path.basename(manifestDir)
  : path.basename(manifestPath, path.extname(manifestPath))
const outputPath = path.join(outputDir, `${reportName}.json`)
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))

console.log(`\nHip-hop quality: ${report.weightedScore}/10 (${confidence} confidence)`)
console.log(`Verdict: ${verdict}`)
for (const [name, value] of Object.entries(report.dimensions)) {
  console.log(`  ${name.padEnd(36)} ${value.score.toFixed(1)}/10  [${value.confidence}]`)
}
console.log(`Report: ${outputPath}`)
