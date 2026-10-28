#!/usr/bin/env node
/**
 * Reproducible evidence comparison for two CodeSwitch Fire Beats captures.
 * This is a measurement baseline, NOT an AI-agent capability score.
 *
 * node scripts/compare-perception-evidence.mjs <baseline-manifest.json> <candidate-manifest.json>
 * Exits nonzero for missing/noncomparable evidence; prints machine-readable JSON.
 */
import fs from 'node:fs';
import path from 'node:path';

const [leftPath, rightPath] = process.argv.slice(2);
if (!leftPath || !rightPath) {
  console.error('Usage: node scripts/compare-perception-evidence.mjs <baseline-manifest.json> <candidate-manifest.json>');
  process.exit(2);
}
const load = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
const baseline = load(leftPath);
const candidate = load(rightPath);
const problems = [];
if (baseline.seed !== candidate.seed) problems.push('Different random seeds');
if (baseline.comparable === false || candidate.comparable === false) problems.push('Manifest explicitly marked not comparable');
const resolveArtifact = (manifestFile, artifact) => {
  if (!artifact || typeof artifact !== 'string') return null;
  if (path.isAbsolute(artifact)) return artifact;
  const repoRelative = path.resolve(artifact);
  return fs.existsSync(repoRelative) ? repoRelative : path.resolve(path.dirname(path.resolve(manifestFile)), artifact);
};
const captures = (manifest, manifestFile) => {
  const found = new Map();
  for (const item of manifest.captures ?? []) {
    const key = String(item.preset ?? 'unknown') + '/' + String(item.stem ?? 'unknown');
    if (found.has(key)) problems.push('Duplicate capture: ' + key + ' in ' + manifestFile);
    const file = resolveArtifact(manifestFile, item.analysis);
    if (!file || !fs.existsSync(file)) {
      problems.push('Missing analysis for ' + key + ': ' + manifestFile);
      continue;
    }
    try { found.set(key, JSON.parse(fs.readFileSync(file, 'utf8'))); }
    catch (error) { problems.push('Invalid analysis for ' + key + ': ' + String(error)); }
  }
  return found;
};
const a = captures(baseline, leftPath), b = captures(candidate, rightPath);
const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
const fields = ['durationSeconds','rmsDb','peakDb','clippingPercent','spectralCentroidHz','estimatedBpm','onsetCount','onsetTimingStdDevMs'];
const comparisons = keys.map((key) => {
  const before = a.get(key), after = b.get(key);
  if (!before || !after) {
    problems.push('Unpaired capture: ' + key);
    return { key, paired: false };
  }
  const delta = {};
  for (const f of fields) {
    const x = before[f], y = after[f];
    delta[f] = typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
      ? Number((y - x).toFixed(4)) : null;
  }
  if (Math.abs(delta.durationSeconds ?? 0) > 0.2) problems.push('Capture durations differ for ' + key);
  return { key, paired: true, before: Object.fromEntries(fields.map(f => [f, before[f] ?? null])),
    after: Object.fromEntries(fields.map(f => [f, after[f] ?? null])), delta };
});
if (!comparisons.length) problems.push('No capture evidence found');
const report = {
  experiment: 'CodeSwitch WebEar / Web Perception evidence comparison',
  kind: 'signal-metric comparison; not a verified AI-agent A/B outcome',
  input: { baselineManifest: leftPath, candidateManifest: rightPath, seed: baseline.seed },
  comparable: problems.length === 0,
  problems, comparisons,
  limitations: [
    'Changes in signal metrics do not independently prove audible quality, causation or agent effectiveness.',
    'Onsets and BPM in full mixes can reflect instrumental parts rather than vocals.',
    'An AI-agent trial requires isolated, blinded runs and independent outcome grading.',
    'The Fire Beats capture bench does not itself capture all six Web Perception sensors.'
  ]
};
console.log(JSON.stringify(report, null, 2));
if (problems.length) process.exitCode = 1;
