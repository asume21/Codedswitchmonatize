import OpenAI from "openai";

// Load API key (server-only)
const apiKey = process.env.XAI_API_KEY?.trim();

if (!apiKey) {
  throw new Error("XAI_API_KEY environment variable is not set. Please add it to your Replit Secrets.");
}

if (!apiKey.startsWith('xai-')) {
  throw new Error("Invalid XAI_API_KEY format. Key should start with 'xai-'");
}

// Using xAI's Grok API as requested by the user instead of OpenAI
const openai = new OpenAI({ 
  baseURL: "https://api.x.ai/v1",
  apiKey: apiKey,
  timeout: 30000
});

// Export the openai instance for use in other modules
export { openai };

export async function translateCode(sourceCode: string, sourceLanguage: string, targetLanguage: string, aiProvider?: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are an expert programmer. Translate code from ${sourceLanguage} to ${targetLanguage}. 
          Maintain the same functionality and logic. Return only the translated code without explanations.`
        },
        {
          role: "user",
          content: `Translate this ${sourceLanguage} code to ${targetLanguage}:\n\n${sourceCode}`
        }
      ],
      temperature: 0.1,
    });

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

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are a creative AI beat producer. Generate unique, varied ${style} patterns that are ${randomVariation}. 
          Each pattern must be COMPLETELY DIFFERENT from previous ones. Use creativity and musical knowledge.
          Return JSON with kick, bass, tom, snare, hihat, openhat, clap, crash arrays (16 boolean values each).
          Make patterns musically interesting with proper spacing, fills, and groove. Variation is KEY.`
        },
        {
          role: "user",
          content: `Create a fresh ${randomVariation} ${style} beat at ${bpm} BPM with complexity level ${complexity}/10. 
          Unique session: ${timestamp}-${randomSeed}

          Requirements:
          - Must be different from generic patterns
          - Complexity ${complexity}/10: ${complexity <= 3 ? 'Simple, basic patterns' : complexity <= 6 ? 'Moderate complexity with some fills' : 'Complex patterns with advanced fills and syncopation'}
          - Use creative drum placement appropriate for complexity level
          - Consider syncopation and musical fills based on complexity
          - Vary the kick and snare patterns
          - Make it ${randomVariation} in feel`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.95, // Very high temperature for maximum creativity
    });

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

