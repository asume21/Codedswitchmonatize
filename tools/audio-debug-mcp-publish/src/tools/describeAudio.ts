import { z } from 'zod';
import { waitForCapture } from '../client.js';

export const describeAudioSchema = {
  capture_id: z.string().describe('The capture ID returned by capture_audio to describe'),
};

const API_BASE = process.env.MCP_API_URL || 'https://www.codedswitch.com';
const API_KEY = process.env.CODEDSWITCH_API_KEY || 'dev-key-123';

export async function describeAudioHandler(args: { capture_id: string }) {
  let buffer: Buffer;
  try {
    buffer = await waitForCapture(args.capture_id, 2000);
  } catch {
    return {
      content: [{
        type: 'text' as const,
        text: `Capture "${args.capture_id}" not found. Run capture_audio first.`,
      }],
    };
  }

  try {
    const formData = new FormData();
    formData.append('audio', new Blob([new Uint8Array(buffer)], { type: 'audio/webm' }), 'capture.webm');

    const res = await fetch(`${API_BASE}/api/mcp/describe`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned ${res.status}: ${errText}`);
    }

    const { description } = await res.json() as any;

    return {
      content: [{ type: 'text' as const, text: description }],
    };
  } catch (err: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `AI description failed: ${err.message}. Ensure your CODEDSWITCH_API_KEY is valid.`,
      }],
    };
  }
}
