// Client-side OpenAI utilities for CodeTune Studio
// Note: All actual API calls are proxied through our backend for security

export interface CodeTranslationRequest {
  sourceCode: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface BeatGenerationRequest {
  style: string;
  bpm: number;
}

export interface MelodyGenerationRequest {
  scale: string;
  style: string;
  complexity: number;
}

export interface VulnerabilityScanRequest {
  code: string;
  language: string;
}

export interface LyricsGenerationRequest {
  theme: string;
  genre: string;
  mood: string;
}

export interface ChatRequest {
  message: string;
  context?: string;
}

// Language support mappings
export const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript", extension: ".js" },
  { value: "typescript", label: "TypeScript", extension: ".ts" },
  { value: "python", label: "Python", extension: ".py" },
  { value: "java", label: "Java", extension: ".java" },
  { value: "cpp", label: "C++", extension: ".cpp" },
  { value: "csharp", label: "C#", extension: ".cs" },
  { value: "go", label: "Go", extension: ".go" },
  { value: "rust", label: "Rust", extension: ".rs" },
  { value: "php", label: "PHP", extension: ".php" },
  { value: "ruby", label: "Ruby", extension: ".rb" },
] as const;

// Music scales and their note patterns
export const MUSIC_SCALES = {
  "C Major": ["C", "D", "E", "F", "G", "A", "B"],
  "A Minor": ["A", "B", "C", "D", "E", "F", "G"],
  "G Major": ["G", "A", "B", "C", "D", "E", "F#"],
  "E Minor": ["E", "F#", "G", "A", "B", "C", "D"],
  "D Major": ["D", "E", "F#", "G", "A", "B", "C#"],
  "B Minor": ["B", "C#", "D", "E", "F#", "G", "A"],
  "F Major": ["F", "G", "A", "Bb", "C", "D", "E"],
  "D Minor": ["D", "E", "F", "G", "A", "Bb", "C"],
} as const;

// Music genres and their characteristics
export const MUSIC_GENRES = {
  "hip-hop": {
    label: "Hip-Hop",
    defaultBpm: 85,
    characteristics: ["strong kick", "snappy snare", "hi-hat patterns"],
  },
  house: {
    label: "House",
    defaultBpm: 128,
    characteristics: [
      "four-on-the-floor kick",
      "open hi-hats",
      "electronic sounds",
    ],
  },
  trap: {
    label: "Trap",
    defaultBpm: 140,
    characteristics: ["rolling hi-hats", "heavy 808s", "snare on 3"],
  },
  dnb: {
    label: "Drum & Bass",
    defaultBpm: 174,
    characteristics: ["fast breakbeats", "heavy bass", "complex rhythms"],
  },
  techno: {
    label: "Techno",
    defaultBpm: 130,
    characteristics: [
      "repetitive beats",
      "synthesized sounds",
      "driving rhythm",
    ],
  },
  ambient: {
    label: "Ambient",
    defaultBpm: 70,
    characteristics: ["atmospheric sounds", "slow tempo", "ethereal textures"],
  },
} as const;

// Vulnerability severity levels
export const VULNERABILITY_LEVELS = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bgColor: "bg-red-600",
    icon: "fas fa-skull",
    description: "Immediate security threat requiring urgent attention",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bgColor: "bg-orange-500",
    icon: "fas fa-exclamation-triangle",
    description: "Serious security issue that should be addressed soon",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500",
    icon: "fas fa-exclamation",
    description: "Moderate security concern worth addressing",
  },
  low: {
    label: "Low",
    color: "text-green-400",
    bgColor: "bg-green-500",
    icon: "fas fa-info-circle",
    description: "Minor security consideration for best practices",
  },
} as const;

// Common vulnerability types
export const VULNERABILITY_TYPES = [
  "SQL Injection",
  "Cross-Site Scripting (XSS)",
  "Cross-Site Request Forgery (CSRF)",
  "Insecure Direct Object References",
  "Security Misconfiguration",
  "Sensitive Data Exposure",
  "Missing Function Level Access Control",
  "Using Components with Known Vulnerabilities",
  "Unvalidated Redirects and Forwards",
  "Injection Flaws",
] as const;