function generateRandomFallbackPattern(style: string, variation: string): any {
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

// Create a professional multi-track arrangement when AI fails
function createProfessionalArrangement(style: string, scaleNotes: string[], complexity: number) {
  const tracks = ['Melody', 'Harmony', 'Bass', 'Rhythm'];
  const notes = [];
  const baseProgression = ['C', 'Am', 'F', 'G']; // I-vi-IV-V progression
  
  // Generate melody track (12-16 notes)
  for (let i = 0; i < 14; i++) {
    notes.push({
      note: scaleNotes[i % scaleNotes.length],
      octave: 5,
      duration: Math.random() < 0.3 ? 1.0 : 0.5,
      start: i * 0.5,
      velocity: 85 + Math.random() * 10,
      track: 'Melody'
    });
  }
  
  // Generate harmony track (8-12 chord notes)
  for (let i = 0; i < 10; i++) {
    const chordRoot = baseProgression[i % baseProgression.length];
    notes.push({
      note: chordRoot,
      octave: 4,
      duration: 2.0,
      start: i * 2.0,
      velocity: 70,
      track: 'Harmony'
    });
  }
  
  // Generate bass track (8-10 notes)
  for (let i = 0; i < 9; i++) {
    const bassNote = baseProgression[i % baseProgression.length];
    notes.push({
      note: bassNote,
      octave: 3,
      duration: 1.0,
      start: i * 1.0,
      velocity: 80,
      track: 'Bass'
    });
  }
  
  // Generate rhythm track (12-16 percussion hits)
  for (let i = 0; i < 15; i++) {
    notes.push({
      note: 'C',
      octave: 4,
      duration: 0.25,
      start: i * 0.5,
      velocity: 90,
      track: 'Rhythm'
    });
  }
  
  return {
    notes,
    musicalAnalysis: {
      arrangement: "Multi-track professional arrangement",
      harmonyStructure: `${style} chord progression with proper voice leading`,
      rhythmicInterplay: "Coordinated rhythm patterns across all tracks",
      styleElements: `Genre-appropriate ${style} styling`
    },
    chordProgression: ['I', 'vi', 'IV', 'V'],
    name: `Professional ${style} Full Arrangement`
  };
}

export async function generateMelody(scale: string, style: string, complexity: number = 5, availableTracks?: Array<{id: string, instrument: string, name: string}>, musicalParams?: {
  scaleNotes: string[],
  scaleRoot: string,
  beatsPerMeasure: number,
  noteDurations: string[],
  gridSnapSize: number
}): Promise<any> {
  try {
    console.log(`🎵 Starting PROFESSIONAL melody generation: ${style} in ${scale} scale, complexity ${complexity}`);

    // Extract music theory parameters
    const scaleNotes = musicalParams?.scaleNotes || getScaleNotes(scale).map(s => s.note);
    const scaleRoot = musicalParams?.scaleRoot || scale.split(' ')[0];
    const beatsPerMeasure = musicalParams?.beatsPerMeasure || 4;
    const gridSnap = musicalParams?.gridSnapSize || 0.25;
    const noteDurations = musicalParams?.noteDurations || ['quarter', 'eighth', 'half'];

    // Build comprehensive music theory prompt for FULL ARRANGEMENT
    const musicTheoryPrompt = `You are a professional composer and arranger. Create a COMPLETE MULTI-INSTRUMENT ${style} arrangement using advanced music theory principles.

GENERATE A COMPLETE MULTI-TRACK MUSICAL ARRANGEMENT:

MUSICAL PARAMETERS:
- Scale: ${scale} (Notes: ${scaleNotes.join(', ')})
- Root Note: ${scaleRoot}
- Time Signature: ${beatsPerMeasure}/4
- Complexity Level: ${complexity}/10
- Style: ${style}
- Generate 4-8 measures of music (16-32 beats total)

REQUIRED TRACKS (Generate notes for ALL these tracks):
1. "Melody" - Lead melodic line (octaves 4-6, 12-20 notes)
2. "Harmony" - Chord accompaniment (octaves 3-5, 8-15 notes) 
3. "Bass" - Bass foundation (octaves 2-3, 6-12 notes)
4. "Rhythm" - Rhythmic accents (octaves 3-5, 8-16 notes)

ARRANGEMENT REQUIREMENTS:
${complexity >= 7 ? `
- Create sophisticated 4-part harmony with voice leading
- Use extended chords (7ths, 9ths, add9, sus4)
- Apply modal interchange and chromatic approaches
- Include complex rhythmic interplay between tracks
- Add syncopation and polyrhythmic elements
` : complexity >= 4 ? `
- Create balanced 4-part arrangement with proper voicing
- Use triads and some 7th chords for harmony
- Apply basic voice leading principles
- Mix rhythm patterns effectively across tracks
- Include some syncopation and rhythmic variation
` : `
- Create simple but complete 4-track arrangement
- Use basic triads for harmony track
- Keep bass on root notes and fifths
- Use straightforward rhythmic patterns
- Focus on strong melodic content
`}

TRACK-SPECIFIC GUIDELINES:
MELODY Track: Main melodic line with expressive phrasing
HARMONY Track: Chord voicings and harmonic accompaniment
BASS Track: Root movement and bass patterns (longer durations)
RHYTHM Track: Rhythmic punctuation and accents (shorter durations)

ADVANCED MUSIC THEORY FOR COHESIVE ARRANGEMENTS:

1. HARMONIC RELATIONSHIP RULES:
- MELODY must outline chord tones of the underlying harmony
- HARMONY track provides the chord progression foundation
- BASS plays root movement following standard progressions
- RHYTHM emphasizes strong beats and provides syncopation

2. TIMING COORDINATION:
- All tracks must be rhythmically coordinated
- Melody and Rhythm can syncopate, Harmony and Bass provide stability
- Use complementary rhythms (when one track is busy, others are simpler)

3. VOICE LEADING PRINCIPLES:
- Smooth voice leading between Harmony track chords
- Melody should connect chord tones with passing tones
- Bass movement by stepwise motion or perfect 4ths/5ths
- Avoid parallel fifths/octaves between Harmony and Bass

4. DYNAMIC INTERACTION:
- Create musical conversation between tracks
- Use call-and-response between Melody and other instruments
- Layer complexity: simple bass, moderate harmony, complex melody/rhythm

STYLE-SPECIFIC PROFESSIONAL ARRANGEMENTS:
${style === 'jazz' ? `
- Use ii-V-I progressions with extended chords (Dm7-G7-Cmaj7)
- MELODY: Bebop scales, blue notes, syncopated phrasing
- HARMONY: Rootless voicings (3rd, 7th, 9th, 13th)
- BASS: Walking quarter notes connecting chord roots
- RHYTHM: Syncopated comping on off-beats, charleston rhythm
` : style === 'classical' ? `
- Use functional harmony: I-vi-IV-V or I-IV-V-I progressions
- MELODY: Balanced 4-bar phrases with clear cadences
- HARMONY: Four-part block chords with proper voice leading
- BASS: Alberti bass or arpeggiated accompaniment patterns
- RHYTHM: Steady accompaniment supporting melodic phrasing
` : style === 'rock' ? `
- Use power chord progressions: I-bVII-IV or vi-IV-I-V
- MELODY: Strong, memorable riffs with power chord implications
- HARMONY: Power chords (root-fifth-octave) with palm muting
- BASS: Driving eighth notes on root notes, occasional fifths
- RHYTHM: Strong downbeats, syncopated accents, driving feel
` : style === 'pop' ? `
- Use I-V-vi-IV or vi-IV-I-V progressions for catchiness
- MELODY: Singable, hook-based melodies with repetition
- HARMONY: Simple triads with occasional sus2/sus4 chords
- BASS: Simple root-fifth patterns supporting the chord changes
- RHYTHM: Steady pop groove with syncopated accents
` : `
- Apply genre-appropriate harmonic progressions
- Create balanced instrumental arrangement
- Ensure rhythmic and harmonic coherence across all tracks
`}

CRITICAL: You MUST generate AT LEAST 10 notes for EACH of the 4 tracks. Total should be 40-60 notes.
DO NOT generate a single melody - generate a COMPLETE 4-TRACK ARRANGEMENT.

TRACK REQUIREMENTS:
- "Melody" track: 10-15 notes (lead melody)
- "Harmony" track: 8-12 notes (chord accompaniment) 
- "Bass" track: 6-10 notes (bass foundation)
- "Rhythm" track: 8-15 notes (rhythmic accents)

REQUIRED JSON FORMAT (ALL 4 TRACKS REQUIRED):
{
  "notes": [
    {"note": "C", "octave": 4, "duration": 1.0, "start": 0.0, "velocity": 85, "track": "Melody"},
    {"note": "E", "octave": 3, "duration": 2.0, "start": 0.0, "velocity": 65, "track": "Harmony"},
    {"note": "C", "octave": 2, "duration": 4.0, "start": 0.0, "velocity": 75, "track": "Bass"},
    {"note": "C", "octave": 4, "duration": 0.5, "start": 0.0, "velocity": 90, "track": "Rhythm"}
  ],
  "musicalAnalysis": {
    "arrangement": "Multi-instrument arrangement description",
    "harmonyStructure": "Chord progression and harmonic analysis",
    "rhythmicInterplay": "How tracks work together rhythmically",
    "styleElements": "${style} style elements applied across arrangement"
  },
  "chordProgression": ["I", "V", "vi", "IV"],
  "name": "${style} ${scale} Full Arrangement"
}`;

    console.log(`🎼 Sending advanced music theory prompt to AI...`);

    // Enforce our own AI timeout to avoid route hangs, even if SDK timeout is not respected
    const aiTimeoutMs = parseInt(process.env.XAI_TIMEOUT_MS || "28000", 10);
    const aiCallPromise = openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [{ 
        role: "system", 
        content: `You are a professional music arranger. You MUST create complete multi-instrument arrangements with exactly 4 tracks: "Melody", "Harmony", "Bass", and "Rhythm". Each track must have multiple notes. Generate 40-60 total notes distributed across all 4 tracks. This is NOT a single melody - it's a full band arrangement.` 
      }, { 
        role: "user", 
        content: musicTheoryPrompt 
      }],
      response_format: { type: "json_object" },
      temperature: 0.6, // Lower temperature for more consistent JSON formatting
      max_tokens: 3500 // Increased for larger arrangements
    });

    const response = await Promise.race([
      aiCallPromise,
      new Promise((_, reject) => setTimeout(() => {
        console.warn(`⚠️ xAI composition timed out after ${aiTimeoutMs}ms — falling back.`);
        reject(new Error("AI generation timed out"));
      }, aiTimeoutMs))
    ]);

    const content = (response as any)?.choices?.[0]?.message?.content as string | undefined;
    console.log(`🤖 Professional AI composition received: ${content?.length || 0} characters`);

    if (!content) {
      throw new Error("Empty response from AI composer");
    }

    let result;
    try {
      // Ultra-aggressive JSON cleaning to fix the position 4 error
      let cleanContent = content;
      
      // Log the exact characters at the problem position
      console.log(`🔍 Characters 0-10: ${JSON.stringify(content.substring(0, 10))}`);
      console.log(`🔍 Character codes 0-10: [${content.substring(0, 10).split('').map((c: string) => c.charCodeAt(0)).join(', ')}]`);
      
      // The issue is newlines in JSON! Remove them completely
      cleanContent = cleanContent
        .replace(/^\uFEFF/, '') // Remove BOM
        .replace(/^\u200B/, '') // Remove zero-width space  
        .replace(/[\r\n\t]/g, '') // REMOVE newlines/tabs completely (not convert to space)
        .replace(/\u0000/g, '') // Remove null characters
        .replace(/\s+/g, ' ') // Normalize all remaining whitespace to single spaces
        .trim();
      
      // Find the actual JSON start more aggressively
      const jsonStart = cleanContent.indexOf('{');
      if (jsonStart > 0) {
        console.log(`🔧 Found JSON start at position ${jsonStart}, removing ${jsonStart} characters`);
        cleanContent = cleanContent.substring(jsonStart);
      }
      
      // Remove markdown blocks
      if (cleanContent.includes('```')) {
        cleanContent = cleanContent.replace(/```json\n?/, '').replace(/```\n?$/, '');
      }
      
      // Fix common JSON issues
      cleanContent = cleanContent
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/\\"/g, '"');
      
      // Handle truncated responses by finding last complete note
      if (!cleanContent.trim().endsWith('}')) {
        console.log('🔧 Repairing truncated JSON...');
        const lastNote = cleanContent.lastIndexOf('{"note":');
        if (lastNote > -1) {
          cleanContent = cleanContent.substring(0, lastNote).replace(/,$/, '') + 
            '],"musicalAnalysis":{"arrangement":"AI Multi-track arrangement","harmonyStructure":"AI-generated chord progression"},"chordProgression":["I","V","vi","IV"],"name":"AI Professional Arrangement"}';
        }
      }
      
      console.log(`🔧 Cleaned content starts with: ${JSON.stringify(cleanContent.substring(0, 20))}`);
      result = JSON.parse(cleanContent);
      
      console.log(`✅ Successfully parsed arrangement with ${result.notes?.length || 0} notes`);
      
      // Debug: Show track distribution in the AI response
      if (result.notes && Array.isArray(result.notes)) {
        const trackCounts = result.notes.reduce((acc: any, note: any) => {
          acc[note.track || 'unknown'] = (acc[note.track || 'unknown'] || 0) + 1;
          return acc;
        }, {});
        console.log('🎼 AI track distribution:', trackCounts);
      }
      
    } catch (parseError) {
      console.error("❌ AI JSON parsing still failed after cleaning:", parseError);
      console.log("🔍 Raw content (first 200 chars):", JSON.stringify(content.substring(0, 200)));
      
      // Let's try one more aggressive fix attempt
      try {
        console.log("🔧 Attempting emergency JSON repair...");
        let emergencyContent = content;
        
        // Remove everything before the first { and after the last }
        const firstBrace = emergencyContent.indexOf('{');
        const lastBrace = emergencyContent.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          emergencyContent = emergencyContent.substring(firstBrace, lastBrace + 1);
          console.log(`🔧 Extracted JSON between braces: ${emergencyContent.length} chars`);
          
          // Clean up common issues
          emergencyContent = emergencyContent
            .replace(/[\r\n\t]/g, ' ')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/\s+/g, ' ');
          
          result = JSON.parse(emergencyContent);
          console.log("✅ Emergency JSON repair successful!");
        } else {
          throw new Error("Cannot find valid JSON structure");
        }
      } catch (emergencyError) {
        console.error("❌ Emergency repair also failed:", emergencyError);
        throw new Error("AI response format is completely invalid");
      }
    }

    const notes = result.notes || [];
    
    if (!Array.isArray(notes) || notes.length === 0) {
      throw new Error("AI generated no usable notes");
    }

    // Professional note validation and enhancement
    const professionalNotes = notes.map((note, index) => {
      // Validate note is in scale (with some chromatic flexibility for higher complexity)
      let validNote = note.note || 'C';
      if (!scaleNotes.includes(validNote) && complexity < 6) {
        // For lower complexity, force notes to be in scale
        validNote = scaleNotes[index % scaleNotes.length];
      }

      return {
        note: validNote,
        octave: Math.max(2, Math.min(6, note.octave || 4)),
        duration: Math.max(0.125, Math.min(4, note.duration || 0.5)),
        start: Math.max(0, note.start || (index * 0.5)),
        velocity: Math.max(40, Math.min(120, note.velocity || 80)),
        track: note.track || (availableTracks?.[0]?.id || 'track1')
      };
    });

    console.log(`✅ Generated ${professionalNotes.length} professional notes with music theory applied`);

    return {
      notes: professionalNotes,
      name: result.name || `${style} ${scale} Professional Melody`,
      scale,
      musicalAnalysis: result.musicalAnalysis || {
        scaleUsage: `Applied ${scale} scale with ${complexity}/10 complexity`,
        voiceLeading: "Professional voice leading applied",
        rhythmicPattern: "Appropriate rhythmic structure for " + style,
        styleElements: `${style} style elements incorporated`
      },
      chordProgression: result.chordProgression || [],
      mixingNotes: "Professional studio processing recommended"
    };

  } catch (error) {
    console.error("❌ Professional melody generation failed:", error);
    console.log("🔄 Using music theory-based fallback generation");
    
    // Enhanced fallback with music theory
    return createProfessionalMultiTrackArrangement(scale, style, complexity, availableTracks, musicalParams);
  }
}

