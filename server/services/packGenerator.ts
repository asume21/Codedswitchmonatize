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

// Available loop BPMs and their files
const LOOP_LIBRARY: Record<number, { bd: string[], hats: string[], sd: string[], perc: string[], toms: string[] }> = {
  85: {
    bd: Array.from({ length: 8 }, (_, i) => `/assets/loops/85bpm/E808_Loop_BD_85-0${i + 1}.wav`),
    hats: Array.from({ length: 8 }, (_, i) => `/assets/loops/85bpm/E808_Loop_Hats_85-0${i + 1}.wav`),
    sd: Array.from({ length: 8 }, (_, i) => `/assets/loops/85bpm/E808_Loop_SD_85-0${i + 1}.wav`),
    perc: Array.from({ length: 4 }, (_, i) => `/assets/loops/85bpm/E808_Loop_Perc_85-0${i + 1}.wav`),
    toms: Array.from({ length: 4 }, (_, i) => `/assets/loops/85bpm/E808_Loop_Toms_85-0${i + 1}.wav`),
  },
  95: {
    bd: Array.from({ length: 8 }, (_, i) => `/assets/loops/95bpm/E808_Loop_BD_95-0${i + 1}.wav`),
    hats: Array.from({ length: 8 }, (_, i) => `/assets/loops/95bpm/E808_Loop_Hats_95-0${i + 1}.wav`),
    sd: Array.from({ length: 8 }, (_, i) => `/assets/loops/95bpm/E808_Loop_SD_95-0${i + 1}.wav`),
    perc: Array.from({ length: 4 }, (_, i) => `/assets/loops/95bpm/E808_Loop_Perc_95-0${i + 1}.wav`),
    toms: Array.from({ length: 4 }, (_, i) => `/assets/loops/95bpm/E808_Loop_Toms_95-0${i + 1}.wav`),
  },
  132: {
    bd: Array.from({ length: 8 }, (_, i) => `/assets/loops/132bpm/E808_Loop_BD_132-0${i + 1}.wav`),
    hats: Array.from({ length: 8 }, (_, i) => `/assets/loops/132bpm/E808_Loop_Hats_132-0${i + 1}.wav`),
    sd: Array.from({ length: 8 }, (_, i) => `/assets/loops/132bpm/E808_Loop_SD_132-0${i + 1}.wav`),
    perc: Array.from({ length: 4 }, (_, i) => `/assets/loops/132bpm/E808_Loop_Perc_132-0${i + 1}.wav`),
    toms: Array.from({ length: 3 }, (_, i) => `/assets/loops/132bpm/E808_Loop_Toms_132-0${i + 1}.wav`),
  },
};

// Get closest available BPM from library
function getClosestBpm(targetBpm: number): number {
  const available = [85, 95, 132];
  return available.reduce((prev, curr) => 
    Math.abs(curr - targetBpm) < Math.abs(prev - targetBpm) ? curr : prev
  );
}

// Pick a random element from an array using crypto-secure randomness
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(secureRandom() * arr.length)];
}

