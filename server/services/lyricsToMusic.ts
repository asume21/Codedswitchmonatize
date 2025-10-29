import axios from 'axios';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.warn("REPLICATE_API_TOKEN is not set. Lyrics-to-music generation will not work.");
}

export async function generateMusicFromLyrics(
  lyrics: string,
  style: string,
  genre: string
): Promise<{ id: string; title: string; audioUrl: string; lyrics: string; style: string; genre: string; note: string; }> {
  // Check token at runtime, not import time
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set.");
  }

  // Use MusicGen instead of Riffusion for better quality
  const prompt = `${genre} ${style} music inspired by: ${lyrics.substring(0, 200)}`;

  console.log(`🎵 Generating music from lyrics with MusicGen: "${prompt}"`);

  try {
    const response = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: '671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb', // MusicGen stereo-melody-large
        input: {
          prompt: prompt,
          duration: 30,
          model_version: 'stereo-melody-large',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`,
        },
      }
    );

    let prediction = response.data;
    let attempts = 0;
    const maxAttempts = 60;

    while ((prediction.status === 'starting' || prediction.status === 'processing') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await axios.get(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            'Authorization': `Token ${token}`,
          },
        }
      );
      prediction = statusResponse.data;
      attempts++;
    }

    if (prediction.status === 'failed') {
      throw new Error('Music generation failed');
    }

    if (prediction.status !== 'succeeded') {
      throw new Error('Music generation timeout');
    }

    // Handle both array and string output formats
    const audioUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

    return {
      id: `music-${Date.now()}`,
      title: "AI Generated Song",
      audioUrl: audioUrl,
      lyrics,
      style,
      genre,
      note: "Generated with Replicate API"
    };
  } catch (error: any) {
    console.error("Error generating music from lyrics:", error.response?.data || error.message);
    throw new Error("Failed to generate music from lyrics.");
  }
}
