/**
 * Profit Calculator - Track actual vs projected API costs
 * Helps monitor if credit pricing is profitable
 */

import { CREDIT_COSTS } from '../services/credits';

// Actual API costs (update these based on real usage)
export const API_COSTS = {
  // Suno (from Replicate)
  SONG_GENERATION: 0.40,
  SONG_EXTENSION: 0.25,
  CUSTOM_VOCALS: 0.35,
  STEM_SEPARATION: 0.30,
  
  // MusicGen (from Replicate)
  BEAT_GENERATION: 0.075,
  MELODY_GENERATION: 0.075,
  INSTRUMENTAL_GENERATION: 0.125,
  GENRE_BLENDING: 0.15,
  DRUM_GENERATION: 0.04,
  
  // Grok/OpenAI
  LYRICS_GENERATION: 0.055,
  LYRICS_ANALYSIS: 0.035,
  RHYME_SUGGESTIONS: 0.015,
  SONG_ANALYSIS: 0.035,
  CODE_TRANSLATION: 0.035,
  
  // Audio Processing (estimated)
  AI_MIXING: 0.10,
  AUDIO_MASTERING: 0.125,
  TRANSCRIPTION: 0.08,
  AI_ENHANCEMENT: 0.09,
} as const;

// Credit value tiers (based on packages)
export const CREDIT_VALUE = {
  STARTER: 0.0499,   // $4.99 / 100 credits
  POPULAR: 0.0400,   // $19.99 / 500 credits (20% discount)
  PRO: 0.0350,       // $34.99 / 1000 credits (30% discount)
  ENTERPRISE: 0.0300, // $149.99 / 5000 credits (40% discount)
  AVERAGE: 0.0400,   // Average across all tiers
} as const;

/**
 * Calculate profit for a single operation
 */
export function calculateOperationProfit(
  operation: keyof typeof CREDIT_COSTS,
  creditTier: keyof typeof CREDIT_VALUE = 'AVERAGE'
): {
  operation: string;
  creditsRequired: number;
  apiCost: number;
  userPays: number;
  profit: number;
  profitMargin: number;
} {
  const creditsRequired = CREDIT_COSTS[operation];
  const apiCost = API_COSTS[operation];
  const creditValue = CREDIT_VALUE[creditTier];
  const userPays = creditsRequired * creditValue;
  const profit = userPays - apiCost;
  const profitMargin = (profit / apiCost) * 100;

  return {
    operation,
    creditsRequired,
    apiCost,
    userPays,
    profit,
    profitMargin,
  };
}

/**
 * Calculate profit for mixed usage scenario
 */
export function calculateMixedUsageProfit(usage: Record<keyof typeof CREDIT_COSTS, number>): {
  totalCredits: number;
  totalApiCost: number;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
  breakdown: Array<ReturnType<typeof calculateOperationProfit> & { count: number }>;
} {
  let totalCredits = 0;
  let totalApiCost = 0;
  const breakdown: Array<ReturnType<typeof calculateOperationProfit> & { count: number }> = [];

  for (const [operation, count] of Object.entries(usage)) {
    if (count > 0) {
      const opStats = calculateOperationProfit(operation as keyof typeof CREDIT_COSTS);
      totalCredits += opStats.creditsRequired * count;
      totalApiCost += opStats.apiCost * count;
      breakdown.push({ ...opStats, count });
    }
  }

  const totalRevenue = totalCredits * CREDIT_VALUE.AVERAGE;
  const totalProfit = totalRevenue - totalApiCost;
  const profitMargin = (totalProfit / totalApiCost) * 100;

  return {
    totalCredits,
    totalApiCost,
    totalRevenue,
    totalProfit,
    profitMargin,
    breakdown,
  };
}

/**
 * Calculate break-even point
 */
export function calculateBreakEven(
  operation: keyof typeof CREDIT_COSTS
): {
  operation: string;
  minimumCreditValue: number;
  currentCreditValue: number;
  buffer: number;
} {
  const creditsRequired = CREDIT_COSTS[operation];
  const apiCost = API_COSTS[operation];
  const minimumCreditValue = apiCost / creditsRequired;
  const currentCreditValue = CREDIT_VALUE.AVERAGE;
  const buffer = ((currentCreditValue - minimumCreditValue) / minimumCreditValue) * 100;

  return {
    operation,
    minimumCreditValue,
    currentCreditValue,
    buffer,
  };
}

/**
 * Generate full profit report
 */
export function generateProfitReport(): string {
  let report = '# 💰 Profit Analysis Report\n\n';
  
  report += '## Per-Operation Breakdown\n\n';
  report += '| Operation | Credits | API Cost | User Pays | Profit | Margin |\n';
  report += '|-----------|---------|----------|-----------|--------|--------|\n';
  
  const operations = Object.keys(CREDIT_COSTS) as Array<keyof typeof CREDIT_COSTS>;
  
  for (const operation of operations) {
    const stats = calculateOperationProfit(operation);
    report += `| ${operation} | ${stats.creditsRequired} | $${stats.apiCost.toFixed(3)} | $${stats.userPays.toFixed(3)} | $${stats.profit.toFixed(3)} | ${stats.profitMargin.toFixed(1)}% |\n`;
  }
  
  report += '\n## Break-Even Analysis\n\n';
  report += '| Operation | Min $/credit | Current $/credit | Buffer |\n';
  report += '|-----------|--------------|------------------|--------|\n';
  
  for (const operation of operations) {
    const breakEven = calculateBreakEven(operation);
    report += `| ${operation} | $${breakEven.minimumCreditValue.toFixed(4)} | $${breakEven.currentCreditValue.toFixed(4)} | ${breakEven.buffer.toFixed(1)}% |\n`;
  }
  
  report += '\n## Sample Usage Scenario\n\n';
  const sampleUsage = {
    SONG_GENERATION: 20,
    BEAT_GENERATION: 30,
    LYRICS_GENERATION: 40,
    SONG_ANALYSIS: 50,
  } as Record<keyof typeof CREDIT_COSTS, number>;
  
  const mixedStats = calculateMixedUsageProfit(sampleUsage);
  
  report += `**Total Credits:** ${mixedStats.totalCredits}\n`;
  report += `**Total API Cost:** $${mixedStats.totalApiCost.toFixed(2)}\n`;
  report += `**Total Revenue:** $${mixedStats.totalRevenue.toFixed(2)}\n`;
  report += `**Total Profit:** $${mixedStats.totalProfit.toFixed(2)}\n`;
  report += `**Profit Margin:** ${mixedStats.profitMargin.toFixed(1)}%\n\n`;
  
  report += '✅ **Status:** ' + (mixedStats.profitMargin > 100 ? 'PROFITABLE' : 'NEEDS ADJUSTMENT') + '\n';
  
  return report;
}

/**
 * Log profit analysis to console
 */
export function logProfitAnalysis(): void {
  console.log('\n' + generateProfitReport());
}
