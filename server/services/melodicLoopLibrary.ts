import fs from 'fs';
import path from 'path';

/**
 * Melodic Loop Library
 *
 * Indexes the real instrument loop packs (strings/keys/guitar) the producer
 * downloads into `audio/loops/`. These are full melodic phrases tagged in their
 * filenames with BPM + key + instrument, e.g.:
 *
 *   130_Cm_Violin2_09_SP.wav   → 130 BPM, C minor, Violin 2
 *   120_F#m_04_FullMix_SP.wav  → 120 BPM, F# minor, full string mix
 *
 * The Organism's melodic loop layer picks a loop matching the active song key +
 * tempo and plays it (pitch/tempo-nudged) instead of synthesizing the melody —
 * the jump from "synth demo" to "real beat". Files live OUTSIDE git (too big);
 * see .gitignore `audio/loops/`. Production delivery (object storage) is a
 * follow-up; this serves them straight from disk in dev.
 */

export type LoopMode = 'minor' | 'major';

export interface MelodicLoop {
  id: string;          // stable id (relative path, url-safe)
  relPath: string;     // path relative to the loops dir (for streaming)
  url: string;         // API url the client loads
  fileName: string;
  pack: string;        // immediate parent folder
  bpm: number;         // parsed tempo (0 if unknown)
  key: string;         // root + quality, e.g. "Cm", "F#m", "G"
  root: string;        // pitch class without quality, e.g. "C", "F#"
  mode: LoopMode;
  instrument: string;  // violin / viola / cello / fullmix / keys / guitar / unknown
}

const KEY_RE = /^([A-G][#b]?)(m)?$/;

/**
 * Map a filename to a CANONICAL instrument category, so style→instrument routing
 * is clean regardless of how a pack names things (ElPiano, Wurl, Organ → keys;
 * 12string, Hofner, Strat → guitar; Violin/Viola/Cello → strings).
 */
function detectInstrument(name: string): string {
  const n = name.toLowerCase();
  if (/fullmix/.test(n)) return 'fullmix';
  if (/violin|viola|cello|\bstring|orchestr/.test(n)) return 'strings';
  if (/guitar|12\s?string|hofner|strat|tele|nylon|\bag\b|acoustic.?g/.test(n)) return 'guitar';
  if (/piano|rhodes|wurl|epiano|fmpiano|elpiano|dpiano|organ|\bkeys?\b|hofner/.test(n)) return 'keys';
  if (/flute|sax|horn|brass|trumpet|hymn/.test(n)) return 'brass';
  if (/pad|synth/.test(n)) return 'pad';
  return 'unknown';
}

function parseLoopName(fileName: string): Omit<MelodicLoop, 'id' | 'relPath' | 'url' | 'pack'> {
  const base = fileName.replace(/\.wav$/i, '');
  const tokens = base.split('_');

  let bpm = 0;
  let key = '';
  let root = '';
  let mode: LoopMode = 'minor';

  for (const tok of tokens) {
    if (!bpm) {
      const n = Number.parseInt(tok, 10);
      if (Number.isFinite(n) && n >= 50 && n <= 220 && /^\d+$/.test(tok)) {
        bpm = n;
        continue;
      }
    }
    if (!key) {
      const m = tok.match(KEY_RE);
      if (m) {
        key = tok;
        root = m[1];
        mode = m[2] === 'm' ? 'minor' : 'major';
        continue;
      }
    }
  }

  // Instrument is a canonical category derived from the whole filename.
  const instrument = detectInstrument(base);

  return { fileName, bpm, key, root, mode, instrument };
}

class MelodicLoopLibrary {
  private loopsDir: string;
  private loops: MelodicLoop[] = [];
  private initialized = false;

  constructor() {
    this.loopsDir = path.join(process.cwd(), 'audio', 'loops');
  }

  private walk(dir: string, acc: string[]): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) this.walk(full, acc);
      else if (e.isFile() && /\.wav$/i.test(e.name)) acc.push(full);
    }
  }

  scan(force = false): MelodicLoop[] {
    if (this.initialized && !force) return this.loops;
    this.loops = [];
    if (!fs.existsSync(this.loopsDir)) {
      this.initialized = true;
      return this.loops;
    }
    const files: string[] = [];
    this.walk(this.loopsDir, files);
    this.loops = files.map((full) => {
      const relPath = path.relative(this.loopsDir, full).split(path.sep).join('/');
      const parsed = parseLoopName(path.basename(full));
      return {
        id: relPath,
        relPath,
        url: `/api/loops/file?p=${encodeURIComponent(relPath)}`,
        pack: path.basename(path.dirname(full)),
        ...parsed,
      };
    });
    this.initialized = true;
    return this.loops;
  }

  all(): MelodicLoop[] {
    return this.scan();
  }

  /** Resolve a safe absolute path for a relative loop path (prevents traversal). */
  resolve(relPath: string): string | null {
    const normalized = path.normalize(relPath).split(path.sep).join('/');
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) return null;
    const abs = path.join(this.loopsDir, normalized);
    if (!abs.startsWith(this.loopsDir)) return null;
    if (!fs.existsSync(abs) || !/\.(wav|ogg|mp3)$/i.test(abs)) return null;
    return abs;
  }
}

export const melodicLoopLibrary = new MelodicLoopLibrary();
