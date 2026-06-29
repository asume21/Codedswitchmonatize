/**
 * Quick analysis script for WebEar captures
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { analyzePcm } from './server/services/mcpAudioAnalysis';

const captureId = process.argv[2] || 'ed474b7e-f49e-43e6-8340-ccc0192781cd';
const blobPath = path.join('/tmp', `webear-${captureId}.webm`);
const pcmPath = path.join('/tmp', `webear-${captureId}.pcm`);

async function analyzeCaptureId(id: string): Promise<void> {
  try {
    // Fetch the blob
    console.log(`Fetching capture ${id}...`);
    const blobBuffer = await fetch(`http://localhost:4001/api/webear/blob/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      });
    
    if (blobBuffer.byteLength === 0) {
      throw new Error('Capture blob is empty');
    }
    
    console.log(`Downloaded ${blobBuffer.byteLength} bytes`);
    
    // Decode WebM to PCM using ffmpeg
    console.log('Decoding WebM to PCM...');
    const pcmBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const ff = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-f', 'f32le',
        '-ac', '1',
        '-ar', '44100',
        'pipe:1'
      ]);
      
      ff.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      ff.on('close', (code) => {
        if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new Error(`ffmpeg exited ${code}`));
      });
      ff.on('error', (e) => reject(e));
      ff.stdin.write(Buffer.from(blobBuffer));
      ff.stdin.end();
    });
    
    const samples = new Float32Array(
      pcmBuffer.buffer,
      pcmBuffer.byteOffset,
      pcmBuffer.byteLength / 4
    );
    
    console.log(`Decoded ${samples.length} samples`);
    
    // Analyze
    const report = analyzePcm(samples, 44100);
    console.log('\n=== AUDIO ANALYSIS ===\n');
    console.log(JSON.stringify(report, null, 2));
    
  } catch (e) {
    console.error('Error:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

analyzeCaptureId(captureId);
