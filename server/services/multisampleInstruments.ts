import fs from 'fs';
import path from 'path';

/**
 * Multisample Instrument Library
 *
 * Builds PLAYABLE instruments from note-mapped one-shot packs (e.g. Soulful Keys
 * `SK_ElPiano01_A1.wav … C6`). Unlike loops (fixed phrases), these let the
 * Organism play its OWN generated melodies/chords with a real recorded instrument
 * — the "replace the synth engine with real instruments" upgrade, per style.
 *
 * A file is a note sample when its last `_`-token is a note name (A1, C#3, D#1).
 * Instrument id = the rest of the basename. We group files into {note: url} maps;
 * the client builds a Tone.Sampler that pitch-shifts between the mapped notes, so
 * a sparse set (every few semitones) is enough.
 *
 * Files are served by the existing /api/loops/file?p= endpoint (same dir).
 */

const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;

export interface PlayableInstrument {
  id: string;            // e.g. "SK_ElPiano01"
  name: string;          // display name
  family: string;        // keys | strings | guitar | brass | woodwind | other
  notes: Record<string, string>;  // note name -> stream url
  noteCount: number;
}

function classifyFamily(id: string): string {
  const n = id.toLowerCase();
  if (/piano|rhodes|wurl|epiano|fmpiano|elpiano|dpiano|organ|key/.test(n)) return 'keys';
  if (/violin|viola|cello|string|vln|vla|llvln/.test(n)) return 'strings';
  if (/guitar|strat|tele|nylon/.test(n)) return 'guitar';
  if (/horn|tbn|trombone|trumpet|tuba|brass/.test(n)) return 'brass';
  if (/flute|oboe|clar|bassoon|sax|woodwind/.test(n)) return 'woodwind';
  return 'other';
}

class MultisampleInstrumentLibrary {
  private loopsDir: string;
  private instruments: PlayableInstrument[] = [];
  private initialized = false;

  constructor() {
    this.loopsDir = path.join(process.cwd(), 'audio', 'loops');
  }

  private walk(dir: string, acc: string[]): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('._') || e.name === '__MACOSX') continue; // macOS metadata junk
      const full = path.join(dir, e.name);
      if (e.isDirectory()) this.walk(full, acc);
      else if (e.isFile() && /\.(wav|ogg|mp3)$/i.test(e.name)) acc.push(full);
    }
  }

  scan(force = false): PlayableInstrument[] {
    if (this.initialized && !force) return this.instruments;
    this.instruments = [];
    if (!fs.existsSync(this.loopsDir)) { this.initialized = true; return this.instruments; }

    const files: string[] = [];
    this.walk(this.loopsDir, files);
    // Prefer compressed (ogg/mp3) over wav for the same note — production ships the
    // small ogg; wav stays local. Sorting compressed-first makes first-write win.
    const rank = (f: string) => (/\.wav$/i.test(f) ? 1 : 0);
    files.sort((a, b) => rank(a) - rank(b));

    // Group note-sample files by instrument id.
    const byInstrument = new Map<string, Record<string, string>>();
    for (const full of files) {
      const base = path.basename(full).replace(/\.(wav|ogg|mp3)$/i, '');
      const tokens = base.split('_');
      if (tokens.length < 2) continue;
      const last = tokens[tokens.length - 1];
      const m = last.match(NOTE_RE);
      if (!m) continue;                       // not a single-note sample (skip chords/loops)
      const note = `${m[1]}${m[2] ?? ''}${m[3].replace('-', '')}`; // C-2 -> C2
      const id = tokens.slice(0, -1).join('_');
      const relPath = path.relative(this.loopsDir, full).split(path.sep).join('/');
      const map = byInstrument.get(id) ?? {};
      // Prefer the first sample seen for a note (ignore velocity/round-robin dupes).
      if (!map[note]) map[note] = `/api/loops/file?p=${encodeURIComponent(relPath)}`;
      byInstrument.set(id, map);
    }

    for (const [id, notes] of byInstrument) {
      const noteCount = Object.keys(notes).length;
      if (noteCount < 4) continue;            // need enough notes to be a playable instrument
      this.instruments.push({
        id,
        name: id.replace(/^SK_/, '').replace(/_/g, ' '),
        family: classifyFamily(id),
        notes,
        noteCount,
      });
    }
    this.instruments.sort((a, b) => b.noteCount - a.noteCount);
    this.initialized = true;
    return this.instruments;
  }

  all(): PlayableInstrument[] { return this.scan(); }
}

export const multisampleInstruments = new MultisampleInstrumentLibrary();
