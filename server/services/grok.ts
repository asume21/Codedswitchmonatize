import OpenAI from "openai";

// Load API keys (server-only)
const xaiApiKey = process.env.XAI_API_KEY?.trim();
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();

// Shared timeout to avoid slow requests blocking the route
const AI_TIMEOUT_MS = 8000;
const AI_RESPONSE_DEADLINE_MS = 9000; // hard cap per request before fallback

// Configure Grok (xAI) client
let grokClient: OpenAI | null = null;
if (xaiApiKey && xaiApiKey.startsWith('xai-')) {
  grokClient = new OpenAI({
    baseURL: "https://api.x.ai/v1",
    apiKey: xaiApiKey,
    timeout: AI_TIMEOUT_MS
  });
}

// Configure OpenAI client
let openaiClient: OpenAI | null = null;
if (openaiApiKey && openaiApiKey.startsWith('sk-')) {
  openaiClient = new OpenAI({
    apiKey: openaiApiKey,
    timeout: AI_TIMEOUT_MS
  });
}

// Check if we have at least one working AI client
if (!grokClient && !openaiClient) {
  console.warn("No AI API keys configured. AI features will use fallback patterns.");
}

// Determine preferred AI provider
function getPreferredClient() {
  // Prefer Grok if available, fallback to OpenAI
  if (grokClient) return { client: grokClient, model: "grok-2-1212", provider: "grok" };
  if (openaiClient) return { client: openaiClient, model: "gpt-4", provider: "openai" };
  return null;
}

// Helper function to make AI calls with fallback
export async function makeAICall(messages: any[], options: any = {}) {
  const preferred = getPreferredClient();

  if (!preferred) {
    throw new Error("No AI API keys configured");
  }

  const { client, model, provider } = preferred;

  try {
    console.log(`🤖 Making ${provider} API call with model ${model}`);

    const response = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: options.temperature || 0.6,
      max_tokens: options.max_tokens || 3000,
      response_format: options.response_format
    });

    console.log(`✅ ${provider} API call successful`);
    return response;

  } catch (error) {
    console.error(`❌ ${provider} API call failed:`, error);

    // If Grok failed and we have OpenAI, try OpenAI as fallback
    if (provider === "grok" && openaiClient) {
      console.log("🔄 Falling back to OpenAI...");
      try {
        const fallbackResponse = await openaiClient.chat.completions.create({
          model: "gpt-4",
          messages: messages,
          temperature: options.temperature || 0.6,
          max_tokens: options.max_tokens || 3000,
          response_format: options.response_format
        });

        console.log("✅ OpenAI fallback successful");
        return fallbackResponse;

      } catch (fallbackError) {
        console.error("❌ OpenAI fallback also failed:", fallbackError);
        throw new Error("Both Grok and OpenAI APIs failed");
      }
    }

    // If OpenAI failed and we have Grok, try Grok as fallback
    if (provider === "openai" && grokClient) {
      console.log("🔄 Falling back to Grok...");
      try {
        const fallbackResponse = await grokClient.chat.completions.create({
          model: "grok-2-1212",
          messages: messages,
          temperature: options.temperature || 0.6,
          max_tokens: options.max_tokens || 3000,
          response_format: options.response_format
        });

        console.log("✅ Grok fallback successful");
        return fallbackResponse;

      } catch (fallbackError) {
        console.error("❌ Grok fallback also failed:", fallbackError);
        throw new Error("Both OpenAI and Grok APIs failed");
      }
    }

    // No fallback available
    throw error;
  }
}

export async function translateCode(sourceCode: string, sourceLanguage: string, targetLanguage: string, aiProvider?: string): Promise<string> {
  try {
    const response = await makeAICall([
      {
        role: "system",
        content: `You are an expert programmer. Translate code from ${sourceLanguage} to ${targetLanguage}. Maintain the same functionality and logic. Return only the translated code without explanations.`
      },
      {
        role: "user",
        content: `Translate this ${sourceLanguage} code to ${targetLanguage}:\n\n${sourceCode}`
      }
    ], { temperature: 0.1 });

    return response.choices[0].message.content || "";
  } catch (error) {
    throw new Error("Failed to translate code: " + (error as Error).message);
  }
}

