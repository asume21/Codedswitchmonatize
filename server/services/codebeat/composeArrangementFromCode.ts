import { hashString } from '../codeToMusic/noteMapping';
import { GENRE_CONFIGS } from '../codeToMusic/genreConfigs';
import {
  sanitizeSectionScore,
  type ArrangementPlan,
  type ArrangementSection,
  type ArrangementSectionName,
  type ScoreNote,
} from '../../../shared/arrangement';
import type { CodeFingerprint, CodeUnit } from '../../../shared/types/codeFingerprint';

// Keys are BARE NOTE NAMES only — NOTE_TO_SEMITONE (what validateArrangementPlan
// checks) contains 'C','G','Bb'… but NOT 'Am'/'Em'. Minor quality is expressed
// through the PROGRESSION (lowercase roman numerals), never the key string —
// this matches scalePitchClasses(key, progression), which reads minor-ness from
// the progression's first numeral.
const KEY_POOL = ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb', 'E'];
// Minor-leaning tonal centers (still bare notes; MINOR_PROG makes them minor).
const MINOR_KEYS = ['A', 'E', 'D', 'C'];
// Minor-ish moods lean to minor progressions.
const MINOR_PROG = ['i', 'VI', 'III', 'VII'];
const MAJOR_PROG = ['I', 'V', 'vi', 'IV'];
const TENSION_PROG = ['i', 'iv', 'V', 'i'];

/** Deterministic pick from an array by hash. */
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Map complexity (1-10) to a bpm nudge around the genre base. */
function bpmForCode(fp: CodeFingerprint, baseBpm: number): number {
  const nudge = Math.round((fp.complexity - 5) * 2); // -8..+10
  return Math.max(40, Math.min(220, baseBpm + nudge));
}

/** Build the identifier motif: 2-4 in-key notes hashed from names. */
function motifNotes(fp: CodeFingerprint): ScoreNote[] {
  const names = fp.identifiers.slice(0, 4);
  if (names.length === 0) return [];
  return names.map((name, i): ScoreNote => {
    const h = hashString(name);
    return {
      slot: i * 4,                    // one note per beat, first bar
      midi: 60 + (h % 24),            // sanitizer snaps to key + clamps register
      durSlots: 2,
      vel: 0.6 + (h % 30) / 100,      // 0.60..0.89
    };
  });
}

function sectionFromUnit(
  unit: CodeUnit,
  name: ArrangementSectionName,
  progression: string[],
): ArrangementSection {
  // Density from nesting, energy from branches+loops — clamped to [0,1].
  const density = Math.max(0.1, Math.min(1, 0.3 + unit.maxNesting * 0.2));
  const energy = Math.max(0.1, Math.min(1, 0.3 + (unit.branches + unit.loops) * 0.15));
  const bars = Math.max(4, Math.min(16, Math.round(unit.span / 2) * 4 || 4));
  return { name, bars, progression, energy, density };
}

/**
 * Compose a deterministic ArrangementPlan from a code fingerprint.
 * The most-referenced unit becomes the drop (hook); others map to
 * verse/build/breakdown by order. Always emits intro + at least one body.
 */
export function composeArrangementFromCode(
  fp: CodeFingerprint,
  opts?: { genre?: string },
): ArrangementPlan {
  const genreKey = (opts?.genre ?? 'pop').toLowerCase();
  const genre = GENRE_CONFIGS[genreKey] ?? GENRE_CONFIGS['pop'];

  // Deterministic global seed from the whole fingerprint.
  const seed = hashString(
    `${fp.language}:${fp.totalLines}:${fp.complexity}:${fp.identifiers.join(',')}`,
  );

  const minorish = fp.mood === 'sad' || fp.mood === 'chill' || fp.complexity > 6;
  const key = minorish ? pick(MINOR_KEYS, seed) : pick(KEY_POOL, seed);
  const bodyProg = minorish ? MINOR_PROG : MAJOR_PROG;
  const bpm = bpmForCode(fp, genre.bpm);

  // Rank units by references (desc), stable by original order for ties.
  const ranked = fp.units
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (b.u.references - a.u.references) || (a.i - b.i))
    .map(x => x.u);

  const sections: ArrangementSection[] = [];
  // Intro.
  sections.push({ name: 'intro', bars: 4, progression: bodyProg, energy: 0.2, density: 0.15 });

  if (ranked.length === 0) {
    // Trivial code: a single verse loop so the band always has something.
    sections.push({ name: 'verse', bars: 8, progression: bodyProg, energy: 0.5, density: 0.4 });
  } else {
    const hook = ranked[0];
    const rest = ranked.slice(1, 4); // cap body sections for a tight arrangement

    // Verse(s) from the non-hook units.
    rest.forEach((u, idx) => {
      const name: ArrangementSectionName = idx === 0 ? 'verse' : idx === 1 ? 'build' : 'breakdown';
      const prog = name === 'build' ? TENSION_PROG : bodyProg;
      sections.push(sectionFromUnit(u, name, prog));
    });

    // The hook → drop, carrying the identifier motif as its score.
    const dropProg = bodyProg;
    const rawMotif = motifNotes(fp);
    const drop = sectionFromUnit(hook, 'drop', dropProg);
    if (rawMotif.length >= 4) {
      const sanitized = sanitizeSectionScore({ melody: rawMotif }, key, dropProg);
      if (sanitized) drop.score = sanitized;
    }
    sections.push(drop);
  }

  // Outro.
  sections.push({ name: 'outro', bars: 4, progression: bodyProg, energy: 0.2, density: 0.15 });

  return {
    id: `codebeat-${seed}`,
    key,
    bpm,
    subGenre: genre.name,
    mood: fp.mood,
    sections,
    acePrompt: `${genre.name} beat generated from ${fp.language} code, ${fp.mood} mood, ${fp.units.length} sections`,
  };
}