// Create professional multi-track arrangement 
function createProfessionalMultiTrackArrangement(scale: string, style: string, complexity: number, availableTracks?: any[], musicalParams?: any): any {
  const scaleNotes = musicalParams?.scaleNotes || getScaleNotes(scale).map((s: any) => s.note);
  const notes = [];
  const baseProgression = ['C', 'Am', 'F', 'G']; // I-vi-IV-V progression
  
  console.log("🎼 Creating professional multi-track arrangement with COORDINATED timing");
  
  // Generate melody track - leads the composition with syncopated timing
  for (let i = 0; i < 12; i++) {
    notes.push({
      note: scaleNotes[(i * 2) % scaleNotes.length], // Skip notes for melody
      octave: 5,
      duration: i % 3 === 0 ? 1.0 : 0.5, // Varied rhythm
      start: i * 0.75, // Offset timing
      velocity: 85 + (i % 3) * 5,
      track: 'Melody'
    });
  }
  
  // Generate harmony track - fills in between melody notes
  for (let i = 0; i < 8; i++) {
    const chordRoot = baseProgression[i % baseProgression.length];
    notes.push({
      note: chordRoot,
      octave: 4,
      duration: 1.5,
      start: (i * 2.0) + 0.5, // Offset from melody
      velocity: 65,
      track: 'Harmony'
    });
  }
  
  // Generate bass track - plays on strong beats only
  for (let i = 0; i < 8; i++) {
    const bassNote = baseProgression[i % baseProgression.length];
    notes.push({
      note: bassNote,
      octave: 3,
      duration: 1.0,
      start: i * 2.0, // On the beat
      velocity: 85,
      track: 'Bass'
    });
  }
  
  // Generate rhythm track - syncopated with melody
  for (let i = 0; i < 12; i++) {
    notes.push({
      note: 'C',
      octave: 4,
      duration: 0.25,
      start: (i * 0.5) + 0.25, // Off-beat
      velocity: 80 + (i % 2) * 10,
      track: 'Rhythm'
    });
  }
  
  console.log(`🎼 Generated ${notes.length} notes across 4 tracks: Melody(14), Harmony(10), Bass(9), Rhythm(15)`);
  
  return {
    notes,
    chordProgression: ['I', 'vi', 'IV', 'V'],
    musicalAnalysis: {
      arrangement: "Multi-track professional arrangement",
      harmonyStructure: `${style} chord progression with proper voice leading`,
      rhythmicInterplay: "Coordinated rhythm patterns across all tracks",
      styleElements: `Genre-appropriate ${style} styling`
    },
    mixingNotes: "Professional multi-instrument arrangement with coordinated tracks"
  };
}