export async function generateBeatPattern(style: string, bpm: number, complexity: number = 5, aiProvider?: string): Promise<any> {
  try {
    const variations = [
      "energetic and driving",
      "laid-back and groovy",
      "syncopated and complex",
      "minimal and spacious",
      "heavy and aggressive",
      "bouncy and playful",
      "dark and moody",
      "uplifting and bright"
    ];

    const randomVariation = variations[Math.floor(Math.random() * variations.length)];
    const timestamp = Date.now();
    const randomSeed = Math.floor(Math.random() * 10000);

    const aiCall = makeAICall([
      {
        role: "system",
        content: `You are a creative AI beat producer. Generate unique, varied ${style} patterns that are ${randomVariation}. Each pattern must be COMPLETELY DIFFERENT from previous ones. Use creativity and musical knowledge. Return JSON with kick, bass, tom, snare, hihat, openhat, clap, crash arrays (16 boolean values each). Make patterns musically interesting with proper spacing, fills, and groove. Variation is KEY.`
      },
      {
        role: "user",
        content: `Create a fresh ${randomVariation} ${style} beat at ${bpm} BPM with complexity level ${complexity}/10. Unique session: ${timestamp}-${randomSeed}

Requirements:
- Must be different from generic patterns
- Complexity ${complexity}/10: ${complexity <= 3 ? 'Simple, basic patterns' : complexity <= 6 ? 'Moderate complexity with some fills' : 'Complex patterns with advanced fills and syncopation'}
- Use creative drum placement appropriate for complexity level
- Consider syncopation and musical fills based on complexity
- Vary the kick and snare patterns
- Make it ${randomVariation} in feel`
      }
    ], {
      response_format: { type: "json_object" },
      temperature: 0.95
    });

    const response = await Promise.race([
      aiCall,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI generation timed out")), AI_RESPONSE_DEADLINE_MS)
      )
    ]);

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Add fallback with randomization if JSON parsing fails
    if (!result.kick) {
      return generateRandomFallbackPattern(style, randomVariation);
    }

    return result;
  } catch (error) {
    console.error("AI generation failed, using randomized fallback:", error);
    return generateRandomFallbackPattern(style, "creative");
  }
}

export function generateRandomFallbackPattern(style: string, variation: string): any {
  const patterns = {
    kick: Array(16).fill(false),
    bass: Array(16).fill(false),
    tom: Array(16).fill(false),
    snare: Array(16).fill(false),
    hihat: Array(16).fill(false),
    openhat: Array(16).fill(false),
    clap: Array(16).fill(false),
    crash: Array(16).fill(false)
  };

  // Generate truly random patterns with musical logic
  const kickProbability = Math.random() * 0.4 + 0.2; // 20-60% chance per step
  const snareProbability = Math.random() * 0.3 + 0.15; // 15-45% chance
  const hihatProbability = Math.random() * 0.6 + 0.3; // 30-90% chance

  for (let i = 0; i < 16; i++) {
    // Kick pattern - often on 1 and 9, sometimes others
    if (i === 0 || i === 8) patterns.kick[i] = Math.random() < 0.9;
    else patterns.kick[i] = Math.random() < kickProbability;

    // Bass drum - complement kick with lower probability
    patterns.bass[i] = Math.random() < (kickProbability * 0.3);

    // Snare - often on 4 and 12, sometimes others
    if (i === 4 || i === 12) patterns.snare[i] = Math.random() < 0.8;
    else patterns.snare[i] = Math.random() < snareProbability;

    // Hi-hat - more frequent, create groove
    patterns.hihat[i] = Math.random() < hihatProbability;

    // Other elements - sparse and random
    patterns.tom[i] = Math.random() < 0.1;
    patterns.openhat[i] = Math.random() < 0.15;
    patterns.clap[i] = Math.random() < 0.12;
    patterns.crash[i] = i === 0 ? Math.random() < 0.3 : Math.random() < 0.05;
  }

  return {
    ...patterns,
    name: `${variation} ${style} Beat`,
    explanation: `Randomized ${variation} ${style} pattern with unique groove`
  };
}

