export const beatAPI = {
  async generate(params: {
    genre: string;
    bpm: number;
    duration: number;
    aiProvider: string;
  }) {
    const response = await fetch("/api/beat/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        style: params.genre,
        bpm: params.bpm,
        complexity: 5,
        aiProvider: params.aiProvider
      }),
    });

    if (!response.ok) {
      throw new Error(`Beat generation failed: ${response.statusText}`);
    }

    return response.json();
  }
};