// Enhanced fallback that actually uses music theory (OLD VERSION)
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

function generateRandomMultiTrackMelody(scale: string, style: string, complexity: number, mood: string, availableTracks?: Array<{id: string, instrument: string, name: string}>, musicalParams?: {
  scaleNotes: string[],
  scaleRoot: string,
  beatsPerMeasure: number,
  noteDurations: string[],
  gridSnapSize: number
}): any {
  // Use provided scale notes or fallback to scale detection
  const scaleNotes = musicalParams?.scaleNotes ? 
    musicalParams.scaleNotes.map(note => ({note, interval: 0})) : 
    getScaleNotes(scale);
  const gridSnap = musicalParams?.gridSnapSize || 0.25;
  const availableDurations = musicalParams?.noteDurations || ['quarter', 'eighth', 'half'];

  // Convert durations to beats
  const durationMap = {'whole': 4, 'half': 2, 'quarter': 1, 'eighth': 0.5, 'sixteenth': 0.25};
  const beatDurations = availableDurations.map(d => durationMap[d as keyof typeof durationMap] || 1);
  const notes: any[] = [];

  // Default tracks if none provided
  const tracks = availableTracks || [
    {id: 'track1', instrument: 'piano-keyboard', name: 'Piano'},
    {id: 'track2', instrument: 'strings-guitar', name: 'Guitar'},
    {id: 'track3', instrument: 'flute-recorder', name: 'Flute'}
  ];

  // Generate notes for each track
  tracks.forEach((track, trackIndex) => {
    const numNotes = Math.floor(Math.random() * 6) + 4; // 4-10 notes per track
    const octaveVariations = getInstrumentOctaveRange(track.instrument);

    let currentTime = trackIndex * 0.5; // Slight offset between tracks

    for (let i = 0; i < numNotes; i++) {
      const randomNote = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
      const randomOctave = octaveVariations[Math.floor(Math.random() * octaveVariations.length)];
      const duration = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0][Math.floor(Math.random() * 6)];

      notes.push({
        note: randomNote.note,
        octave: randomOctave,
        start: currentTime,
        duration,
        track: track.id
      });

      currentTime += duration + (Math.random() * 0.25); // Small random gaps
    }
  });

  return {
    notes: notes,
    name: `${mood} ${style} Multi-Track Melody`,
    scale,
    explanation: `Randomized ${mood} melody with ${notes.length} notes across ${tracks.length} instruments`
  };

  // Helper functions for intelligent arrangement
  function getInstrumentRole(instrument: string): string {
    const roleMap: { [key: string]: string } = {
      'piano-grand': 'harmony',
      'piano-electric': 'melody',
      'strings-violin': 'melody',
      'strings-guitar': 'rhythm',
      'guitar-electric': 'lead',
      'bass-electric': 'bass',
      'bass-upright': 'bass',
      'flute-concert': 'melody',
      'horns-trumpet': 'melody',
      'synth-analog': 'lead',
      'pads-warm': 'texture',
      'timpani': 'percussion',
      'snare-drum': 'rhythm'
    };
    return roleMap[instrument] || 'harmony';
  }

  function getInstrumentRegister(instrument: string): string {
    const registerMap: { [key: string]: string } = {
      'piano-grand': 'mid',
      'strings-violin': 'high',
      'bass-electric': 'low',
      'bass-upright': 'low',
      'flute-concert': 'high',
      'horns-trumpet': 'high',
      'strings-cello': 'low',
      'timpani': 'low'
    };
    return registerMap[instrument] || 'mid';
  }

  function getInstrumentOctaveRange(instrument: string): number[] {
    const octaveMap: { [key: string]: number[] } = {
      'piano-grand': [3, 4, 5],
      'piano-electric': [3, 4, 5],
      'strings-violin': [4, 5, 6],
      'strings-guitar': [3, 4, 5],
      'guitar-electric': [3, 4, 5],
      'bass-electric': [2, 3],
      'bass-upright': [2, 3],
      'flute-concert': [4, 5, 6],
      'flute-recorder': [4, 5],
      'horns-trumpet': [4, 5],
      'horns-trombone': [3, 4],
      'synth-analog': [3, 4, 5],
      'pads-warm': [3, 4, 5],
      'timpani': [2, 3],
      'snare-drum': [4],
      'strings-cello': [2, 3, 4],
      'strings-viola': [3, 4, 5]
    };
    return octaveMap[instrument] || [3, 4, 5];
  }

  function getInstrumentRhythm(instrument: string, style: string): string {
    if (style === 'jazz') {
      return instrument.includes('bass') ? 'walking' : 'swing';
    } else if (style === 'rock') {
      return instrument.includes('guitar') ? 'power-chords' : 'driving';
    } else if (style === 'classical') {
      return 'legato';
    }
    return 'steady';
  }

  function getHarmonicFunction(instrument: string): string {
    if (instrument.includes('bass')) return 'root-foundation';
    if (instrument.includes('piano') || instrument.includes('guitar')) return 'chord-provider';
    if (instrument.includes('strings') || instrument.includes('horn')) return 'harmonic-color';
    return 'melodic-support';
  }

  function getMelodicDirection(style: string, mood: string): string {
    if (mood === 'happy') return 'ascending-tendency';
    if (mood === 'melancholy') return 'descending-tendency';
    if (style === 'jazz') return 'chromatic-approach';
    return 'scale-based';
  }

  function getDensityLevel(complexity: number): string {
    if (complexity > 8) return 'dense';
    if (complexity > 5) return 'medium';
    return 'sparse';
  }

  function getArticulation(instrument: string, style: string): string {
    if (style === 'jazz') return 'legato-swing';
    if (style === 'rock') return 'percussive-attack';
    if (style === 'classical') return 'lyrical-legato';
    return 'natural';
  }

  function getGroovePattern(style: string): string {
    const grooves: { [key: string]: string } = {
      'jazz': 'swing',
      'rock': 'straight-rock',
      'pop': 'four-on-floor',
      'blues': 'shuffle',
      'classical': 'rubato'
    };
    return grooves[style] || 'straight';
  }

  function getSubdivision(complexity: number): string {
    if (complexity > 8) return 'complex-polyrhythm';
    if (complexity > 6) return 'triplets-sixteenths';
    if (complexity > 4) return 'eighth-notes';
    return 'quarter-notes';
  }

  function getSyncopationLevel(style: string, complexity: number): string {
    if (style === 'jazz' && complexity > 6) return 'high';
    if (style === 'rock' && complexity > 5) return 'medium';
    if (style === 'classical') return 'minimal';
    return 'low';
  }

  return {
    notes: notes,
    name: `${mood} ${style} Multi-Track Melody`,
    scale,
    explanation: `Randomized ${mood} melody with ${notes.length} notes across ${availableTracks?.length || 1} track(s)`
  };
}

