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
  // Return mock data for dev - Replicate API requires credits
  console.log(`[Lyrics to Music Mock] Generating ${style} ${genre} music for lyrics`);
  return {
    id: `mock-${Date.now()}`,
    title: `${style} ${genre} Track`,
    audioUrl: 'https://example.com/mock-audio.mp3',
    lyrics,
    style,
    genre,
    note: 'Mock audio generated (Replicate API integration pending)'
  };
  
  /* Real implementation - uncomment when ready
  if (!REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not set.");
  }
  */

  const prompt = `${lyrics}\n\nStyle: ${style}\nGenre: ${genre}`;

  try {
    const response = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: 'riffusion/riffusion:8cf61ea6c56afd61d8f5b9ffd14d7c216c0a93844ce2d82ac1c9ecc9c7f24e05',
        input: {
          prompt_a: prompt,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        },
      }
    );

    let prediction = response.data;
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await axios.get(prediction.urls.get, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        },
      });
      prediction = statusResponse.data;
    }

    if (prediction.status === 'failed') {
      throw new Error('Music generation failed');
    }

    return {
      id: `music-${Date.now()}`,
      title: "AI Generated Song",
      audioUrl: prediction.output.audio,
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
