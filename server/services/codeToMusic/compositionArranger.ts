import type { MelodyNote, ParsedCode } from '../../../shared/types/codeToMusic';

export interface CodeMusicSection {
  name: 'intro' | 'body' | 'build' | 'resolution';
  start: number;
  duration: number;
  focus: string;
}

interface ArrangeCodeMusicInput {
  melody: MelodyNote[];
  drumNotes: MelodyNote[];
  chords: { chord: string; notes: string[]; start: number; duration: number }[];
  parsedCode: ParsedCode;
  genre: string;
  bpm: number;
  duration: number;
}

interface ArrangeCodeMusicResult {
  melody: MelodyNote[];
  drumNotes: MelodyNote[];
  sections: CodeMusicSection[];
  duration: number;
}

function clampVelocity(velocity: number): number {
  return Math.max(1, Math.min(127, Math.round(velocity)));
}

function buildSections(duration: number, bpm: number, parsedCode: ParsedCode): CodeMusicSection[] {
  const barDuration = (60 / bpm) * 4;
  const minDuration = barDuration * 8;
  const arrangedDuration = Math.max(duration, minDuration);
  const sectionDuration = arrangedDuration / 4;
  const hasClasses = parsedCode.elements.some(element => element.type === 'class');
  const hasLoops = parsedCode.elements.some(element => element.type === 'loop');
  const hasReturns = parsedCode.elements.some(element => element.type === 'return');

  return [
    {
      name: 'intro',
      start: 0,
      duration: sectionDuration,
      focus: hasClasses ? 'class setup' : 'imports and setup',
    },
    {
      name: 'body',
      start: sectionDuration,
      duration: sectionDuration,
      focus: 'functions and variables',
    },
    {
      name: 'build',
      start: sectionDuration * 2,
      duration: sectionDuration,
      focus: hasLoops ? 'loop energy' : 'branch tension',
    },
    {
      name: 'resolution',
      start: sectionDuration * 3,
      duration: sectionDuration,
      focus: hasReturns ? 'returns and outcomes' : 'final statement',
    },
  ];
}

function sectionAt(sections: CodeMusicSection[], time: number): CodeMusicSection {
  return sections.find(section => time >= section.start && time < section.start + section.duration) || sections[sections.length - 1];
}

function copyMotifToResolution(melody: MelodyNote[], sections: CodeMusicSection[], bpm: number): MelodyNote[] {
  const leadMotif = melody
    .filter(note => note.instrument !== 'bass' && note.instrument !== 'pad')
    .slice(0, 6);

  if (leadMotif.length < 3) return [];

  const resolution = sections.find(section => section.name === 'resolution');
  if (!resolution) return [];

  const motifStart = leadMotif[0].start;
  const targetStart = resolution.start + (60 / bpm);

  return leadMotif.map((note, index) => ({
    ...note,
    start: targetStart + (note.start - motifStart),
    velocity: clampVelocity(note.velocity * (index === 0 ? 0.95 : 0.82)),
    source: `Motif reprise: ${note.source || 'code phrase'}`,
  }));
}

function arrangeMelodyNote(note: MelodyNote, sections: CodeMusicSection[], genre: string): MelodyNote | null {
  const section = sectionAt(sections, note.start);
  const isBass = note.instrument === 'bass';
  const isPad = note.instrument === 'pad';
  const isLead = !isBass && !isPad;

  if (section.name === 'intro') {
    if (isBass) return null;
    if (isLead && !/class|import|function/.test(note.source || '')) return null;
    return {
      ...note,
      velocity: clampVelocity(note.velocity * (isPad ? 0.65 : 0.72)),
    };
  }

  if (section.name === 'body') {
    return {
      ...note,
      velocity: clampVelocity(note.velocity * (isPad ? 0.78 : isBass ? 0.92 : 0.9)),
    };
  }

  if (section.name === 'build') {
    return {
      ...note,
      velocity: clampVelocity(note.velocity * (isBass ? 1.02 : isPad ? 0.72 : 1.04)),
    };
  }

  const resolutionGain = genre === 'classical' ? 0.9 : 0.84;
  return {
    ...note,
    velocity: clampVelocity(note.velocity * (isBass ? 0.88 : isPad ? 0.95 : resolutionGain)),
  };
}

function arrangeDrumNote(note: MelodyNote, sections: CodeMusicSection[]): MelodyNote | null {
  const section = sectionAt(sections, note.start);
  const instrument = note.instrument.replace('drums_', '');

  if (section.name === 'intro') {
    if (instrument !== 'kick' && instrument !== 'hihat') return null;
    if (instrument === 'hihat') return null;
    return { ...note, velocity: clampVelocity(note.velocity * 0.5) };
  }

  if (section.name === 'body') {
    if (instrument === 'crash' || instrument === 'tom') return null;
    return { ...note, velocity: clampVelocity(note.velocity * (instrument === 'hihat' ? 0.64 : 0.78)) };
  }

  if (section.name === 'build') {
    return { ...note, velocity: clampVelocity(note.velocity * (instrument === 'hihat' ? 0.78 : 0.9)) };
  }

  if (instrument === 'crash') {
    return { ...note, velocity: clampVelocity(note.velocity * 0.72) };
  }
  return { ...note, velocity: clampVelocity(note.velocity * (instrument === 'hihat' ? 0.58 : 0.74)) };
}

export function arrangeCodeMusic(input: ArrangeCodeMusicInput): ArrangeCodeMusicResult {
  const sections = buildSections(input.duration, input.bpm, input.parsedCode);
  const motifReprise = copyMotifToResolution(input.melody, sections, input.bpm);
  const arrangedMelody = [...input.melody, ...motifReprise]
    .map(note => arrangeMelodyNote(note, sections, input.genre))
    .filter((note): note is MelodyNote => Boolean(note))
    .sort((a, b) => a.start - b.start);

  const arrangedDrums = input.drumNotes
    .map(note => arrangeDrumNote(note, sections))
    .filter((note): note is MelodyNote => Boolean(note))
    .sort((a, b) => a.start - b.start);

  const lastMelodyEnd = arrangedMelody.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
  const lastDrumEnd = arrangedDrums.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
  const sectionEnd = sections[sections.length - 1].start + sections[sections.length - 1].duration;

  return {
    melody: arrangedMelody,
    drumNotes: arrangedDrums,
    sections,
    duration: Math.max(lastMelodyEnd, lastDrumEnd, sectionEnd),
  };
}