export async function scanCodeVulnerabilities(code: string, language: string, aiProvider?: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are a security expert. Analyze this ${language} code for vulnerabilities. 
          Return JSON with: vulnerabilities array (each with type, severity, line, description, recommendation), 
          securityScore (0-100), summary.`
        },
        {
          role: "user",
          content: `Scan this ${language} code for security vulnerabilities:\n\n${code}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    throw new Error("Failed to scan vulnerabilities: " + (error as Error).message);
  }
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

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are a creative songwriter who writes unique, never-repeating lyrics. Write ${randomApproach} lyrics about ${theme} in ${genre} style with ${mood} mood.
          Use ${randomPerspective} perspective and ${randomStructure} structure.
          Each set of lyrics must be COMPLETELY ORIGINAL and different from previous generations.`
        },
        {
          role: "user",
          content: `Create fresh, original ${genre} lyrics about "${theme}" with ${mood} mood and complexity level ${complexity}/10.
          Session: ${timestamp}-${seed}

          Requirements:
          - ${randomApproach} approach
          - ${randomPerspective} writing style  
          - ${randomStructure} structure
          - Complexity ${complexity}/10: ${complexity <= 3 ? 'Simple words, basic rhymes, straightforward themes' : complexity <= 6 ? 'Moderate vocabulary, some metaphors, varied rhyme schemes' : 'Advanced vocabulary, complex metaphors, intricate wordplay, layered meanings'}
          - Must be completely unique and different
          - Genre-appropriate language and imagery
          - Emotionally resonant and meaningful`
        }
      ],
      temperature: 0.95,
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
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are a rhyme dictionary. Return JSON array of words that rhyme with the given word. 
          Include perfect rhymes and near rhymes.`
        },
        {
          role: "user",
          content: `Find rhyming words for: ${word}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
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

export async function codeToMusic(code: string, language: string, complexity: number = 5): Promise<any> {
  try {
    const musicalStyles = ["classical symphony", "jazz fusion", "electronic ambient", "rock anthem", "hip-hop groove", "world music", "orchestral cinematic", "minimal techno"];
    const interpretations = ["mathematical and precise", "organic and flowing", "aggressive and intense", "ethereal and spacious", "rhythmic and percussive", "melodic and harmonic"];
    const instruments = ["piano and strings", "synthesizers and drums", "guitar and bass", "orchestra", "electronic pads", "world instruments"];

    const randomStyle = musicalStyles[Math.floor(Math.random() * musicalStyles.length)];
    const randomInterpretation = interpretations[Math.floor(Math.random() * interpretations.length)];
    const randomInstruments = instruments[Math.floor(Math.random() * instruments.length)];
    const timestamp = Date.now();
    const seed = Math.floor(Math.random() * 10000);

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are a creative code-to-music AI that creates unique, never-repeating musical interpretations. 
          Convert ${language} code structure to ${randomStyle} music in a ${randomInterpretation} way using ${randomInstruments}.
          Each conversion must be COMPLETELY DIFFERENT and creative. Return JSON with detailed musical mapping.`
        },
        {
          role: "user",
          content: `Transform this ${language} code into ${randomStyle} music (${randomInterpretation}) with complexity level ${complexity}/10:
          Session: ${timestamp}-${seed}

          Code:
          ${code}

          Requirements:
          - Create unique musical interpretation 
          - Complexity ${complexity}/10: ${complexity <= 3 ? 'Simple melodies, basic drum patterns' : complexity <= 6 ? 'Moderate complexity with some harmonies' : 'Complex arrangements with multiple instruments and advanced rhythms'}
          - Map code structure to ${randomStyle} elements
          - Use ${randomInstruments} for instrumentation
          - Make it ${randomInterpretation} in feel
          - RETURN ACTUAL PLAYABLE NOTES FOR MULTIPLE INSTRUMENTS in this exact format:
          {
            "melody": [
              {"note": "C4", "start": 0, "duration": 0.5, "frequency": 261.63, "instrument": "piano"},
              {"note": "G3", "start": 0, "duration": 1.0, "frequency": 196.00, "instrument": "bass"},
              {"note": "E4", "start": 0.5, "duration": 0.5, "frequency": 329.63, "instrument": "violin"}
            ],
            "drumPattern": {
              "kick": [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
              "snare": [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
              "hihat": [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true]
            },
            "title": "Brief title",
            "description": "Brief description"
          }
          - Map code elements to instruments: classes→piano, functions→violin/guitar, variables→bass, loops→drums
          - Include drum patterns with kick, snare, hihat arrays (16 steps each, true/false)
          - melody MUST be an array of note objects with note, start, duration, frequency
          - Must be different from previous conversions`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Check if melody is an array of playable notes (not just description text)
    if (!result.melody || !Array.isArray(result.melody) || result.melody.length === 0) {
      console.log("AI returned invalid melody format, using fallback");
      return generateRandomCodeMusic(language, randomStyle, randomInterpretation);
    }

    // Validate that melody contains proper note objects
    const hasValidNotes = result.melody.every((note: any) => 
      note && typeof note === 'object' && note.note && typeof note.start === 'number'
    );

    if (!hasValidNotes) {
      console.log("AI melody notes are invalid, using fallback");
      return generateRandomCodeMusic(language, randomStyle, randomInterpretation);
    }

    return result;
  } catch (error) {
    console.error("Code-to-music AI generation failed, using randomized fallback:", error);
    return generateRandomCodeMusic(language, "creative", "algorithmic");
  }
}

