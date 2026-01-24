import crypto from "crypto";

export interface PromptLogContext {
  feature: string;
  style?: string;
  provider?: string;
}

export function hashPrompt(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

export function logPromptStart(prompt: string, context: PromptLogContext) {
  const hash = hashPrompt(prompt);
  console.log("════════ PROMPT START ════════");
  console.log(`🎯 Feature: ${context.feature}`);
  if (context.style) console.log(`🎵 Style: ${context.style}`);
  console.log(`🧾 Prompt Hash: ${hash}`);
  console.log("═══════════════════════════════");
  return hash;
}

export function logPromptResult(hash: string, context: PromptLogContext & { durationMs: number; provider: string; warnings?: string[] }) {
  console.log("════════ PROMPT RESULT ════════");
  console.log(`🧾 Prompt Hash: ${hash}`);
  console.log(`⚙️ Provider: ${context.provider}`);
  console.log(`⏱️ Duration: ${context.durationMs}ms`);
  if (context.style) console.log(`🎵 Style: ${context.style}`);
  if (context.warnings?.length) {
    context.warnings.forEach(w => console.warn(`⚠️ ${w}`));
  }
  console.log("═══════════════════════════════");
}