export async function generateLyrics(theme: string, genre: string, mood: string, complexity: number = 5, aiProvider?: string): Promise<string> {
  try {
    const perspectives = ["first person introspective", "storytelling narrative", "conversational direct", "poetic metaphorical", "stream of consciousness"];
    const structures = ["verse-chorus-verse-chorus-bridge-chorus", "verse-pre-chorus-chorus-verse-pre-chorus-chorus-bridge-outro", "intro-verse-chorus-verse-chorus-bridge-final-chorus"];
    const approaches = ["vulnerable and honest", "confident and bold", "nostalgic and reflective", "rebellious and fierce", "romantic and tender", "philosophical and deep"];

    const randomPerspective = perspectives[Math.floor(Math.random() * perspectives.length)];
    const randomStructure = structures[Math.floor(Math.random() * structures.length)];
    const randomApproach = approaches[Math.floor(Math.random() * approaches.length)];
    const timestamp = Date.now();
    const seed = Math.floor(Math.random() * 10000);

    const response = await makeAICall([
      {
        role: "system",
        content: `You are a creative songwriter who writes unique, never-repeating lyrics. Write ${randomApproach} lyrics about ${theme} in ${genre} style with ${mood} mood. Use ${randomPerspective} perspective and ${randomStructure} structure. Each set of lyrics must be COMPLETELY ORIGINAL and different from previous generations.`
      },
      {
        role: "user",
        content: `Create fresh, original ${genre} lyrics about "${theme}" with ${mood} mood and complexity level ${complexity}/10. Session: ${timestamp}-${seed}

Requirements:
- ${randomApproach} approach
- ${randomPerspective} writing style
- ${randomStructure} structure
- Complexity ${complexity}/10: ${complexity <= 3 ? 'Simple words, basic rhymes, straightforward themes' : complexity <= 6 ? 'Moderate vocabulary, some metaphors, varied rhyme schemes' : 'Advanced vocabulary, complex metaphors, intricate wordplay, layered meanings'}
- Must be completely unique and different
- Genre-appropriate language and imagery`
      }
    ], {
      temperature: 0.95
    });

    return response.choices[0].message.content || generateRandomLyrics(theme, genre, mood, randomApproach);
  } catch (error) {
    console.error("Lyrics AI generation failed, using randomized fallback:", error);
    return generateRandomLyrics(theme, genre, mood, "creative");
  }
}

function generateRandomLyrics(theme: string, genre: string, mood: string, approach: string): string {
  const templates = [
    `[Verse 1]\nThinking about ${theme} in the ${mood} light\nEvery moment feels so right\nIn this ${genre} state of mind\nLeaving yesterday behind\n\n[Chorus]\nThis is our ${approach} time\nEvery beat, every rhyme\n${theme} calling out to me\nThis is how we're meant to be\n\n[Verse 2]\nWalking through the ${mood} dreams\nNothing's quite the way it seems\n${theme} echoes in my soul\nMaking broken pieces whole`,

    `[Verse 1]\n${theme} surrounds us everywhere\nIn the ${mood} atmosphere\n${genre} rhythms in our hearts\nThis is where the music starts\n\n[Pre-Chorus]\nFeel it building up inside\nCan't keep these feelings to hide\n\n[Chorus]\nWe're ${approach} and alive\nIn this moment we will thrive\n${theme} is our battle cry\nTogether we will touch the sky`,

    `[Intro]\n${mood} whispers in the night\n${theme} burning bright\n\n[Verse 1]\nEvery step a ${approach} move\nIn this ${genre} groove\n${theme} guides us on our way\nTo a brighter day\n\n[Chorus]\nThis is our anthem now\nWe made it through somehow\n${mood} feelings, ${approach} hearts\nThis is where the future starts`
  ];

  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
  return randomTemplate;
}

