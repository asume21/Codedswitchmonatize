// server/services/localAI.ts
// Local AI service using Ollama for free, fast, private AI generation

interface OllamaRequest {
  model: string;
  prompt: string;
  format?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
  };
}

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export class LocalAIService {
  private baseUrl: string;
  private defaultModel: string;
  private isAvailable: boolean | null = null;

  constructor(baseUrl: string = 'http://localhost:11434', defaultModel: string = 'llama3.1:8b') {
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  /**
   * Check if Ollama is running and available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        this.isAvailable = true;
        console.log('✅ Local AI (Ollama) is available');
        console.log(`📦 Available models: ${data.models?.map((m: any) => m.name).join(', ') || 'none'}`);
        return true;
      }
      
      this.isAvailable = false;
      return false;
    } catch (error) {
      this.isAvailable = false;
      console.log('⚠️ Local AI (Ollama) is not available - will use cloud fallback');
      return false;
    }
  }

  /**
   * Generate completion using local model
   */
  async generate(
    prompt: string,
    options: {
      model?: string;
      format?: 'json';
      temperature?: number;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const model = options.model || this.defaultModel;
    const maxRetries = options.maxRetries || 2;
    
    // Check availability if not already checked
    if (this.isAvailable === null) {
      await this.checkAvailability();
    }
    
    // If not available, throw error to trigger fallback
    if (this.isAvailable === false) {
      throw new Error('Local AI not available');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🖥️ Local AI: Generating with ${model} (attempt ${attempt}/${maxRetries})`);
        
        const requestBody: OllamaRequest = {
          model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.8,
          }
        };

        if (options.format === 'json') {
          requestBody.format = 'json';
        }

        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data: OllamaResponse = await response.json();
        
        if (!data.response) {
          throw new Error('Empty response from Ollama');
        }

        console.log(`✅ Local AI: Generated ${data.response.length} characters`);
        return data.response;

      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Local AI attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All retries failed
    this.isAvailable = false;
    throw new Error(`Local AI failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate with chat format (system + user messages)
   */
  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      model?: string;
      format?: 'json';
      temperature?: number;
    } = {}
  ): Promise<string> {
    // Convert chat messages to single prompt
    const prompt = messages
      .map(msg => {
        if (msg.role === 'system') {
          return `System: ${msg.content}`;
        } else if (msg.role === 'user') {
          return `User: ${msg.content}`;
        } else {
          return `Assistant: ${msg.content}`;
        }
      })
      .join('\n\n') + '\n\nAssistant:';

    return this.generate(prompt, options);
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Failed to list models:', error);
      return [];
    }
  }

  /**
   * Pull/download a model
   */
  async pullModel(modelName: string): Promise<void> {
    console.log(`📦 Downloading model: ${modelName}`);
    
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    console.log(`✅ Model ${modelName} downloaded`);
  }

  /**
   * Get model info
   */
  async getModelInfo(modelName: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName })
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const localAI = new LocalAIService();

// Export helper function for easy integration
export async function makeLocalAICall(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    format?: 'json';
    temperature?: number;
  } = {}
): Promise<{ choices: Array<{ message: { content: string } }> }> {
  const content = await localAI.chat(messages, {
    format: options.format === 'json' ? 'json' : undefined,
    temperature: options.temperature
  });

  // Return in OpenAI-compatible format
  return {
    choices: [
      {
        message: {
          content
        }
      }
    ]
  };
}
