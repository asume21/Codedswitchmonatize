import { GoogleGenerativeAI } from "@google/generative-ai";

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export interface SongSection {
  duration: number;
  measures: number;
  instruments: string[];
  vocals?: boolean;
  dynamics: string;
  tempo?: number;
  key?: string;
  description: string;
}

export interface SongStructure {
  [sectionName: string]: SongSection;
}

export interface GeneratedSongData {
  structure: SongStructure;
  metadata: {
    title: string;
    artist: string;
    genre: string;
    bpm: number;
    key: string;
    duration: string;
    format: string;
  };
  chordProgression: string;
  lyrics?: {
    mainMelody: Array<{
      note: string;
      start: number;
      duration: number;
      lyric: string;
      section: string;
    }>;
    harmonies: Array<{
      note: string;
      start: number;
      duration: number;
      type: string;
    }>;
    adLibs: Array<{
      note: string;
      start: number;
      duration: number;
      lyric: string;
      type: string;
    }>;
  };
  productionNotes: {
    mixing: string;
    mastering: string;
    effects: string;
    genre: string;
    style: string;
    professionalGrade: boolean;
  };
  audioFeatures: {
    realtimePlayback: boolean;
    professionalMixing: boolean;
    spatialAudio: boolean;
    vocalTuning: boolean;
    instrumentLayers: number;
  };
}

/**
 * Generate complete song structure data using AI instead of audio files
 * This provides comprehensive music planning and arrangement data
 */
export class AIStructureGenerator {
  
