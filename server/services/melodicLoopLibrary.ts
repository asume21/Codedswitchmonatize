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
  durationSec?: number;
  bars?: number;
}

export type LoopChopKind = 'half-bar' | 'bar' | 'two-bar';

export interface MelodicLoopChop {
  id: string;
  loopId: string;
  url: string;
  fileName: string;
  pack: string;
  bpm: number;
  key: string;
  root: string;
  mode: LoopMode;
  instrument: string;
  kind: LoopChopKind;
  startSec: number;
  durationSec: number;
  bar: number;
  beat: number;
  tags: string[];
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

function parseLoopName(fileName: string): Omit<MelodicLoop, 'id' | 'relPath' | 'url' | 'pack' | 'durationSec' | 'bars'> {
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

function readWavDurationSec(filePath: string): number | undefined {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const header = Buffer.alloc(12);
      if (fs.readSync(fd, header, 0, 12, 0) !== 12) return undefined;
      if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') {
        return undefined;
      }

      let offset = 12;
      let sampleRate = 0;
      let channels = 0;
      let bitsPerSample = 0;
      let dataBytes = 0;
      const chunk = Buffer.alloc(8);

      while (fs.readSync(fd, chunk, 0, 8, offset) === 8) {
        const id = chunk.toString('ascii', 0, 4);
        const size = chunk.readUInt32LE(4);
        const dataOffset = offset + 8;

        if (id === 'fmt ') {
          const fmt = Buffer.alloc(Math.min(size, 32));
          fs.readSync(fd, fmt, 0, fmt.length, dataOffset);
          channels = fmt.readUInt16LE(2);
          sampleRate = fmt.readUInt32LE(4);
          bitsPerSample = fmt.readUInt16LE(14);
        } else if (id === 'data') {
          dataBytes = size;
          break;
        }

        offset = dataOffset + size + (size % 2);
      }

      const bytesPerSampleFrame = channels * (bitsPerSample / 8);
      if (!sampleRate || !bytesPerSampleFrame || !dataBytes) return undefined;
      return dataBytes / bytesPerSampleFrame / sampleRate;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
}

function estimateBars(loop: Pick<MelodicLoop, 'bpm' | 'durationSec'>): number | undefined {
  if (!loop.bpm || !loop.durationSec) return undefined;
  const barSec = (60 / loop.bpm) * 4;
  const bars = Math.round(loop.durationSec / barSec);
  if (!Number.isFinite(bars)) return undefined;
  return Math.max(1, Math.min(16, bars));
}

function isPhraseLoop(loop: MelodicLoop): boolean {
  return Boolean(loop.key && loop.bpm > 0 && /mini.?sp/i.test(loop.pack));
}

function chopTags(loop: MelodicLoop, kind: LoopChopKind): string[] {
  const tags = [loop.instrument, loop.mode, kind];
  const name = `${loop.fileName} ${loop.pack}`.toLowerCase();
  if (/dark|moody|min|minor|m\b/.test(name)) tags.push('dark', 'sad');
  if (/soul|disco|major|happy|bright/.test(name)) tags.push('happy', 'soulful');
  if (/violin|viola|cello|string/.test(name)) tags.push('strings', 'sustain');
  if (/fullmix/.test(name)) tags.push('fullmix');
  return [...new Set(tags.filter(Boolean))];
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
      const durationSec = readWavDurationSec(full);
      const bars = estimateBars({ bpm: parsed.bpm, durationSec });
      return {
        id: relPath,
        relPath,
        url: `/api/loops/file?p=${encodeURIComponent(relPath)}`,
        pack: path.basename(path.dirname(full)),
        durationSec,
        bars,
        ...parsed,
      };
    });
    this.initialized = true;
    return this.loops;
  }

  all(): MelodicLoop[] {
    return this.scan();
  }

  chops(force = false): MelodicLoopChop[] {
    const loops = this.scan(force).filter(isPhraseLoop);
    const chops: MelodicLoopChop[] = [];

    for (const loop of loops) {
      const barSec = (60 / loop.bpm) * 4;
      const durationSec = loop.durationSec ?? barSec * 4;
      const totalBars = loop.bars ?? Math.max(1, Math.floor(durationSec / barSec));
      const maxBars = Math.max(1, Math.min(totalBars, Math.floor(durationSec / barSec)));

      const add = (kind: LoopChopKind, bar: number, beat: number, lengthBeats: number) => {
        const startSec = (bar * 4 + beat) * (60 / loop.bpm);
        const chopDurationSec = lengthBeats * (60 / loop.bpm);
        if (startSec + chopDurationSec > durationSec + 0.05) return;
        const id = `${loop.id}#${kind}:${bar}:${beat}`;
        chops.push({
          id,
          loopId: loop.id,
          url: loop.url,
          fileName: loop.fileName,
          pack: loop.pack,
          bpm: loop.bpm,
          key: loop.key,
          root: loop.root,
          mode: loop.mode,
          instrument: loop.instrument,
          kind,
          startSec: Number(startSec.toFixed(4)),
          durationSec: Number(chopDurationSec.toFixed(4)),
          bar,
          beat,
          tags: chopTags(loop, kind),
        });
      };

      for (let bar = 0; bar < maxBars; bar++) {
        add('bar', bar, 0, 4);
        add('half-bar', bar, 0, 2);
        add('half-bar', bar, 2, 2);
      }
      for (let bar = 0; bar + 1 < maxBars; bar += 2) {
        add('two-bar', bar, 0, 8);
      }
    }

    return chops;
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
