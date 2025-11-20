import crypto from "crypto";
import { sunoApi } from "./sunoApi";

// SECURITY: Cryptographically secure random number generator
// Returns a random float between 0 and 1 using crypto.randomBytes
export function secureRandom(): number {
  const buffer = crypto.randomBytes(4);
  const randomValue = buffer.readUInt32BE(0);
  return randomValue / 0xFFFFFFFF;
}

export function generatePackTitle(prompt: string, genre: string, packNumber: number) {
  const keywords = prompt.split(' ').slice(0, 3);
  const titleTemplates = [
    `${keywords.join(' ')} Pack ${packNumber}`,
    `${genre} ${keywords[0]} Collection`,
    `${keywords[0]} ${keywords[1]} Suite`,
    `Premium ${keywords[0]} Kit ${packNumber}`,
    `${genre} ${keywords[0]} Bundle`
  ];
  return titleTemplates[packNumber % titleTemplates.length];
}

export function generatePackDescription(prompt: string, genre: string, mood: string) {
  return `Professional ${genre.toLowerCase()} sample pack with ${mood.toLowerCase()} vibes, inspired by: ${prompt}. Perfect for modern music production.`;
}

function generateSamples(genre: string, instruments: string[], packIndex: number) {
  const sampleTypes = ['loop', 'oneshot', 'midi'];
  const sampleNames: Record<string, string[]> = {
    'Hip Hop': ['Kick', 'Snare', 'Hi-Hat', 'Melody Loop', 'Bass Loop', 'Vocal Chop', 'Transition', 'Percussion'],
    'Trap': ['808 Hit', 'Snare Roll', 'Hi-Hat Roll', 'Melody', 'Vocal Sample', 'Riser', 'Impact', 'Perc Loop'],
    'House': ['Kick Loop', 'Bassline', 'Lead Synth', 'Vocal Hook', 'Percussion', 'FX Sweep', 'Chord Stab', 'Build Up'],
    'Electronic': ['Synth Lead', 'Bass Hit', 'Drum Loop', 'Arp Sequence', 'Vocal Texture', 'Riser', 'Impact', 'Breakdown'],
    'Lo-Fi': ['Vinyl Kick', 'Warm Bass', 'Jazz Chord', 'Tape Hiss', 'Vinyl Crackle', 'Melody', 'Soft Perc', 'Atmosphere']
  };
  
  const names = sampleNames[genre] || sampleNames['Electronic'];
  
  return Array.from({ length: 8 + packIndex }, (_, i) => ({
    id: `sample-${packIndex}-${i}`,
    name: names[i % names.length] + ` ${Math.floor(i / names.length) + 1}`,
    type: sampleTypes[i % sampleTypes.length],
    duration: 1.5 + (secureRandom() * 3)
  }));
}

function generateTags(prompt: string, genre: string, mood: string) {
  const baseTagsMap: Record<string, string[]> = {
    'Hip Hop': ['Boom Bap', 'Trap', 'Old School', 'Modern'],
    'Electronic': ['EDM', 'Synth', 'Digital', 'Modern'],
    'Lo-Fi': ['Chill', 'Vintage', 'Vinyl', 'Relaxed'],
    'House': ['Dance', 'Club', 'Groove', 'Electronic'],
    'Jazz': ['Smooth', 'Classic', 'Improvised', 'Sophisticated']
  };
  
  const baseTags = baseTagsMap[genre] || ['Creative', 'Original', 'Professional'];
  const promptWords = prompt.split(' ').slice(0, 2).map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  );
  
  return [...baseTags, mood, ...promptWords, 'High Quality'].slice(0, 6);
}

