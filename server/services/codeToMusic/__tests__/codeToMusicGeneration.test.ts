import { describe, expect, it } from 'vitest';
import { parseCodeStructure } from '../codeParser';
import { generateTimeline } from '../timelineGenerator';
import { generateAdvancedMelody } from '../melodyGenerator';
import { drumPatternToNotes, generateAdvancedDrumPattern } from '../advancedDrums';
import { arrangeCodeMusic } from '../compositionArranger';

describe('Code-to-Music generation', () => {
  it('parses UI-supported languages instead of falling back to JavaScript', () => {
    const rust = parseCodeStructure(`
use std::collections::HashMap;

pub struct BeatMaker {
  tempo: u32,
}

impl BeatMaker {
  pub fn build(&self) -> bool {
    for step in 0..16 {
      if step % 4 == 0 {
        return true;
      }
    }
    false
  }
}
`, 'rust');

    expect(rust.language).toBe('rust');
    expect(rust.elements.some(element => element.type === 'class')).toBe(true);
    expect(rust.elements.some(element => element.type === 'function')).toBe(true);
    expect(rust.elements.some(element => element.type === 'loop')).toBe(true);
    expect(rust.elements.some(element => element.type === 'conditional')).toBe(true);
    expect(rust.complexity).toBeGreaterThan(3);
  });

  it('uses mood-aware genre progressions for generated chords', () => {
    const parsed = parseCodeStructure(`
function recover() {
  if (error) {
    throw new Error("fatal failure");
  }
  return false;
}
`, 'javascript');

    const { chords } = generateTimeline(parsed, 'hiphop', 90, 0);

    expect(parsed.mood).toBe('sad');
    expect(chords.map(chord => chord.chord)).toEqual(['Am7', 'Dm7', 'Em7', 'Am7']);
  });

  it('keeps hip-hop bass active through the progression', () => {
    const parsed = parseCodeStructure(`
class Sequencer {
  play(song) {
    for (let step = 0; step < song.length; step++) {
      if (song[step]) return true;
    }
    return false;
  }
}
`, 'javascript');
    const { chords } = generateTimeline(parsed, 'hiphop', 90, 0);
    const { bass } = generateAdvancedMelody(parsed, chords, 'hiphop', 90, 0);

    expect(bass.length).toBeGreaterThanOrEqual(chords.length * 4);
  });

  it('does not max out hip-hop hats on normal complexity', () => {
    const parsed = parseCodeStructure(`
function playBeat(pattern) {
  for (const hit of pattern) {
    if (hit.active) return hit;
  }
  return null;
}
`, 'javascript');

    const drums = generateAdvancedDrumPattern(parsed, 'hiphop', 90, 16);
    const hatCount = drums.pattern.hihat.filter(Boolean).length;

    expect(hatCount).toBeLessThan(16);
  });

  it('adds a section arrangement and motif reprise from the code structure', () => {
    const parsed = parseCodeStructure(`
import player from "player";

class MusicPlayer {
  play(song) {
    for (let step = 0; step < song.length; step++) {
      if (song[step].active) {
        return true;
      }
    }
    return false;
  }
}
`, 'javascript');
    const bpm = 90;
    const { chords } = generateTimeline(parsed, 'hiphop', bpm, 0);
    const generated = generateAdvancedMelody(parsed, chords, 'hiphop', bpm, 0);
    const rawMelody = [...generated.melody, ...generated.bass, ...generated.pads];
    const rawDuration = Math.max(...rawMelody.map(note => note.start + note.duration));
    const drums = generateAdvancedDrumPattern(parsed, 'hiphop', bpm, rawDuration);
    const arranged = arrangeCodeMusic({
      melody: rawMelody,
      drumNotes: drumPatternToNotes(drums),
      chords,
      parsedCode: parsed,
      genre: 'hiphop',
      bpm,
      duration: rawDuration,
    });

    expect(arranged.sections.map(section => section.name)).toEqual(['intro', 'body', 'build', 'resolution']);
    expect(arranged.melody.some(note => note.source?.startsWith('Motif reprise:'))).toBe(true);
    expect(arranged.drumNotes.some(note => note.start < arranged.sections[0].duration && note.instrument === 'drums_snare')).toBe(false);
  });
});
