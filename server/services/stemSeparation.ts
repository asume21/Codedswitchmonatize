/**
 * Stem Separation Service
 * Separates audio into vocals, drums, bass, and other stems
 * Uses Replicate's Demucs model with base64 file upload (no URL required)
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STEMS_STORAGE_DIR = path.resolve(process.cwd(), 'objects', 'stems');

function ensureStemsDir() {
  if (!fs.existsSync(STEMS_STORAGE_DIR)) {
    fs.mkdirSync(STEMS_STORAGE_DIR, { recursive: true });
  }
}

export interface StemSeparationResult {
  success: boolean;
  vocals?: string;
  instrumental?: string;
  drums?: string;
  bass?: string;
  other?: string;
  error?: string;
  jobId?: string;
}

export interface StemJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: StemSeparationResult;
  error?: string;
  createdAt: Date;
}

// In-memory job tracking
const stemJobs = new Map<string, StemJob>();

export class StemSeparationService {
  private apiToken: string;
  private apiUrl = 'https://api.replicate.com/v1';

  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn('⚠️ REPLICATE_API_TOKEN not set - Stem separation will use fallback');
    }
  }

  /**
   * Convert a local file to base64 data URI
   */
  private fileToDataUri(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.aac': 'audio/aac',
    };
    
    const mimeType = mimeTypes[ext] || 'audio/mpeg';
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Download a stem file from URL and save locally
   */
  private async downloadStem(url: string, stemName: string, jobId: string): Promise<string> {
    ensureStemsDir();
    
    console.log(`   ⬇️ Downloading ${stemName} from: ${url.substring(0, 80)}...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`   ❌ Download failed for ${stemName}: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to download ${stemName}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length === 0) {
      console.error(`   ❌ Downloaded empty file for ${stemName}`);
      throw new Error(`Downloaded empty file for ${stemName}`);
    }
    
    // Detect file extension from URL or default to mp3 (Replicate returns mp3)
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath) || '.mp3';
    const filename = `${jobId}-${stemName}${ext}`;
    const localPath = path.join(STEMS_STORAGE_DIR, filename);
    
    fs.writeFileSync(localPath, buffer);
    console.log(`   ✅ Downloaded ${stemName}: ${localPath} (${Math.round(buffer.length / 1024)}KB)`);
    
    return `/api/stems/${filename}`;
  }

  /**
   * Separate stems from a LOCAL FILE PATH (not URL)
   * This is the main method - accepts file path, handles everything internally
   */
  async separateFromFile(
    filePath: string,
    options: {
      model?: 'htdemucs' | 'htdemucs_ft' | 'htdemucs_6s';
      twoStems?: boolean; // If true, only vocals + instrumental
    } = {}
  ): Promise<StemSeparationResult> {
    const { model = 'htdemucs', twoStems = false } = options;
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }

    // Check file size (Replicate has limits)
    const stats = fs.statSync(filePath);
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (stats.size > maxSize) {
      return {
        success: false,
        error: `File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum is 100MB.`
      };
    }

    if (!this.apiToken) {
      return {
        success: false,
        error: 'REPLICATE_API_TOKEN not configured. Please add your Replicate API token.'
      };
    }

    const jobId = crypto.randomUUID();
    console.log(`🎵 Starting stem separation job ${jobId}`);
    console.log(`   File: ${filePath}`);
    console.log(`   Model: ${model}`);
    console.log(`   Mode: ${twoStems ? '2-stem (vocals/instrumental)' : '4-stem (vocals/drums/bass/other)'}`);

    try {
      // Convert file to base64 data URI
      console.log('📦 Converting file to base64...');
      const dataUri = this.fileToDataUri(filePath);
      console.log(`   Data URI size: ${Math.round(dataUri.length / 1024)}KB`);

      // Use Demucs model on Replicate (cjwbw/demucs)
      // Correct API format: POST /v1/predictions with version in body
      console.log('🚀 Sending to Replicate...');
      
      // Latest working version of cjwbw/demucs (verified working)
      const DEMUCS_VERSION = '25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953';
      
      const predictionResponse = await fetch(`${this.apiUrl}/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: DEMUCS_VERSION,
          input: {
            audio: dataUri,
            model_name: model, // API uses model_name not model
            stem: twoStems ? 'vocals' : undefined, // Only set if 2-stem mode
            clip_mode: 'rescale',
            shifts: 1,
            output_format: 'mp3',
            mp3_bitrate: 320,
          },
        }),
      });

      if (!predictionResponse.ok) {
        const errorText = await predictionResponse.text();
        console.error('❌ Replicate API error:', errorText);
        return {
          success: false,
          error: `Replicate API error: ${predictionResponse.status} - ${errorText}`
        };
      }

      const prediction = await predictionResponse.json() as any;
      const predictionId = prediction.id;
      console.log(`⏳ Prediction started: ${predictionId}`);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 300; // 10 minutes max (2s intervals)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;

        const statusResponse = await fetch(`${this.apiUrl}/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          },
        });

        if (!statusResponse.ok) {
          console.error('Failed to check prediction status');
          continue;
        }

        const status = await statusResponse.json() as any;
        
        if (status.status === 'succeeded') {
          console.log('✅ Stem separation completed!');
          
          // Download and save stems locally
          const result: StemSeparationResult = {
            success: true,
            jobId,
          };

          // Handle different output formats based on model
          if (status.output) {
            if (typeof status.output === 'string') {
              // Single output (2-stem mode returns just vocals)
              result.vocals = await this.downloadStem(status.output, 'vocals', jobId);
            } else if (status.output.vocals) {
              // Object with named stems
              if (status.output.vocals) {
                result.vocals = await this.downloadStem(status.output.vocals, 'vocals', jobId);
              }
              if (status.output.drums) {
                result.drums = await this.downloadStem(status.output.drums, 'drums', jobId);
              }
              if (status.output.bass) {
                result.bass = await this.downloadStem(status.output.bass, 'bass', jobId);
              }
              if (status.output.other) {
                result.other = await this.downloadStem(status.output.other, 'other', jobId);
              }
              if (status.output.no_vocals || status.output.instrumental) {
                result.instrumental = await this.downloadStem(
                  status.output.no_vocals || status.output.instrumental, 
                  'instrumental', 
                  jobId
                );
              }
            }
          }

          console.log('📁 Stems saved locally:', result);
          return result;
          
        } else if (status.status === 'failed') {
          console.error('❌ Stem separation failed:', status.error);
          return {
            success: false,
            error: status.error || 'Separation failed'
          };
        } else if (status.status === 'canceled') {
          return {
            success: false,
            error: 'Separation was canceled'
          };
        }

        // Log progress
        if (attempts % 15 === 0) {
          console.log(`   Still processing... (${Math.round(attempts * 2 / 60)} min elapsed)`);
        }
      }

      return {
        success: false,
        error: 'Separation timeout - took longer than 10 minutes'
      };

    } catch (error) {
      console.error('❌ Stem separation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Legacy method - accepts URL (for backward compatibility)
   * Converts URL to local file first if it's a local API URL
   */
  async separateStems(
    audioInput: string,
    stemCount: 2 | 4 = 2
  ): Promise<StemSeparationResult> {
    // Check if it's a local file path
    if (audioInput.startsWith('/') && !audioInput.startsWith('/api/')) {
      return this.separateFromFile(audioInput, { twoStems: stemCount === 2 });
    }

    // Check if it's a local API URL - convert to file path
    if (audioInput.startsWith('/api/internal/uploads/')) {
      const objectKey = decodeURIComponent(audioInput.replace('/api/internal/uploads/', ''));
      const objectsDir = process.env.LOCAL_OBJECTS_DIR || path.join(process.cwd(), 'objects');
      const filePath = path.join(objectsDir, objectKey);
      
      console.log(`🔄 Converting local URL to file path: ${audioInput} → ${filePath}`);
      return this.separateFromFile(filePath, { twoStems: stemCount === 2 });
    }

    // External URL - we need to download it first
    console.log('⬇️ Downloading external audio file...');
    try {
      const response = await fetch(audioInput);
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to download audio: ${response.statusText}`
        };
      }

      // Save to temp file
      ensureStemsDir();
      const tempFile = path.join(STEMS_STORAGE_DIR, `temp-${crypto.randomUUID()}.mp3`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(tempFile, buffer);

      // Process the temp file
      const result = await this.separateFromFile(tempFile, { twoStems: stemCount === 2 });

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        console.warn('Could not delete temp file:', e);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download audio'
      };
    }
  }

  /**
   * Get job status
   */
  getJob(jobId: string): StemJob | undefined {
    return stemJobs.get(jobId);
  }

  isConfigured(): boolean {
    return !!this.apiToken;
  }
}

export const stemSeparationService = new StemSeparationService();
