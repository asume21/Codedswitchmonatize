/**
 * WebEye video description — the "AI sees your tab" half of WebEye.
 *
 * Turns a captured WebM video or frame stream into a plain-English read
 * of what is visible on the screen: layout, colors, animations, contrast, and visual bugs.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const VIDEO_DESCRIBE_PROMPT =
  'Describe this video capture in detail. This is a recording of a web page/canvas. ' +
  'What elements, visualizations, or animations do you see? Describe the UI layout, ' +
  'colors, typography, and contrast. Note any visual bugs, layout overlaps, spacing ' +
  'issues, or poor visual contrast. Keep it highly analytical and constructive.';

const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_AUDIO_MODEL?.trim(),
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-001',
].filter((m): m is string => Boolean(m));

export async function describeVideo(videoBuffer: Buffer, mimeType: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  const base64Data = videoBuffer.toString('base64');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const errors: string[] = [];

  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { text: VIDEO_DESCRIBE_PROMPT },
        { inlineData: { mimeType, data: base64Data } },
      ]);
      return result.response.text();
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      errors.push(`${modelName}: ${msg}`);
      if (!/404|not found|no longer available|not supported/i.test(msg)) throw err;
    }
  }
  throw new Error(`No Gemini model accepted the video request — ${errors.join(' | ')}`);
}

export async function compareVideos(
  videoBufferA: Buffer,
  mimeTypeA: string,
  videoBufferB: Buffer,
  mimeTypeB: string
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  const base64DataA = videoBufferA.toString('base64');
  const base64DataB = videoBufferB.toString('base64');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const errors: string[] = [];

  const prompt = 'Compare these two video captures of the same web page/canvas. ' +
    'What visual changes occurred? Point out differences in layout, animations, element placements, ' +
    'colors, and visibility. Keep it highly detailed and analytical.';

  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: mimeTypeA, data: base64DataA } },
        { inlineData: { mimeType: mimeTypeB, data: base64DataB } },
      ]);
      return result.response.text();
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      errors.push(`${modelName}: ${msg}`);
      if (!/404|not found|no longer available|not supported/i.test(msg)) throw err;
    }
  }
  throw new Error(`No Gemini model accepted the video comparison request — ${errors.join(' | ')}`);
}