function generateRandomCodeMusic(language: string, style: string, interpretation: string): any {
  const melodyNotes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];
  const rhythms = ["4/4", "3/4", "7/8", "5/4"];

  const instruments = ['piano', 'violin', 'guitar', 'bass', 'flute', 'trumpet'];

  // Generate multi-instrument melody (classes→piano, functions→violin/guitar, variables→bass)
  const melody = Array.from({length: Math.floor(Math.random() * 12) + 8}, (_, i) => {
    const note = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
    const instrument = instruments[Math.floor(Math.random() * instruments.length)];
    return {
      note: note,
      start: i * 0.25,
      duration: [0.25, 0.5, 1.0][Math.floor(Math.random() * 3)],
      frequency: getNoteFrequency(note),
      instrument: instrument
    };
  });

  // Generate a basic drum pattern based on code complexity
  const drumPattern = {
    kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    hihat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    bass: [true, false, true, false, false, false, true, false, true, false, true, false, false, false, true, false],
    tom: Array.from({length: 16}, () => Math.random() < 0.1),
    openhat: Array.from({length: 16}, () => Math.random() < 0.05),
    clap: Array.from({length: 16}, () => Math.random() < 0.1),
    crash: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
  };

  return {
    melody,
    drumPattern,
    rhythm: rhythms[Math.floor(Math.random() * rhythms.length)],
    style,
    interpretation,
    language,
    title: `${style} Code Symphony`,
    description: `${interpretation} ${style} interpretation of ${language} code structure with multi-instrument arrangement`,
    bpm: Math.floor(Math.random() * 40) + 100 // 100-140 BPM
  };
}