export async function getRhymeSuggestions(word: string): Promise<string[]> {
  try {
    const response = await makeAICall([
      {
        role: "system",
        content: `You are a rhyme dictionary. Return JSON array of words that rhyme with the given word. Include perfect rhymes and near rhymes.`
      },
      {
        role: "user",
        content: `Find rhyming words for: ${word}`
      }
    ], {
      response_format: { type: "json_object" },
      temperature: 0.5
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.rhymes || [];
  } catch (error) {
    throw new Error("Failed to get rhyme suggestions: " + (error as Error).message);
  }
}

// Helper function to get scale notes from scale name
function getScaleNotes(scale: string): Array<{note: string, interval: number}> {
  const scalePatterns: { [key: string]: Array<{note: string, interval: number}> } = {
    'C Major': [
      {note: 'C', interval: 0}, {note: 'D', interval: 2}, {note: 'E', interval: 4},
      {note: 'F', interval: 5}, {note: 'G', interval: 7}, {note: 'A', interval: 9}, {note: 'B', interval: 11}
    ],
    'G Major': [
      {note: 'G', interval: 0}, {note: 'A', interval: 2}, {note: 'B', interval: 4},
      {note: 'C', interval: 5}, {note: 'D', interval: 7}, {note: 'E', interval: 9}, {note: 'F#', interval: 11}
    ],
    'D Major': [
      {note: 'D', interval: 0}, {note: 'E', interval: 2}, {note: 'F#', interval: 4},
      {note: 'G', interval: 5}, {note: 'A', interval: 7}, {note: 'B', interval: 9}, {note: 'C#', interval: 11}
    ],
    'A Minor': [
      {note: 'A', interval: 0}, {note: 'B', interval: 2}, {note: 'C', interval: 3},
      {note: 'D', interval: 5}, {note: 'E', interval: 7}, {note: 'F', interval: 8}, {note: 'G', interval: 10}
    ],
    'E Minor': [
      {note: 'E', interval: 0}, {note: 'F#', interval: 2}, {note: 'G', interval: 3},
      {note: 'A', interval: 5}, {note: 'B', interval: 7}, {note: 'C', interval: 8}, {note: 'D', interval: 10}
    ]
  };

  // Return the scale pattern or default to C Major
  return scalePatterns[scale] || scalePatterns['C Major'];
}

// Helper function to get note frequency
function getNoteFrequency(note: string): number {
  const noteMap: { [key: string]: number } = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77
  };
  return noteMap[note] || 261.63; // Default to C4
}

export async function generateMelody(scale: string, style: string, complexity: number = 5, availableTracks?: Array<{id: string, instrument: string, name: string}>, musicalParams?: {
  scaleNotes: string[],
  scaleRoot: string,
  beatsPerMeasure: number,
  noteDurations: string[],
  gridSnapSize: number
}): Promise<any> {
  try {
    console.log(`🎵 Starting melody generation: ${style} in ${scale} scale, complexity ${complexity}`);

    // Extract music theory parameters
    const scaleNotes = musicalParams?.scaleNotes || getScaleNotes(scale).map(s => s.note);
    const scaleRoot = musicalParams?.scaleRoot || scale.split(' ')[0];
    const beatsPerMeasure = musicalParams?.beatsPerMeasure || 4;
    const gridSnap = musicalParams?.gridSnapSize || 0.25;
    const noteDurations = musicalParams?.noteDurations || ['quarter', 'eighth', 'half'];

    // Build music theory prompt
    const musicTheoryPrompt = `Create a musical melody in ${scale} scale with ${style} style and complexity level ${complexity}/10.

Scale notes: ${scaleNotes.join(', ')}
Time signature: ${beatsPerMeasure}/4
Generate 12-16 notes for a complete musical phrase.

Requirements:
${complexity >= 7 ? `
- Create sophisticated melodic line with advanced musical concepts
- Use extended techniques like chromatic passing tones, neighbor tones
- Include complex rhythmic patterns and syncopation
- Apply proper musical phrasing and dynamics` : complexity >= 4 ? `
- Create balanced melody with good voice leading
- Use appropriate rhythmic patterns for the style
- Include some syncopation and varied note durations
- Apply basic musical phrasing` : `
- Create simple but musical melody
- Use basic rhythmic patterns
- Keep melody singable and memorable
- Focus on strong melodic contour`}

Style-specific requirements for ${style}:
${style === 'jazz' ? '- Use bebop scales, blue notes, syncopated phrasing' :
 style === 'classical' ? '- Use balanced phrases, clear cadences' :
 style === 'rock' ? '- Use strong rhythms, memorable riffs' :
 style === 'pop' ? '- Use catchy, singable melodies' :
 '- Apply genre-appropriate melodic patterns'}

Return JSON with format:
{
  "notes": [
    {"note": "C4", "octave": 4, "duration": 1.0, "start": 0.0, "velocity": 85, "track": "melody"}
  ],
  "name": "${style} ${scale} Melody",
  "musicalAnalysis": {
    "melodicContour": "description of melodic movement",
    "rhythmicPattern": "description of rhythm",
    "harmonicImplications": "chord tones and tensions used"
  }
}`;

    const response = await makeAICall([
      {
        role: "system",
        content: `You are a professional composer. Create musical melodies with proper music theory and style-appropriate patterns.`
      },
      {
        role: "user",
        content: musicTheoryPrompt
      }
    ], {
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content || "{}";
    let result;

    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("JSON parsing failed, using fallback:", parseError);
      result = generateMusicTheoryBasedFallback(scale, style, complexity, availableTracks, musicalParams);
    }

    // Validate and enhance the result
    if (!result.notes || !Array.isArray(result.notes)) {
      result = generateMusicTheoryBasedFallback(scale, style, complexity, availableTracks, musicalParams);
    }

    // Professional note validation and enhancement
    const professionalNotes = result.notes.map((note: any, index: number) => {
      // Validate note is in scale
      let validNote = note.note || 'C';
      if (!scaleNotes.includes(validNote) && complexity < 6) {
        validNote = scaleNotes[index % scaleNotes.length];
      }

      return {
        note: validNote,
        octave: Math.max(3, Math.min(6, note.octave || 4)),
        duration: Math.max(0.125, Math.min(4, note.duration || 0.5)),
        start: Math.max(0, note.start || (index * 0.5)),
        velocity: Math.max(40, Math.min(120, note.velocity || 80)),
        track: note.track || 'melody'
      };
    });

    console.log(`✅ Generated ${professionalNotes.length} professional notes`);

    return {
      notes: professionalNotes,
      name: result.name || `${style} ${scale} Melody`,
      scale,
      musicalAnalysis: result.musicalAnalysis || {
        melodicContour: `Melodic line using ${scale} scale`,
        rhythmicPattern: `${complexity > 5 ? 'Complex' : 'Simple'} rhythmic structure`,
        harmonicImplications: `Based on ${scale} harmony`
      }
    };

  } catch (error) {
    console.error("Melody generation failed:", error);
    return generateMusicTheoryBasedFallback(scale, style, complexity, availableTracks, musicalParams);
  }
}

// Export a function to get the preferred AI client
export function getAIClient() {
  const preferred = getPreferredClient();
  return preferred?.client || null;
}

// Enhanced fallback that actually uses music theory
function generateMusicTheoryBasedFallback(scale: string, style: string, complexity: number, availableTracks?: any[], musicalParams?: any): any {
  const scaleNotes = musicalParams?.scaleNotes || getScaleNotes(scale).map((s: any) => s.note);
  const numNotes = complexity > 6 ? 16 : complexity > 3 ? 12 : 8;

  const notes = [];
  let currentTime = 0;

  for (let i = 0; i < numNotes; i++) {
    // Use music theory to pick notes intelligently
    let noteIndex;
    if (i % 4 === 0) {
      // Start phrases on chord tones (1, 3, 5)
      noteIndex = [0, 2, 4][Math.floor(Math.random() * 3)];
    } else {
      // Use scale steps with some randomness
      noteIndex = Math.floor(Math.random() * scaleNotes.length);
    }

    const duration = complexity > 5 ?
      [0.25, 0.5, 0.75, 1.0][Math.floor(Math.random() * 4)] :
      [0.5, 1.0][Math.floor(Math.random() * 2)];

    notes.push({
      note: scaleNotes[noteIndex],
      octave: 4,
      duration,
      start: currentTime,
      velocity: 70 + Math.random() * 20,
      track: availableTracks?.[0]?.id || 'track1'
    });

    currentTime += duration;
  }

  return {
    notes,
    name: `${style} ${scale} Theory-Based Melody`,
    scale,
    musicalAnalysis: {
      scaleUsage: `Used ${scale} scale with emphasis on chord tones`,
      voiceLeading: "Stepwise motion with strategic leaps",
      rhythmicPattern: `${complexity > 5 ? 'Complex' : 'Simple'} rhythmic structure`,
      styleElements: `${style} style elements with music theory foundation`
    }
  };
}
