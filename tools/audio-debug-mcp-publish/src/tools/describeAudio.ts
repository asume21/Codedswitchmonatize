import { z } from 'zod';
import { waitForCapture } from '../client.js';

export const describeAudioSchema = {
  capture_id: z.string().describe('The capture ID returned by capture_audio to describe'),
};

const API_BASE = process.env.MCP_API_URL || 'https://www.codedswitch.com';
const API_KEY = process.env.CODEDSWITCH_API_KEY || '';

export async function describeAudioHandler(args: { capture_id: string }) {
  if (!API_KEY) {
    return {
      content: [{
        type: 'text' as const,
        text: 'CODEDSWITCH_API_KEY is not set. Get a free key at https://www.codedswitch.com/developer and add it to your MCP env config.',
      }],
    };
  }

  let buffer: Buffer;
  try {
    buffer = await waitForCapture(args.capture_id, 5000);
  } catch {
    return {
      content: [{
        type: 'text' as const,
        text: `Capture "${args.capture_id}" not found. Run capture_audio first.`,
      }],
    };
  }

  try {
    // Build multipart body manually for reliable Node.js compatibility
    const boundary = `----webear${Date.now()}`;
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="capture.webm"\r\nContent-Type: audio/webm\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([Buffer.from(header), buffer, Buffer.from(footer)]);

    const res = await fetch(`${API_BASE}/api/mcp/describe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
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
