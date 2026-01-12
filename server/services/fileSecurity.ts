import OpenAI from "openai";
import { } from "./grok";
// Use the same environment keys as grok.ts; prefer xAI base if key provided
const xaiApiKey = process.env.XAI_API_KEY?.trim();
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
const openai = xaiApiKey
  ? new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: xaiApiKey })
  : new OpenAI({ apiKey: openaiApiKey });

export interface FileSecurityScan {
  isSecure: boolean;
  securityScore: number;
  threats: FileThreat[];
  recommendations: string[];
  summary: string;
}

export interface FileThreat {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  recommendation: string;
}

// Audio file magic bytes for validation
const AUDIO_MAGIC_BYTES = {
  mp3: [0xFF, 0xFB], // MP3 frame header
  mp3_id3: [0x49, 0x44, 0x33], // ID3v2 header
  wav: [0x52, 0x49, 0x46, 0x46], // "RIFF"
  m4a: [0x66, 0x74, 0x79, 0x70], // "ftyp" (after 4 bytes)
  ogg: [0x4F, 0x67, 0x67, 0x53], // "OggS"
  flac: [0x66, 0x4C, 0x61, 0x43], // "fLaC"
};

// Known malicious patterns in files
const SUSPICIOUS_PATTERNS = [
  { pattern: [0x4D, 0x5A], name: "PE Executable", severity: "critical" as const },
  { pattern: [0x7F, 0x45, 0x4C, 0x46], name: "ELF Executable", severity: "critical" as const },
  { pattern: [0xFE, 0xED, 0xFA, 0xCE], name: "Mach-O Binary", severity: "critical" as const },
  { pattern: [0x50, 0x4B, 0x03, 0x04], name: "ZIP Archive", severity: "medium" as const },
];

export class FileSecurityScanner {
  
  /**
   * Validates audio file using magic bytes
   */
  validateAudioFile(buffer: Buffer, filename: string): FileSecurityScan {
    const threats: FileThreat[] = [];
    const recommendations: string[] = [];
    
    // Check for valid audio magic bytes
    const hasValidAudioHeader = this.hasValidAudioMagicBytes(buffer);
    
    if (!hasValidAudioHeader) {
      threats.push({
        type: "Invalid File Type",
        severity: "critical",
        description: "File does not contain valid audio format headers",
        recommendation: "Reject file - may be malicious executable disguised as audio"
      });
    }

    // Check for suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(buffer);
    threats.push(...suspiciousPatterns);

    // Check file size consistency
    const sizeThreat = this.validateFileSize(buffer, filename);
    if (sizeThreat) threats.push(sizeThreat);

    const securityScore = this.calculateSecurityScore(threats);
    const isSecure = securityScore >= 70 && threats.filter(t => t.severity === "critical").length === 0;

    if (!isSecure) {
      recommendations.push("Block file upload - security threats detected");
      recommendations.push("Log attempt for security monitoring");
    } else if (threats.length > 0) {
      recommendations.push("Allow with monitoring - minor security concerns detected");
    } else {
      recommendations.push("File appears safe for upload");
    }

    return {
      isSecure,
      securityScore,
      threats,
      recommendations,
      summary: this.generateSummary(threats, securityScore)
    };
  }