function generateSamples(genre: string, instruments: string[], packIndex: number, bpm?: number) {
  const sampleTypes = ['loop', 'oneshot', 'midi'];
  const sampleNames: Record<string, string[]> = {
    'Hip Hop': ['Kick', 'Snare', 'Hi-Hat', 'Melody Loop', 'Bass Loop', 'Vocal Chop', 'Transition', 'Percussion'],
    'Trap': ['808 Hit', 'Snare Roll', 'Hi-Hat Roll', 'Melody', 'Vocal Sample', 'Riser', 'Impact', 'Perc Loop'],
    'House': ['Kick Loop', 'Bassline', 'Lead Synth', 'Vocal Hook', 'Percussion', 'FX Sweep', 'Chord Stab', 'Build Up'],
    'Electronic': ['Synth Lead', 'Bass Hit', 'Drum Loop', 'Arp Sequence', 'Vocal Texture', 'Riser', 'Impact', 'Breakdown'],
    'Lo-Fi': ['Vinyl Kick', 'Warm Bass', 'Jazz Chord', 'Tape Hiss', 'Vinyl Crackle', 'Melody', 'Soft Perc', 'Atmosphere']
  };
  
  const names = sampleNames[genre] || sampleNames['Electronic'];
  
  // Use real audio files from the library
  const closestBpm = getClosestBpm(bpm || 95);
  const loops = LOOP_LIBRARY[closestBpm];
  
  // Generate a unique run-id so the same packIndex doesn't always pick the same files
  const uid = Date.now().toString(36) + packIndex;
  const samples = [];
  
  // Add kick drum loop with RANDOM selection from available loops
  samples.push({
    id: `sample-${uid}-kick`,
    name: 'Kick Loop',
    type: 'loop' as const,
    duration: 4,
    audioUrl: randomPick(loops.bd),
  });
  
  // Add hi-hat loop
  samples.push({
    id: `sample-${uid}-hats`,
    name: 'Hi-Hat Loop',
    type: 'loop' as const,
    duration: 4,
    audioUrl: randomPick(loops.hats),
  });
  
  // Add snare loop
  samples.push({
    id: `sample-${uid}-snare`,
    name: 'Snare Loop',
    type: 'loop' as const,
    duration: 4,
    audioUrl: randomPick(loops.sd),
  });
  
  // Add percussion loop
  samples.push({
    id: `sample-${uid}-perc`,
    name: 'Percussion Loop',
    type: 'loop' as const,
    duration: 4,
    audioUrl: randomPick(loops.perc),
  });
  
  // Add toms loop
  samples.push({
    id: `sample-${uid}-toms`,
    name: 'Toms Loop',
    type: 'loop' as const,
    duration: 4,
    audioUrl: randomPick(loops.toms),
  });
  
  // Add additional metadata samples without audio
  for (let i = 5; i < 8 + packIndex; i++) {
    samples.push({
      id: `sample-${uid}-${i}`,
      name: names[i % names.length] + ` ${Math.floor(i / names.length) + 1}`,
      type: sampleTypes[i % sampleTypes.length] as 'loop' | 'oneshot' | 'midi',
      duration: 1.5 + (secureRandom() * 3),
    });
  }
  
  return samples;
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
      samples: generateSamples(selectedGenre.genre, selectedMood.instruments, i, bpm),
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
  if (!process.env.SUNO_API_KEY && !process.env.SUNO_API_TOKEN) {
    throw new Error("SUNO_API_KEY or SUNO_API_TOKEN not configured. Set one in your environment variables.");
  }

  const packs = [] as any[];

  for (let i = 0; i < count; i++) {
    const variationPrompt = `${prompt} (variation ${i + 1}, instrumental focus)`;
    console.log(`🎵 Suno: Generating pack ${i + 1}/${count}: "${variationPrompt}"`);
    
    try {
      // Step 1: Start the generation task
      const response = await sunoApi.generateMusic({
        prompt: variationPrompt,
        instrumental: true,
        model: "V4_5",
      });

      if (!response.success) {
        console.warn(`⚠️ Suno generation failed for pack ${i + 1}:`, response.error);
        continue;
      }

      // Extract taskId from various possible response shapes
      const taskId = response.taskId
        || response.data?.taskId
        || response.data?.task_id
        || (typeof response.data === 'string' ? response.data : null);

      if (!taskId) {
        console.warn("⚠️ Suno response missing taskId. Full response:", JSON.stringify(response).substring(0, 500));
        // If the response itself contains audio directly (some API versions), try to use it
        const directAudio = response.data?.audio_url || response.data?.audioUrl;
        if (directAudio) {
          console.log(`✅ Suno: Got direct audio URL (no polling needed)`);
          packs.push({
            id: `suno-pack-${Date.now()}-${i}`,
            title: response.data?.title || `Suno Instrumental #${i + 1}`,
            description: `Suno AI instrumental generated from "${variationPrompt}"`,
            bpm: response.data?.bpm || 120,
            key: 'C',
            genre: 'AI Generated',
            samples: [{
              id: `sample-suno-${Date.now()}-${i}`,
              name: 'Full Track',
              type: 'loop' as const,
              duration: response.data?.duration || 120,
              url: directAudio,
              audioUrl: directAudio
            }],
            metadata: {
              energy: 80,
              mood: 'Generated',
              instruments: ['AI Orchestra'],
              tags: ['Suno', 'AI', 'Generative']
            }
          });
          continue;
        }
        continue;
      }

      console.log(`🎵 Suno: Task started with ID: ${taskId}`);

      // Step 2: Use the built-in waitForCompletion with generous timeout
      const completionResult = await sunoApi.waitForCompletion(taskId, 180000, 8000);

      if (!completionResult.success) {
        console.warn(`⚠️ Suno: Completion failed for pack ${i + 1}:`, completionResult.error);
        continue;
      }

      // Step 3: Extract audio from the completed result
      // The response can be an array of tracks or a single object
      const resultData = completionResult.data;
      const tracks = Array.isArray(resultData) ? resultData
        : resultData?.data ? (Array.isArray(resultData.data) ? resultData.data : [resultData.data])
        : resultData?.response?.data ? (Array.isArray(resultData.response.data) ? resultData.response.data : [resultData.response.data])
        : [resultData];

      // Find the first track with audio
      const track = tracks.find((t: any) =>
        t && (t.audio_url || t.audioUrl || t.stream_audio_url)
      );

      if (!track) {
        console.warn(`⚠️ Suno: No audio URL in completed result. Data shape:`, JSON.stringify(resultData).substring(0, 500));
        continue;
      }

      const audioUrl = track.audio_url || track.audioUrl || track.stream_audio_url;

      packs.push({
        id: `suno-pack-${Date.now()}-${i}`,
        title: track.title || `Suno Instrumental #${i + 1}`,
        description: track.description || `Suno AI instrumental generated from "${variationPrompt}"`,
        bpm: track.bpm || 122,
        key: 'C',
        genre: 'AI Generated',
        samples: [{
          id: `sample-suno-${Date.now()}-${i}`,
          name: 'Full Track',
          type: 'loop' as const,
          duration: track.duration || 120,
          url: audioUrl,
          audioUrl: audioUrl
        }],
        metadata: {
          energy: 80,
          mood: 'Generated',
          instruments: ['AI Orchestra'],
          tags: ['Suno', 'AI', 'Generative']
        }
      });

      console.log(`✅ Suno: Pack ${i + 1} complete with audio: ${audioUrl.substring(0, 80)}...`);
    } catch (packError: any) {
      console.error(`❌ Suno: Error generating pack ${i + 1}:`, packError?.message || packError);
      continue;
    }
  }
  
  if (packs.length === 0) {
    throw new Error(`Suno generation produced 0 packs out of ${count} requested. Check your SUNO_API_KEY/SUNO_API_TOKEN and account credits.`);
  }

  console.log(`🎵 Suno: Generated ${packs.length}/${count} packs successfully`);
  return packs;
}
