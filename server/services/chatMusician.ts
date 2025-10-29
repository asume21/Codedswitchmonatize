import axios from 'axios';

const HUGGING_FACE_API_TOKEN = process.env.HUGGING_FACE_API_TOKEN;

if (!HUGGING_FACE_API_TOKEN) {
  console.warn("HUGGING_FACE_API_TOKEN is not set. ChatMusician will not work.");
}

export async function generateChatMusicianMelody(
  prompt: string,
  style: string
): Promise<{ id: string; abcNotation: string; description: string; style: string; }> {
  // Return mock data for dev
  console.log(`[ChatMusician Mock] Generating ${style} melody for: ${prompt}`);
  return {
    id: `mock-${Date.now()}`,
    abcNotation: 'X:1\nT:Mock Melody\nM:4/4\nL:1/8\nK:C\nCDEF GABc|',
    description: `${style} melody: ${prompt}`,
    style
  };
  
  /* Real implementation - uncomment when ready
  if (!HUGGING_FACE_API_TOKEN) {
    throw new Error("HUGGING_FACE_API_TOKEN is not set.");
  }
  */

  const fullPrompt = `Style: ${style}\nPrompt: ${prompt}`;

  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/sander-wood/text-to-music-abc-notation-v2',
      {
        inputs: fullPrompt,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`,
        },
      }
    );

    const abcNotation = response.data[0].generated_text;

    return {
      id: `melody-${Date.now()}`,
      abcNotation,
      description: prompt,
      style,
    };
  } catch (error: any) {
    console.error("Error generating melody with ChatMusician:", error.response?.data || error.message);
    throw new Error("Failed to generate melody with ChatMusician.");
  }
}