  /**
   * Generate a complete song structure from a prompt
   */
  async generateSongStructure(prompt: string, genre: string = 'Electronic', bpm: number = 120): Promise<GeneratedSongData> {
    if (!gemini) {
      throw new Error("Gemini API key not configured");
    }

    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const structurePrompt = `Create a complete professional song structure for: "${prompt}"

Genre: ${genre}
BPM: ${bpm}

Generate a comprehensive song arrangement with the following JSON structure:

{
  "structure": {
    "intro": {
      "duration": 16,
      "measures": 4,
      "instruments": ["piano", "strings"],
      "dynamics": "soft",
      "tempo": ${bpm},
      "key": "C Major",
      "description": "Opening section description"
    },
    "verse1": {
      "duration": 32,
      "measures": 8,
      "instruments": ["piano", "guitar", "bass", "drums"],
      "vocals": true,
      "dynamics": "moderate",
      "description": "First verse with main narrative"
    },
    "chorus": {
      "duration": 24,
      "measures": 6,
      "instruments": ["full_band"],
      "vocals": true,
      "dynamics": "powerful",
      "description": "Catchy hook section"
    }
  },
  "metadata": {
    "title": "Generated Song Title",
    "artist": "AI Composer",
    "genre": "${genre}",
    "bpm": ${bpm},
    "key": "C Major",
    "duration": "3:30",
    "format": "WAV"
  },
  "chordProgression": "C - Am - F - G",
  "productionNotes": {
    "mixing": "Professional stereo balance with spatial positioning",
    "mastering": "Commercial loudness standards (-14 LUFS integrated)",
    "effects": "Studio-grade reverb, compression, and EQ",
    "genre": "${genre}",
    "style": "modern",
    "professionalGrade": true
  },
  "audioFeatures": {
    "realtimePlayback": true,
    "professionalMixing": true,
    "spatialAudio": true,
    "vocalTuning": true,
    "instrumentLayers": 5
  }
}

Create a complete, realistic song structure with:
- 5-8 sections (intro, verse, chorus, bridge, outro variations)
- Appropriate instruments for each section in ${genre} style
- Professional dynamics progression (soft → moderate → powerful → climactic)
- Detailed descriptions for each section
- Realistic durations and measure counts
- Chord progression appropriate for the genre
- Professional production notes

Make it sound like a real professional song arrangement that could be produced.`;

    try {
      const result = await model.generateContent(structurePrompt);
      const responseText = result.response.text();
      
      // Try to parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const songData = JSON.parse(jsonMatch[0]);
        
        // Add lyrics if vocals are present
        if (this.hasVocals(songData.structure)) {
          songData.lyrics = await this.generateLyricsStructure(prompt, genre, songData.structure);
        }
        
        return songData;
      }
      
      // Fallback if JSON parsing fails
      return this.generateFallbackStructure(prompt, genre, bpm);
      
    } catch (error) {
      console.error('Error generating song structure:', error);
      return this.generateFallbackStructure(prompt, genre, bpm);
    }
  }

  /**
   * Generate detailed lyrics structure for vocal sections
   */
  private async generateLyricsStructure(prompt: string, genre: string, structure: SongStructure) {
    if (!gemini) {
      return undefined;
    }

    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const lyricsPrompt = `Create detailed lyrics structure for "${prompt}" in ${genre} style.

Return JSON with melody, harmonies, and ad-libs:

{
  "mainMelody": [
    {"note": "C4", "start": 0, "duration": 0.5, "lyric": "opening word", "section": "verse"},
    {"note": "E4", "start": 16, "duration": 1, "lyric": "chorus word", "section": "chorus"}
  ],
  "harmonies": [
    {"note": "G4", "start": 16, "duration": 1, "type": "harmony_3rd"},
    {"note": "C5", "start": 40, "duration": 0.5, "type": "harmony_5th"}
  ],
  "adLibs": [
    {"note": "C5", "start": 8, "duration": 0.25, "lyric": "yeah", "type": "adlib"},
    {"note": "D5", "start": 24, "duration": 0.25, "lyric": "oh", "type": "adlib"}
  ]
}

Create meaningful lyrics that match the song sections and ${genre} style.`;

    try {
      const result = await model.generateContent(lyricsPrompt);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error generating lyrics structure:', error);
    }

    return {
      mainMelody: [
        {note: "C4", start: 0, duration: 0.5, lyric: "verse", section: "verse"},
        {note: "E4", start: 16, duration: 1, lyric: "chorus", section: "chorus"}
      ],
      harmonies: [
        {note: "G4", start: 16, duration: 1, type: "harmony_3rd"}
      ],
      adLibs: [
        {note: "C5", start: 8, duration: 0.25, lyric: "yeah", type: "adlib"}
      ]
    };
  }

  /**
   * Check if the song structure includes vocals
   */
  private hasVocals(structure: SongStructure): boolean {
    return Object.values(structure).some(section => section.vocals === true);
  }

  /**
   * Generate a fallback structure if AI generation fails
   */
  private generateFallbackStructure(prompt: string, genre: string, bpm: number): GeneratedSongData {
    return {
      structure: {
        intro: {
          duration: 16,
          measures: 4,
          instruments: ["piano", "strings"],
          dynamics: "soft",
          tempo: bpm,
          key: "C Major",
          description: `Atmospheric opening for ${prompt}`
        },
        verse1: {
          duration: 32,
          measures: 8,
          instruments: ["piano", "guitar", "bass", "drums"],
          vocals: true,
          dynamics: "moderate",
          description: `Main verse exploring the theme of ${prompt}`
        },
        chorus: {
          duration: 24,
          measures: 6,
          instruments: ["full_band"],
          vocals: true,
          dynamics: "powerful",
          description: `Catchy chorus celebrating ${prompt}`
        },
        verse2: {
          duration: 32,
          measures: 8,
          instruments: ["all"],
          vocals: true,
          dynamics: "moderate",
          description: `Second verse developing ${prompt} further`
        },
        bridge: {
          duration: 16,
          measures: 4,
          instruments: ["reduced"],
          vocals: true,
          dynamics: "intimate",
          description: `Reflective bridge about ${prompt}`
        },
        finalChorus: {
          duration: 32,
          measures: 8,
          instruments: ["full_band"],
          vocals: true,
          dynamics: "climactic",
          description: `Powerful finale celebrating ${prompt}`
        },
        outro: {
          duration: 16,
          measures: 4,
          instruments: ["fade_out"],
          dynamics: "decrescendo",
          description: "Gentle fadeout"
        }
      },
      metadata: {
        title: `${prompt} - AI Generation`,
        artist: "CodedSwitch AI",
        genre: genre,
        bpm: bpm,
        key: "C Major",
        duration: "3:20",
        format: "WAV"
      },
      chordProgression: "C - Am - F - G",
      productionNotes: {
        mixing: "Professional stereo balance with spatial positioning",
        mastering: "Commercial loudness standards (-14 LUFS integrated)",
        effects: "Studio-grade reverb, compression, and EQ",
        genre: genre,
        style: "modern",
        professionalGrade: true
      },
      audioFeatures: {
        realtimePlayback: true,
        professionalMixing: true,
        spatialAudio: true,
        vocalTuning: true,
        instrumentLayers: 5
      }
    };
  }

  /**
   * Generate beat pattern structure (alternative to audio generation)
   */
  async generateBeatStructure(style: string, bpm: number, complexity: number = 5): Promise<any> {
    if (!gemini) {
      throw new Error("Gemini API key not configured");
    }

    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Create a comprehensive beat structure for ${style} at ${bpm} BPM with complexity ${complexity}/10.

Return JSON with pattern data AND arrangement structure:

{
  "pattern": {
    "kick": [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
    "snare": [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
    "hihat": [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true]
  },
  "arrangement": {
    "intro": {"bars": 4, "pattern": "minimal", "description": "Light hi-hats and kick"},
    "verse": {"bars": 8, "pattern": "main", "description": "Full drum pattern for verse"},
    "chorus": {"bars": 8, "pattern": "intense", "description": "Power drums with fills"},
    "breakdown": {"bars": 4, "pattern": "breakdown", "description": "Stripped down section"}
  },
  "metadata": {
    "style": "${style}",
    "bpm": ${bpm},
    "complexity": ${complexity},
    "key": "C Major",
    "duration": "2:30"
  }
}

Create professional drum arrangement with section variations appropriate for ${style}.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error generating beat structure:', error);
    }

    // Fallback beat structure
    return {
      pattern: {
        kick: [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
        snare: [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
        hihat: [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false]
      },
      arrangement: {
        intro: {bars: 4, pattern: "minimal", description: "Simple kick and hi-hat"},
        verse: {bars: 8, pattern: "main", description: "Full beat pattern"},
        chorus: {bars: 8, pattern: "intense", description: "Enhanced with snare fills"}
      },
      metadata: {
        style: style,
        bpm: bpm,
        complexity: complexity,
        key: "C Major",
        duration: "2:30"
      }
    };
  }
}

// Export singleton instance
export const aiStructureGenerator = new AIStructureGenerator();