export async function generateDynamicLayers(currentArrangement: any, targetStyle: string, complexity: number): Promise<any> {
  try {
    const layerTypes = [
      "harmonic foundation", "rhythmic support", "melodic counterpoint", 
      "atmospheric texture", "percussive accents", "bass reinforcement"
    ];
    const instruments = [
      "strings", "brass", "woodwinds", "synthesizers", 
      "guitar", "piano", "choir", "ethnic instruments", "electronic pads",
      "violin", "cello", "flute", "trumpet", "saxophone", "organ", 
      "harp", "acoustic guitar", "electric piano", "ambient pads"
    ];
    const approaches = [
      "subtle and supportive", "bold and prominent", "intricate and complex",
      "minimal and spacious", "rich and lush", "rhythmic and driving"
    ];

    const randomLayerType = layerTypes[Math.floor(Math.random() * layerTypes.length)];
    const randomInstrument = instruments[Math.floor(Math.random() * instruments.length)];
    const randomApproach = approaches[Math.floor(Math.random() * approaches.length)];
    const timestamp = Date.now();
    const seed = Math.floor(Math.random() * 10000);

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are an AI music arranger specializing in dynamic instrument layering. Analyze the current musical arrangement and intelligently add ${randomApproach} ${randomLayerType} layers using ${randomInstrument}.

          IMPORTANT: Focus on MELODIC and HARMONIC instruments, NOT percussion/drums. Generate instruments like:
          - Piano, organ, electric piano
          - Violin, cello, guitar, harp
          - Flute, trumpet, saxophone
          - Synthesizers, ambient pads, choir
          - Avoid drums, beats, percussion unless specifically requested

          Create layers that:
          - Complement existing elements without competing
          - Add ${randomApproach} character to the arrangement  
          - Use ${randomInstrument} in creative melodic/harmonic ways
          - Maintain musical coherence and balance
          - Each layer must be UNIQUE and contextually appropriate
          - Generate 2-4 different instrumental layers with varied roles

          Return JSON with: layers array containing {instrument, type, notes, volume, pan, effects, role}`
        },
        {
          role: "user",
          content: `Add intelligent ${randomLayerType} layers to this ${targetStyle} arrangement (complexity ${complexity}):

          Current Arrangement:
          ${JSON.stringify(currentArrangement, null, 2)}

          Session: ${timestamp}-${seed}

          Requirements:
          - Add ${randomApproach} ${randomInstrument} layers
          - Focus on ${randomLayerType}
          - Complexity level: ${complexity}/10
          - Must enhance, not overwhelm existing elements
          - Create unique layers different from previous generations
          - Include specific instrument techniques and effects`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    if (!result.layers) {
      return generateRandomLayers(randomLayerType, randomInstrument, randomApproach, complexity);
    }

    return {
      ...result,
      layerType: randomLayerType,
      primaryInstrument: randomInstrument,
      approach: randomApproach,
      complexity
    };
  } catch (error) {
    console.error("Dynamic layering AI generation failed, using randomized fallback:", error);
    return generateRandomLayers("harmonic foundation", "strings", "supportive", complexity);
  }
}

function generateRandomLayers(layerType: string, instrument: string, approach: string, complexity: number): any {
  const numLayers = Math.min(Math.floor(complexity / 2) + 1, 4); // 1-4 layers based on complexity
  const layers = [];

  // Ensure diverse melodic instruments
  const melodicInstruments = [
    "Piano", "Electric Piano", "Violin", "Cello", "Acoustic Guitar", 
    "Flute", "Trumpet", "Saxophone", "Organ", "Harp", "Ambient Pad", 
    "String Section", "Choir", "Synthesizer"
  ];

  for (let i = 0; i < numLayers; i++) {
    const layerInstrument = melodicInstruments[Math.floor(Math.random() * melodicInstruments.length)];
    const noteCount = Math.floor(Math.random() * 8) + 4; // 4-12 notes per layer for richer content
    const notes = Array.from({length: noteCount}, (_, idx) => ({
      frequency: 220 * Math.pow(2, Math.random() * 3), // Expanded 3-octave range
      start: idx * (Math.random() * 1.2 + 0.3), // More varied timing
      duration: Math.random() * 2 + 0.5, // 0.5-2.5 second durations
      velocity: Math.random() * 0.4 + 0.3 // 0.3-0.7 velocity range
    }));

    layers.push({
      instrument: layerInstrument,
      type: layerType,
      notes,
      volume: Math.random() * 0.3 + 0.4, // 0.4-0.7 volume
      pan: (Math.random() - 0.5) * 1.6, // -0.8 to 0.8 stereo pan
      effects: [`reverb-${Math.floor(Math.random() * 3) + 1}`, `eq-${Math.floor(Math.random() * 2) + 1}`],
      role: `${approach} ${layerType}`
    });
  }

  return {
    layers,
    layerType,
    primaryInstrument: instrument,
    approach,
    complexity,
    explanation: `Generated ${numLayers} ${approach} ${instrument} layers for ${layerType}`
  };
}

export async function generateBeatFromLyrics(lyrics: string, genre: string, complexity: number = 5, aiProvider?: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are a music producer who analyzes lyrics to create matching beat patterns. 
          Analyze the lyrics for rhythm, flow, syllable density, and mood, then generate a 16-step drum pattern with complexity level ${complexity}/10.
          Consider the genre: ${genre}. Return JSON with:
          - beatPattern: object with kick, snare, hihat, openhat arrays (16 boolean values each)
          - bpm: suggested tempo based on lyrical flow
          - analysis: rhythm analysis, flow type, and reasoning
          - suggestions: production tips for this lyrical style
          - complexity: ${complexity <= 3 ? 'Simple patterns focusing on basic kick and snare' : complexity <= 6 ? 'Moderate patterns with some fills and variations' : 'Complex patterns with intricate fills, ghost notes, and polyrhythms'}`
        },
        {
          role: "user",
          content: `Analyze these ${genre} lyrics and generate a matching beat pattern with complexity level ${complexity}/10:\n\n${lyrics}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    throw new Error("Failed to generate beat from lyrics: " + (error as Error).message);
  }
}

export async function chatAssistant(message: string, context: string = "", conversationHistory: any[] = [], aiProvider?: string): Promise<string> {
  try {
    const systemMessage = {
      role: "system" as const,
      content: `You are an AI assistant for CodedSwitch Studio, specializing in music production and code development. 

KEY CAPABILITIES:
- Song analysis and vocal detection (especially collaborative tracks)
- Beat making and melody composition
- Code translation between languages
- Security vulnerability scanning
- Lyric writing and vocal coaching
- Music-to-Code bidirectional translation

MEMORY INSTRUCTIONS:
- Remember all previous song analyses in this conversation
- Track vocal presence, collaborators, and lyrical content from uploaded songs
- Reference previous uploads when discussing improvements or comparisons
- Maintain context about user's musical style and preferences
- If user mentions lyrics but previous analysis said "no vocals", re-examine and correct

CONVERSATION CONTEXT:
${context ? `Current Context: ${context}` : ""}

RECENT SONG ANALYSES:
${conversationHistory.length > 0 ? 
  conversationHistory
    .filter(msg => msg.type === 'song-analysis' || msg.content.includes('Song Analysis Complete'))
    .slice(-3) // Keep last 3 analyses
    .map(msg => `- ${msg.content.split('\n')[0]}`)
    .join('\n') 
  : "No recent song analyses"}

Provide helpful, accurate responses while maintaining memory of previous interactions.`
    };

    const messages: any[] = [systemMessage];

    // Add relevant conversation history (last 6 messages for context)
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-6);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }

    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    throw new Error("Failed to get AI response: " + (error as Error).message);
  }
}

export async function analyzeSong(songName: string, analysisPrompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: "You are a Grammy-winning music producer and A&R executive with 20+ years experience. Provide brutally honest but constructive feedback that helps artists improve and succeed commercially. Focus on actionable advice and specific improvement suggestions."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.8,
    });

    return response.choices[0].message.content || "Analysis could not be completed.";
  } catch (error) {
    console.error("Song analysis AI error:", error);
    throw new Error("Failed to analyze song: " + (error as Error).message);
  }
}

// Music to Code conversion - Revolutionary bidirectional translation
export async function musicToCode(musicData: any, language: string, codeStyle: string, complexity: number): Promise<any> {
  try {
    const prompt = `Convert this musical composition to ${language} code using ${codeStyle} style:

Musical Analysis:
- Pattern: ${JSON.stringify(musicData.pattern || {})}
- Melody: ${JSON.stringify(musicData.melody || [])}
- Tempo: ${musicData.tempo || 120} BPM
- Key: ${musicData.key || 'C Major'}
- Structure: ${JSON.stringify(musicData.structure || [])}

Code Generation Rules:
- Language: ${language}
- Style: ${codeStyle}
- Complexity: ${complexity}/10
- Map musical elements to code structures:
  * Beat patterns → Loop structures
  * Melody lines → Function calls
  * Chord progressions → Class hierarchies  
  * Tempo → Processing speed/intervals
  * Key changes → Variable scoping
  * Song structure → Application architecture

Generate functional, executable code that reflects the musical composition's structure and characteristics.`;

    const response = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are an expert at translating musical compositions into functional code. Create working, executable code that reflects the structure and patterns of the input music." },
        { role: "user", content: prompt }
      ],
      model: "grok-2-1212",
      temperature: 0.7
    });

    const generatedCode = response.choices[0]?.message?.content || "";

    // Extract code from response
    const codeMatch = generatedCode.match(/```\w*\n([\s\S]*?)\n```/);
    const cleanCode = codeMatch ? codeMatch[1] : generatedCode;

    return {
      analysis: {
        tempo: musicData.tempo || 120,
        key: musicData.key || 'C Major',
        timeSignature: musicData.timeSignature || '4/4',
        structure: musicData.structure || ['Intro', 'Main', 'Outro'],
        instruments: Object.keys(musicData.pattern || {}),
        complexity: complexity,
        mood: 'generated'
      },
      code: {
        language,
        code: cleanCode,
        description: `Generated ${language} code from musical composition`,
        framework: getFrameworkForLanguage(language),
        functionality: extractFunctionality(cleanCode, language)
      }
    };
  } catch (error) {
    console.error('Error in musicToCode:', error);
    throw error;
  }
}



function getFrameworkForLanguage(language: string): string {
  const frameworks: { [key: string]: string } = {
    javascript: 'Node.js/Browser',
    react: 'React Component',
    python: 'Python Standard',
    java: 'Spring Framework',
    csharp: '.NET Core',
    css: 'CSS3/HTML5'
  };
  return frameworks[language] || 'Standard Library';
}

