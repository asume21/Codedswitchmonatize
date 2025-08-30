export const beatAPI = {
  async generate(params: {
    genre: string;
    bpm: number;
    duration: number;
    aiProvider: string;
  }) {
    const response = await fetch("/api/beats/generate", {
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
  },

  async save(params: { name: string; pattern: any; bpm: number }) {
    const response = await fetch("/api/beats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Beat save failed: ${response.statusText}`);
    }

    return response.json();
  },

  async list() {
    const response = await fetch("/api/beats");

    if (!response.ok) {
      throw new Error(`Failed to fetch beats: ${response.statusText}`);
    }

    return response.json();
  },
};