  /**
   * AI-powered file content analysis (using your existing Grok integration)
   */
  async analyzeFileContentWithAI(filename: string, fileInfo: any): Promise<FileSecurityScan> {
    try {
      const response = await openai.chat.completions.create({
        model: "grok-3",
        messages: [
          {
            role: "system",
            content: `You are CodedSwitch's AI security scanner. Analyze this uploaded file for security threats.
            Return JSON with: isSecure (boolean), securityScore (0-100), threats array (each with type, severity, description, recommendation), 
            recommendations array, summary (string).
            
            Focus on: file type validation, malicious content detection, suspicious metadata, potential security risks.`
          },
          {
            role: "user",
            content: `Analyze uploaded file security:
            Filename: ${filename}
            File Info: ${JSON.stringify(fileInfo, null, 2)}
            
            Check for: disguised executables, malicious metadata, suspicious file properties, security threats.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // Ensure proper structure
      return {
        isSecure: result.isSecure || false,
        securityScore: result.securityScore || 0,
        threats: result.threats || [],
        recommendations: result.recommendations || [],
        summary: result.summary || "AI analysis completed"
      };
    } catch (error) {
      console.error("AI file security scan error:", error);
      // Fallback to conservative security stance
      return {
        isSecure: false,
        securityScore: 20,
        threats: [{
          type: "Analysis Failed",
          severity: "medium",
          description: "Could not complete AI security analysis",
          recommendation: "Manual review recommended"
        }],
        recommendations: ["Review file manually before allowing upload"],
        summary: "AI security analysis failed - manual review needed"
      };
    }
  }

  private hasValidAudioMagicBytes(buffer: Buffer): boolean {
    const first8Bytes = buffer.subarray(0, 8);
    
    // Check for MP3
    if (this.matchesPattern(first8Bytes, AUDIO_MAGIC_BYTES.mp3) ||
        this.matchesPattern(first8Bytes, AUDIO_MAGIC_BYTES.mp3_id3)) {
      return true;
    }
    
    // Check for WAV (RIFF header)
    if (this.matchesPattern(first8Bytes, AUDIO_MAGIC_BYTES.wav)) {
      return true;
    }
    
    // Check for M4A (skip first 4 bytes, then check ftyp)
    if (buffer.length >= 8) {
      const afterSize = buffer.subarray(4, 8);
      if (this.matchesPattern(afterSize, AUDIO_MAGIC_BYTES.m4a)) {
        return true;
      }
    }
    
    // Check for OGG
    if (this.matchesPattern(first8Bytes, AUDIO_MAGIC_BYTES.ogg)) {
      return true;
    }
    
    // Check for FLAC
    if (this.matchesPattern(first8Bytes, AUDIO_MAGIC_BYTES.flac)) {
      return true;
    }
    
    return false;
  }

  private detectSuspiciousPatterns(buffer: Buffer): FileThreat[] {
    const threats: FileThreat[] = [];
    const first8Bytes = buffer.subarray(0, 8);
    
    for (const suspicious of SUSPICIOUS_PATTERNS) {
      if (this.matchesPattern(first8Bytes, suspicious.pattern)) {
        threats.push({
          type: "Malicious File Type",
          severity: suspicious.severity,
          description: `File contains ${suspicious.name} signature - not a valid audio file`,
          recommendation: "Block upload immediately - this is likely a malicious executable"
        });
      }
    }
    
    return threats;
  }

  private validateFileSize(buffer: Buffer, filename: string): FileThreat | null {
    const fileSize = buffer.length;
    
    // Extremely small files (less than 1KB) are suspicious for audio
    if (fileSize < 1024) {
      return {
        type: "Suspicious File Size",
        severity: "medium",
        description: "Audio file is unusually small (less than 1KB)",
        recommendation: "Verify file is legitimate audio content"
      };
    }
    
    // Extremely large files could be DoS attempts
    if (fileSize > 100 * 1024 * 1024) { // 100MB
      return {
        type: "Oversized File",
        severity: "high", 
        description: "File exceeds reasonable audio file size limits",
        recommendation: "Consider rejecting or requiring special approval for large files"
      };
    }
    
    return null;
  }

  private matchesPattern(buffer: Buffer, pattern: number[]): boolean {
    if (buffer.length < pattern.length) return false;
    
    for (let i = 0; i < pattern.length; i++) {
      if (buffer[i] !== pattern[i]) return false;
    }
    
    return true;
  }

  private calculateSecurityScore(threats: FileThreat[]): number {
    let score = 100;
    
    for (const threat of threats) {
      switch (threat.severity) {
        case "critical":
          score -= 50;
          break;
        case "high":
          score -= 25;
          break;
        case "medium":
          score -= 10;
          break;
        case "low":
          score -= 5;
          break;
      }
    }
    
    return Math.max(0, score);
  }

  private generateSummary(threats: FileThreat[], securityScore: number): string {
    if (threats.length === 0) {
      return "File passed all security checks - safe for upload";
    }
    
    const criticalCount = threats.filter(t => t.severity === "critical").length;
    const highCount = threats.filter(t => t.severity === "high").length;
    
    if (criticalCount > 0) {
      return `CRITICAL SECURITY THREAT: ${criticalCount} critical issue(s) detected. Block upload immediately.`;
    }
    
    if (highCount > 0) {
      return `High security risk: ${highCount} high-risk issue(s) detected. Manual review recommended.`;
    }
    
    return `Security scan completed with ${threats.length} minor concern(s). Score: ${securityScore}/100`;
  }
}