// Intelligent pack generation function that creates themed packs based on prompts
export function generateIntelligentPacks(prompt: string, count: number) {
  const promptLower = prompt.toLowerCase();
  
  // Analyze prompt for musical characteristics
  const genreMap: Record<string, { genre: string, bpmRange: number[], keys: string[] }> = {
    'hip hop': { genre: 'Hip Hop', bpmRange: [70, 90], keys: ['C', 'F', 'G', 'Bb'] },
    'trap': { genre: 'Trap', bpmRange: [140, 170], keys: ['C', 'F#', 'A', 'D'] },
    'house': { genre: 'House', bpmRange: [120, 130], keys: ['Am', 'Dm', 'Em', 'Gm'] },
    'techno': { genre: 'Techno', bpmRange: [120, 140], keys: ['Am', 'Fm', 'Cm', 'Gm'] },
    'lo-fi': { genre: 'Lo-Fi', bpmRange: [70, 90], keys: ['C', 'Am', 'F', 'G'] },
    'jazz': { genre: 'Jazz', bpmRange: [80, 120], keys: ['Dm7', 'G7', 'Cmaj7', 'Am7'] },
    'electronic': { genre: 'Electronic', bpmRange: [100, 140], keys: ['C', 'D', 'F', 'G'] },
    'ambient': { genre: 'Ambient', bpmRange: [60, 90], keys: ['C', 'Am', 'Em', 'Dm'] },
    'rock': { genre: 'Rock', bpmRange: [100, 140], keys: ['E', 'A', 'D', 'G'] },
    'pop': { genre: 'Pop', bpmRange: [100, 130], keys: ['C', 'G', 'Am', 'F'] }
  };

  // Detect genre from prompt
  let selectedGenre = { genre: 'Electronic', bpmRange: [100, 130], keys: ['C', 'G', 'Am', 'F'] };
  for (const [key, value] of Object.entries(genreMap)) {
    if (promptLower.includes(key)) {
      selectedGenre = value;
      break;
    }
  }

  // Detect mood and energy
  const moodMap: Record<string, { energy: number, mood: string, instruments: string[] }> = {
    'dark': { energy: 70, mood: 'Dark', instruments: ['Bass', 'Synth Pad', 'Deep Drums'] },
    'chill': { energy: 30, mood: 'Chill', instruments: ['Piano', 'Soft Synth', 'Light Drums'] },
    'energetic': { energy: 90, mood: 'Energetic', instruments: ['Lead Synth', 'Heavy Drums', 'Bass'] },
    'dreamy': { energy: 40, mood: 'Dreamy', instruments: ['Pad', 'Reverb Guitar', 'Soft Drums'] },
    'intense': { energy: 95, mood: 'Intense', instruments: ['Heavy Bass', 'Percussion', 'Distorted Synth'] },
    'warm': { energy: 50, mood: 'Warm', instruments: ['Rhodes', 'Vinyl', 'Jazz Drums'] },
    'cinematic': { energy: 80, mood: 'Cinematic', instruments: ['Strings', 'Brass', 'Orchestra Drums'] }
  };

  let selectedMood = { energy: 60, mood: 'Balanced', instruments: ['Synth', 'Drums', 'Bass'] };
  for (const [key, value] of Object.entries(moodMap)) {
    if (promptLower.includes(key)) {
      selectedMood = value;
      break;
    }
  }

  return Array.from({ length: count }, (_, i) => {
    const bpm = selectedGenre.bpmRange[0] + Math.floor(secureRandom() * (selectedGenre.bpmRange[1] - selectedGenre.bpmRange[0]));
    const key = selectedGenre.keys[i % selectedGenre.keys.length];
    
    return {
      id: `pack-${Date.now()}-${i}`,
      title: generatePackTitle(prompt, selectedGenre.genre, i + 1),
      description: generatePackDescription(prompt, selectedGenre.genre, selectedMood.mood),
      bpm,
      key,
      genre: selectedGenre.genre,
      samples: generateSamples(selectedGenre.genre, selectedMood.instruments, i),
      metadata: {
        energy: Math.max(10, Math.min(100, selectedMood.energy + (secureRandom() * 20 - 10))),
        mood: selectedMood.mood,
        instruments: selectedMood.instruments,
        tags: generateTags(prompt, selectedGenre.genre, selectedMood.mood)
      }
    };
  });
}

export async function generateSunoPacks(prompt: string, count: number) {
  if (!process.env.SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY not configured");
  }

  const packs = [] as any[];

  for (let i = 0; i < count; i++) {
    const variationPrompt = `${prompt} (instrumental focus ${i + 1})`;
    const response = await sunoApi.generateMusic({
      prompt: variationPrompt,
      makeInstrumental: true,
      waitAudio: true,
      model: "v5",
    });

    if (!response.success) {
      console.warn("⚠️ Suno generation failed", response.error);
      continue;
    }

    const track = response.data?.data?.[0] || response.data?.[0] || response.data;
    const audioUrl = track?.audio_url || track?.audioUrl;

    if (!audioUrl) {
      console.warn("⚠️ Suno response missing audio", track);
      continue;
    }

    packs.push({
      id: `suno-pack-${Date.now()}-${i}`,
      title: track?.title || `Suno Instrumental #${i + 1}`,
      description: track?.description || `Suno AI instrumental generated from "${variationPrompt}"`,
      bpm: track?.bpm || 122,
      key: 'C', // Default as Suno doesn't always return key
      genre: 'AI Generated',
      samples: [{
        id: `sample-suno-${i}`,
        name: 'Full Track',
        type: 'full_track',
        duration: track?.duration || 120,
        url: audioUrl
      }],
      metadata: {
        energy: 80,
        mood: 'Generated',
        instruments: ['AI Orchestra'],
        tags: ['Suno', 'AI', 'Generative']
      }
    });
  }
  
  return packs;
}