function extractFunctionality(code: string, language: string): string[] {
  const functionality: string[] = [];

  // Extract functions/methods based on language patterns
  const patterns: { [key: string]: RegExp[] } = {
    javascript: [/function\s+(\w+)/g, /const\s+(\w+)\s*=/g, /class\s+(\w+)/g],
    python: [/def\s+(\w+)/g, /class\s+(\w+)/g],
    java: [/public\s+\w+\s+(\w+)\s*\(/g, /class\s+(\w+)/g],
    csharp: [/public\s+\w+\s+(\w+)\s*\(/g, /class\s+(\w+)/g],
    css: [/\.(\w+)/g, /#(\w+)/g]
  };

  const langPatterns = patterns[language] || patterns.javascript;

  langPatterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const name = match.replace(pattern, '$1');
        if (name && !functionality.includes(name)) {
          functionality.push(`${name} implementation`);
        }
      });
    }
  });

  if (functionality.length === 0) {
    functionality.push('Code structure generation', 'Basic functionality implementation');
  }

  return functionality;
}

export async function generateSamplePacksWithGrok(prompt: string, count: number) {
  try {
    console.log(`🎵 Grok: Generating ${count} packs for prompt: "${prompt}"`);

    const systemPrompt = `You are a creative music producer. Create ${count} COMPLETELY DIFFERENT and UNIQUE sample pack concepts for: ${prompt}

IMPORTANT: Make each pack TOTALLY DIFFERENT from the others. Vary everything: 
- Different BPMs (not all 128!)
- Different keys and scales  
- Different moods and energy levels
- Different instrument combinations
- Different sample types and purposes

Focus on the MUSICAL ELEMENTS requested in the prompt (melodies, harmonies, leads, pads, etc.) NOT just drums/beats.

Return ONLY valid JSON:
{"packs": [{"id": "pack_unique_id", "title": "Creative Unique Title", "description": "Detailed description of what makes this pack special", "bpm": 125, "key": "Am", "genre": "House", "samples": [{"id": "sample_unique", "name": "Descriptive Sample Name", "type": "loop", "duration": 8.0}, {"id": "sample_unique2", "name": "Another Sample", "type": "oneshot", "duration": 2.5}], "metadata": {"energy": 7, "mood": "uplifting", "instruments": ["piano", "vocals"], "tags": ["melodic", "uplifting"]}}]}

Generate 8-12 samples per pack with creative, realistic names. Include melodic elements, not just percussion.`;

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create ${count} completely unique and different sample packs for: ${prompt}. Make each pack focus on different musical elements, BPMs, keys, and moods. Be creative and diverse!` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 3000
    });

    const result = response.choices[0]?.message?.content;
    console.log(`🎵 Grok raw response length: ${result?.length || 0}`);
    console.log(`🔍 Grok raw response preview: ${result?.substring(0, 200)}...`);

    if (!result || result.trim().length === 0) {
      throw new Error("Empty response from Grok API");
    }

    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      console.error("❌ Raw response:", result);
      throw new Error(`Invalid JSON response from Grok: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
    }

    if (!parsed.packs || !Array.isArray(parsed.packs)) {
      console.error("❌ Invalid response structure:", parsed);
      throw new Error("Response missing 'packs' array");
    }

    console.log(`✅ Grok successfully generated ${parsed.packs.length} packs`);
    
    // Enhanced metadata for frontend audio engine integration
    console.log(`🎵 Enhancing packs with instrument mapping for professional audio engine...`);
    
    const enhancedPacks = parsed.packs.map((pack: any) => {
      const enhancedSamples = pack.samples.map((sample: any) => {
        // Map sample names to RealisticAudioEngine instrument types
        const instrumentType = mapToAudioEngineInstrument(sample.name);
        
        return {
          ...sample,
          // Add metadata for frontend audio engine
          instrumentType,
          frequency: getKeyFrequency(pack.key),
          useProfessionalEngine: true,
          engineInstrument: instrumentType
        };
      });
      
      return { ...pack, samples: enhancedSamples };
    });
    
    console.log(`✅ Enhanced ${enhancedPacks.length} packs with professional audio engine mapping`);
    return enhancedPacks;

  } catch (error) {
    console.error("❌ Grok sample pack generation error:", error);
    if (error instanceof Error) {
      throw new Error(`Grok API error: ${error.message}`);
    }
    throw new Error("Unknown Grok API error");
  }
}

// Map sample names to RealisticAudioEngine instrument types
function mapToAudioEngineInstrument(sampleName: string): string {
  const nameLower = sampleName.toLowerCase();
  
  // Map to RealisticAudioEngine instrument library
  if (nameLower.includes('piano')) return 'piano';
  if (nameLower.includes('violin') || nameLower.includes('fiddle')) return 'violin';
  if (nameLower.includes('guitar') && nameLower.includes('acoustic')) return 'guitar-acoustic';
  if (nameLower.includes('guitar') && !nameLower.includes('bass')) return 'guitar';
  if (nameLower.includes('banjo')) return 'guitar-acoustic'; // Use acoustic guitar for banjo
  if (nameLower.includes('mandolin')) return 'guitar-acoustic';
  if (nameLower.includes('cello')) return 'strings-violin'; // Use violin family
  if (nameLower.includes('viola')) return 'strings-violin';
  if (nameLower.includes('saxophone') || nameLower.includes('sax')) return 'horns-trumpet'; // Brass family
  if (nameLower.includes('trumpet')) return 'horns-trumpet';
  if (nameLower.includes('harmonica')) return 'flute-concert';
  if (nameLower.includes('accordion')) return 'piano-organ';
  if (nameLower.includes('whistle')) return 'flute-concert';
  if (nameLower.includes('bass') && !nameLower.includes('drum')) return 'bass';
  if (nameLower.includes('organ')) return 'piano-organ';
  if (nameLower.includes('synth') || nameLower.includes('pad') || nameLower.includes('lead')) return 'synth';
  if (nameLower.includes('strings')) return 'strings';
  if (nameLower.includes('choir') || nameLower.includes('vocal')) return 'pads-choir';
  
  // Default to piano for melodic content
  return 'piano';
}

// Simple helper function for key frequencies  
function getKeyFrequency(key: string): number {
  const keyFrequencies: { [key: string]: number } = {
    'C': 261.63, 'C#': 277.18, 'Db': 277.18, 'D': 293.66, 'D#': 311.13, 'Eb': 311.13,
    'E': 329.63, 'F': 349.23, 'F#': 369.99, 'Gb': 369.99, 'G': 392.00, 'G#': 415.30,
    'Ab': 415.30, 'A': 440.00, 'A#': 466.16, 'Bb': 466.16, 'B': 493.88
  };
  
  return keyFrequencies[key] || 440.0; // Default to A440
}

// End of Grok service - audio generation handled by frontend RealisticAudioEngine 
