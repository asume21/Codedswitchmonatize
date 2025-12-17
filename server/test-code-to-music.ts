/**
 * Test script for enhanced code-to-music algorithm
 * Run with: npx tsx server/test-code-to-music.ts
 */

import { convertCodeToMusic, convertCodeToMusicEnhanced } from './services/codeToMusic';

// Sample code snippets to test
const testCases = [
  {
    name: 'Simple Function',
    language: 'javascript',
    genre: 'pop',
    code: `
function greetUser(name) {
  const message = "Hello, " + name;
  return message;
}
    `,
  },
  {
    name: 'Complex Class',
    language: 'typescript',
    genre: 'rock',
    code: `
class MusicPlayer {
  private playlist: Song[] = [];
  private currentIndex: number = 0;
  
  constructor(songs: Song[]) {
    this.playlist = songs;
  }
  
  play() {
    if (this.playlist.length === 0) return;
    const song = this.playlist[this.currentIndex];
    console.log("Playing:", song.title);
  }
  
  next() {
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    this.play();
  }
  
  shuffle() {
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
    }
  }
}
    `,
  },
  {
    name: 'Loop Heavy (Hip-Hop)',
    language: 'python',
    genre: 'hiphop',
    code: `
def process_beats(samples):
    results = []
    for sample in samples:
        for i in range(4):
            processed = apply_filter(sample, i)
            if processed.volume > 0.5:
                results.append(processed)
    return results

def apply_filter(sample, intensity):
    while intensity > 0:
        sample = sample.boost()
        intensity -= 1
    return sample
    `,
  },
  {
    name: 'EDM Energy',
    language: 'javascript',
    genre: 'edm',
    code: `
async function dropTheBeat() {
  await buildUp(8);
  
  const synth = new Synthesizer();
  const kick = new Kick808();
  
  for (let bar = 0; bar < 16; bar++) {
    kick.hit();
    if (bar % 4 === 0) {
      synth.chord("Cm");
    }
    await wait(0.5);
  }
  
  return "DROP!";
}

function buildUp(bars) {
  let energy = 0;
  while (energy < 100) {
    energy += 12.5;
    addRiser(energy);
  }
}
    `,
  },
  {
    name: 'R&B Smooth',
    language: 'typescript',
    genre: 'rnb',
    code: `
interface Vibe {
  mood: string;
  tempo: number;
  key: string;
}

const createVibe = (mood: string): Vibe => {
  const vibes = {
    chill: { mood: "chill", tempo: 75, key: "Fmaj7" },
    groovy: { mood: "groovy", tempo: 95, key: "Am7" },
  };
  return vibes[mood] || vibes.chill;
};

class SoulfulMelody {
  private notes: string[];
  
  constructor() {
    this.notes = ["C", "E", "G", "B"];
  }
  
  improvise() {
    return this.notes.map(n => n + "maj7");
  }
}
    `,
  },
];

async function runTests() {
  console.log('🎵 Testing Enhanced Code-to-Music Algorithm\n');
  console.log('='.repeat(60));
  
  for (const test of testCases) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Genre: ${test.genre} | Language: ${test.language}`);
    console.log('-'.repeat(60));
    
    // Test original algorithm
    console.log('\n🔹 Original Algorithm:');
    const originalResult = await convertCodeToMusic({
      code: test.code,
      language: test.language,
      genre: test.genre,
      variation: 0,
    });
    
    if (originalResult.success && originalResult.music) {
      console.log(`   ✅ BPM: ${originalResult.music.metadata.bpm}`);
      console.log(`   ✅ Key: ${originalResult.music.metadata.key}`);
      console.log(`   ✅ Melody Notes: ${originalResult.music.melody.length}`);
      console.log(`   ✅ Duration: ${originalResult.music.metadata.duration.toFixed(1)}s`);
    } else {
      console.log(`   ❌ Error: ${originalResult.error}`);
    }
    
    // Test enhanced algorithm
    console.log('\n🔸 Enhanced Algorithm:');
    const enhancedResult = await convertCodeToMusicEnhanced({
      code: test.code,
      language: test.language,
      genre: test.genre,
      variation: 0,
    });
    
    if (enhancedResult.success && enhancedResult.music) {
      const melody = enhancedResult.music.melody;
      const drums = enhancedResult.music.drums;
      
      console.log(`   ✅ BPM: ${enhancedResult.music.metadata.bpm}`);
      console.log(`   ✅ Key: ${enhancedResult.music.metadata.key}`);
      console.log(`   ✅ Total Notes: ${melody.length}`);
      console.log(`   ✅ Duration: ${enhancedResult.music.metadata.duration.toFixed(1)}s`);
      
      // Count by instrument
      const instruments: Record<string, number> = {};
      melody.forEach((n: any) => {
        instruments[n.instrument] = (instruments[n.instrument] || 0) + 1;
      });
      console.log(`   ✅ Instruments:`, instruments);
      
      // Show first few notes
      console.log(`   ✅ First 5 notes:`);
      melody.slice(0, 5).forEach((n: any, i: number) => {
        console.log(`      ${i + 1}. ${n.note} @ ${n.start.toFixed(2)}s (${n.instrument})`);
      });
      
      // Drum pattern info
      const kickCount = drums?.kick?.filter(Boolean).length ?? 0;
      const snareCount = drums?.snare?.filter(Boolean).length ?? 0;
      const hihatCount = drums?.hihat?.filter(Boolean).length ?? 0;
      console.log(`   ✅ Drum Pattern: ${kickCount} kicks, ${snareCount} snares, ${hihatCount} hihats`);
    } else {
      console.log(`   ❌ Error: ${enhancedResult.error}`);
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch(console.error);