// Rhyme scheme patterns
export const RHYME_SCHEMES = {
  AABB: {
    label: "AABB (Couplets)",
    pattern: ["A", "A", "B", "B"],
    description: "Consecutive lines rhyme (couplets)",
  },
  ABAB: {
    label: "ABAB (Alternating)",
    pattern: ["A", "B", "A", "B"],
    description: "Alternating rhyme pattern",
  },
  ABCB: {
    label: "ABCB (Ballad)",
    pattern: ["A", "B", "C", "B"],
    description: "Second and fourth lines rhyme",
  },
  ABCC: {
    label: "ABCC",
    pattern: ["A", "B", "C", "C"],
    description: "Last two lines rhyme",
  },
  FREE: {
    label: "Free Verse",
    pattern: [],
    description: "No fixed rhyme scheme",
  },
} as const;

// Utility functions for client-side processing
export class OpenAIUtils {
  static formatCodeForDisplay(code: string, language: string): string {
    // Add syntax highlighting hints or formatting
    return code.trim();
  }

  static validateCodeInput(code: string): boolean {
    return code.trim().length > 0 && code.length < 50000; // Reasonable limits
  }

  static getLanguageFromExtension(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const lang = SUPPORTED_LANGUAGES.find((l) => l.extension === `.${ext}`);
    return lang?.value || "javascript";
  }

  static generateBeatPatternTemplate(style: string): any {
    const templates: { [key: string]: any } = {
      "hip-hop": {
        kick: [
          true,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
        ],
        snare: [
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
        ],
        hihat: [
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          false,
        ],
        openhat: [
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
        ],
      },
      trap: {
        kick: [
          true,
          false,
          false,
          true,
          false,
          false,
          true,
          false,
          false,
          true,
          false,
          false,
          true,
          false,
          false,
          false,
        ],
        snare: [
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
        ],
        hihat: [
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
        ],
        openhat: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          true,
        ],
      },
    };

    return templates[style] || templates["hip-hop"];
  }

  static parseVulnerabilityResponse(response: any): any {
    // Process and validate vulnerability scan response
    if (!response.vulnerabilities) {
      return {
        vulnerabilities: [],
        securityScore: 100,
        summary: "No vulnerabilities detected",
      };
    }

    return {
      vulnerabilities: response.vulnerabilities.map((vuln: any) => ({
        ...vuln,
        severity: vuln.severity || "low",
        line: vuln.line || 1,
      })),
      securityScore: Math.max(0, Math.min(100, response.securityScore || 0)),
      summary: response.summary || "Security scan completed",
    };
  }

  static extractRhymeWords(lyrics: string): string[] {
    // Extract words that could be used for rhyming
    const lines = lyrics.split("\n");
    const rhymeWords: string[] = [];

    lines.forEach((line) => {
      const words = line.trim().split(/\s+/);
      const lastWord = words[words.length - 1]?.replace(/[^\w]/g, "");
      if (lastWord && lastWord.length > 2) {
        rhymeWords.push(lastWord.toLowerCase());
      }
    });

    return Array.from(new Set(rhymeWords)); // Remove duplicates
  }

  static countSyllables(word: string): number {
    // Simple syllable counting algorithm
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    const vowels = "aeiouy";
    let count = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }

    // Handle silent 'e'
    if (word.endsWith("e")) {
      count--;
    }

    return Math.max(1, count);
  }

  static generateMelodyFromCode(code: string): any {
    // Generate a simple melody pattern based on code structure
    const lines = code.split("\n").filter((line) => line.trim());
    const notes: any[] = [];
    const scale = ["C", "D", "E", "F", "G", "A", "B"];

    lines.forEach((line, index) => {
      const noteIndex = line.length % scale.length;
      const octave = 4 + (Math.floor(index / 8) % 2);
      const duration = Math.max(0.25, Math.min(1, line.trim().length / 50));

      notes.push({
        note: scale[noteIndex],
        octave,
        duration,
        start: index * 0.5,
      });
    });

    return { notes };
  }
}

export default OpenAIUtils;
