import fs from 'fs';
import path from 'path';

/**
 * Local Sample Library Service
 * Manages and serves local audio samples for CodedSwitch
 */

export interface Sample {
  id: string;
  filename: string;
  type: 'kick' | 'snare' | 'hihat' | 'loop' | 'percussion' | 'other';
  variant: string;
  bpm?: number;
  path: string;
  url: string;
}

export interface SamplePack {
  id: string;
  name: string;
  description: string;
  samples: Sample[];
  bpm?: number;
  genre?: string;
}

class LocalSampleLibrary {
  private samplesDir: string;
  private indexPath: string;
  private samples: Sample[] = [];
  private initialized = false;

  constructor() {
    this.samplesDir = path.join(process.cwd(), 'audio', 'samples');
    this.indexPath = path.join(this.samplesDir, 'index.json');
  }

  /**
   * Initialize the library by loading the sample index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(this.samplesDir)) {
        fs.mkdirSync(this.samplesDir, { recursive: true });
        console.log('📁 Created samples directory:', this.samplesDir);
      }

      // Load index if it exists
      if (fs.existsSync(this.indexPath)) {
        const indexData = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
        this.samples = indexData.samples.map((s: any) => ({
          id: `sample_${s.type}_${s.variant}`,
          filename: s.filename,
          type: s.type,
          variant: s.variant,
          bpm: s.bpm,
          path: path.join(process.cwd(), s.path),
          url: `/api/samples/${s.filename}`
        }));
        console.log(`✅ Loaded ${this.samples.length} samples from index`);
      } else {
        console.log('⚠️ No sample index found. Run importSamples script to populate library.');
      }

      this.initialized = true;
    } catch (err) {
      console.error('❌ Failed to initialize sample library:', err);
    }
  }

  /**
   * Get all samples
   */
  async getAllSamples(): Promise<Sample[]> {
    if (!this.initialized) await this.initialize();
    return this.samples;
  }

  /**
   * Get samples by type
   */
  async getSamplesByType(type: Sample['type']): Promise<Sample[]> {
    if (!this.initialized) await this.initialize();
    return this.samples.filter(s => s.type === type);
  }

  /**
   * Get a specific sample by ID
   */
  async getSampleById(id: string): Promise<Sample | null> {
    if (!this.initialized) await this.initialize();
    return this.samples.find(s => s.id === id) || null;
  }

  /**
   * Get sample file path
   */
  getSamplePath(filename: string): string {
    return path.join(this.samplesDir, filename);
  }

  /**
   * Check if sample file exists
   */
  sampleExists(filename: string): boolean {
    return fs.existsSync(this.getSamplePath(filename));
  }

  /**
   * Generate a sample pack from local samples
   */
  async generatePack(options: {
    genre?: string;
    bpm?: number;
    includeLoops?: boolean;
    sampleCount?: number;
  }): Promise<SamplePack> {
    if (!this.initialized) await this.initialize();

    const { genre = 'Electronic', bpm = 120, includeLoops = true, sampleCount = 8 } = options;

    // Get available samples
    const kicks = await this.getSamplesByType('kick');
    const snares = await this.getSamplesByType('snare');
    const hihats = await this.getSamplesByType('hihat');
    const loops = includeLoops ? await this.getSamplesByType('loop') : [];
    const percussion = await this.getSamplesByType('percussion');

    // Randomly select samples
    const selectedSamples: Sample[] = [];
    
    // Always include at least one of each core type
    if (kicks.length > 0) selectedSamples.push(kicks[Math.floor(Math.random() * kicks.length)]);
    if (snares.length > 0) selectedSamples.push(snares[Math.floor(Math.random() * snares.length)]);
    if (hihats.length > 0) selectedSamples.push(hihats[Math.floor(Math.random() * hihats.length)]);

    // Fill remaining slots
    const remaining = sampleCount - selectedSamples.length;
    const allAvailable = [...kicks, ...snares, ...hihats, ...loops, ...percussion]
      .filter(s => !selectedSamples.includes(s));

    for (let i = 0; i < remaining && allAvailable.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * allAvailable.length);
      selectedSamples.push(allAvailable[randomIndex]);
      allAvailable.splice(randomIndex, 1);
    }

    return {
      id: `pack_${Date.now()}`,
      name: `${genre} Pack`,
      description: `Local sample pack with ${selectedSamples.length} samples at ${bpm} BPM`,
      samples: selectedSamples,
      bpm,
      genre
    };
  }

  /**
   * Get library statistics
   */
  async getStats() {
    if (!this.initialized) await this.initialize();

    const stats = {
      total: this.samples.length,
      byType: {
        kick: 0,
        snare: 0,
        hihat: 0,
        loop: 0,
        percussion: 0,
        other: 0
      },
      withBpm: 0,
      averageBpm: 0
    };

    let bpmSum = 0;
    let bpmCount = 0;

    for (const sample of this.samples) {
      stats.byType[sample.type]++;
      if (sample.bpm) {
        stats.withBpm++;
        bpmSum += sample.bpm;
        bpmCount++;
      }
    }

    stats.averageBpm = bpmCount > 0 ? Math.round(bpmSum / bpmCount) : 0;

    return stats;
  }

  /**
   * Search samples by query
   */
  async searchSamples(query: string): Promise<Sample[]> {
    if (!this.initialized) await this.initialize();
    
    const lowerQuery = query.toLowerCase();
    return this.samples.filter(s => 
      s.variant.toLowerCase().includes(lowerQuery) ||
      s.type.toLowerCase().includes(lowerQuery) ||
      s.filename.toLowerCase().includes(lowerQuery)
    );
  }
}

export const localSampleLibrary = new LocalSampleLibrary();
