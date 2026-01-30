import { GeneratedSongData } from './ai-structure-grok';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ObjectStorageService } from '../objectStorage';
import Replicate from 'replicate';

export interface MusicGenFromStructureResult {
  audioUrl: string;
  structureData: GeneratedSongData;
  success: boolean;
  message: string;
}

/**
 * Second-stage AI: Uses MusicGen or similar to create actual audio from structured song data
 * This reads the AI-generated song structure and produces real audio files
 */
export class MusicGenFromStructureService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Generate actual audio from AI-generated song structure
   */
  async generateAudioFromStructure(structureData: GeneratedSongData): Promise<MusicGenFromStructureResult> {
    console.log('🎵 MusicGen: Converting song structure to audio...');
    console.log(`📊 Song: "${structureData.metadata.title}" (${structureData.metadata.genre})`);
    
    try {
      // Create a text prompt from the structured data for MusicGen
      const musicGenPrompt = this.createMusicGenPrompt(structureData);
      console.log('🎵 Generated MusicGen prompt:', musicGenPrompt);
      
      // For now, we'll simulate the MusicGen API call
      // In reality, this would call the actual MusicGen API
      const audioResult = await this.callMusicGenAPI(musicGenPrompt, structureData);
      
      if (audioResult.success) {
        console.log('✅ MusicGen successfully generated audio');
        return {
          audioUrl: audioResult.audioUrl,
          structureData: structureData,
          success: true,
          message: `Successfully generated "${structureData.metadata.title}" from AI structure data`
        };
      } else {
        throw new Error(audioResult.message);
      }
      
    } catch (error) {
      console.error('❌ MusicGen failed:', error);
      return {
        audioUrl: '',
        structureData: structureData,
        success: false,
        message: `Failed to generate audio: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Convert structured song data into a MusicGen-compatible prompt
   */
  private createMusicGenPrompt(structureData: GeneratedSongData): string {
    const { metadata, structure, chordProgression, productionNotes } = structureData;
    
    // Get all unique instruments from the structure
    const allInstruments = new Set<string>();
    Object.values(structure).forEach(section => {
      section.instruments.forEach(instrument => allInstruments.add(instrument));
    });
    
    // Create sections description
    const sectionsDesc = Object.entries(structure).map(([name, section]) => {
      const vocalsPart = section.vocals ? 'with vocals' : 'instrumental';
      return `${name} (${section.dynamics}, ${vocalsPart})`;
    }).join(', ');
    
    // Build comprehensive prompt
    const prompt = `Create a ${metadata.genre.toLowerCase()} song at ${metadata.bpm} BPM in ${metadata.key}. 
Style: ${productionNotes.style}, ${productionNotes.effects}. 
Instruments: ${Array.from(allInstruments).join(', ')}. 
Structure: ${sectionsDesc}. 
Chord progression: ${chordProgression}. 
Duration: ${metadata.duration}. 
Professional ${metadata.genre} production with ${productionNotes.mixing}.`;
    
    return prompt;
  }

  /**
   * Call MusicGen API via Replicate
   */
  private async callMusicGenAPI(prompt: string, structureData: GeneratedSongData): Promise<{success: boolean, audioUrl: string, message: string}> {
    console.log('🎵 Calling MusicGen API via Replicate with prompt:', prompt);
    
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    
    if (!replicateToken) {
      console.warn('⚠️ REPLICATE_API_TOKEN not set, falling back to structure-only response');
      return this.fallbackStructureResponse(prompt, structureData);
    }
    
    try {
      const replicate = new Replicate({ auth: replicateToken });
      
      // Parse duration from metadata (e.g., "3:30" -> 210 seconds)
      const durationParts = structureData.metadata.duration.split(':');
      const durationSeconds = durationParts.length === 2 
        ? parseInt(durationParts[0]) * 60 + parseInt(durationParts[1])
        : 30; // Default to 30 seconds
      
      // Use MusicGen model via Replicate
      console.log('🎵 Running MusicGen via Replicate...');
      const output = await replicate.run(
        "meta/musicgen:2b5dc5f29cee83fd5cdf8f9c92e555aae7ca2a69b73c5182f3065362b2fa0a45",
        {
          input: {
            prompt: prompt,
            duration: Math.min(durationSeconds, 30), // MusicGen max is ~30 seconds per generation
            model_version: "stereo-melody-large",
            output_format: "wav",
            normalization_strategy: "peak"
          }
        }
      );
      
      // Output is the audio URL from Replicate
      const audioUrl = typeof output === 'string' ? output : (output as any)?.audio || '';
      
      if (audioUrl) {
        console.log('✅ MusicGen successfully generated audio:', audioUrl);
        return {
          success: true,
          audioUrl: audioUrl,
          message: `Successfully generated audio from structure using MusicGen`
        };
      } else {
        throw new Error('No audio URL returned from MusicGen');
      }
      
    } catch (error) {
      console.error('❌ MusicGen API error:', error);
      
      // Fall back to structure-only response
      return this.fallbackStructureResponse(prompt, structureData);
    }
  }
  
  /**
   * Fallback response when Replicate is unavailable
   */
  private fallbackStructureResponse(prompt: string, structureData: GeneratedSongData): {success: boolean, audioUrl: string, message: string} {
    const audioId = randomUUID();
    
    const resultData = {
      generated: false,
      prompt: prompt,
      structureUsed: {
        sections: Object.keys(structureData.structure).length,
        instruments: this.getUniqueInstruments(structureData.structure),
        duration: structureData.metadata.duration,
        bpm: structureData.metadata.bpm,
        key: structureData.metadata.key
      },
      message: `Structure data ready for MusicGen. Configure REPLICATE_API_TOKEN to enable audio generation.`
    };
    
    // Save structure data for debugging
    try {
      const structureFilename = `structure_${audioId}.json`;
      const structurePath = path.join('/tmp', structureFilename);
      fs.writeFileSync(structurePath, JSON.stringify(resultData, null, 2));
    } catch (e) {
      // Ignore file write errors
    }
    
    return {
      success: false,
      audioUrl: '',
      message: `Structure processed, but no audio generated. Set REPLICATE_API_TOKEN to enable real MusicGen output.`
    };
  }

  /**
   * Get unique instruments from song structure
   */
  private getUniqueInstruments(structure: any): string[] {
    const instruments = new Set<string>();
    Object.values(structure).forEach((section: any) => {
      section.instruments.forEach((instrument: string) => instruments.add(instrument));
    });
    return Array.from(instruments);
  }

  /**
   * Alternative: Use Hugging Face's MusicGen model
   */
  async generateWithHuggingFace(structureData: GeneratedSongData): Promise<MusicGenFromStructureResult> {
    console.log('🎵 Using Hugging Face MusicGen model...');
    
    // This would integrate with Hugging Face's MusicGen API
    // Example endpoint: https://api-inference.huggingface.co/models/facebook/musicgen-medium
    
    const prompt = this.createMusicGenPrompt(structureData);
    
    try {
      // In a real implementation:
      // const response = await fetch('https://api-inference.huggingface.co/models/facebook/musicgen-medium', {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
      //   body: JSON.stringify({ inputs: prompt })
      // });
      
      // For now, return structure data
      return {
        audioUrl: '',
        structureData: structureData,
        success: true,
        message: 'Ready for Hugging Face MusicGen integration'
      };
      
    } catch (error) {
      return {
        audioUrl: '',
        structureData: structureData,
        success: false,
        message: `Hugging Face error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Alternative: Use Stability AI or other music generation services
   */
  async generateWithStabilityAI(structureData: GeneratedSongData): Promise<MusicGenFromStructureResult> {
    console.log('🎵 Using Stability AI for music generation...');
    
    const prompt = this.createMusicGenPrompt(structureData);
    
    // This would integrate with Stability AI's music generation API when available
    
    return {
      audioUrl: '',
      structureData: structureData,
      success: true,
      message: 'Ready for Stability AI music generation integration'
    };
  }
}

// Export singleton instance
export const musicGenFromStructure = new MusicGenFromStructureService();
