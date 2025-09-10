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
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Beat generation failed: ${response.statusText}`);
    }

    return response.json();
  }
};