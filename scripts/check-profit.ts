#!/usr/bin/env tsx
/**
 * Quick Profit Checker
 * Run: npm run check-profit
 * 
 * Analyzes current credit pricing profitability
 */

import { generateProfitReport } from '../server/utils/profitCalculator';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         💰 CodedSwitch Profit Analysis Tool 💰            ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

const report = generateProfitReport();
console.log(report);

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║                    📊 SUMMARY                              ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Check if all operations are profitable
const apiCosts = {
  SONG_GENERATION: 0.40,
  BEAT_GENERATION: 0.075,
  LYRICS_GENERATION: 0.055,
  SONG_ANALYSIS: 0.035,
};

const creditCosts = {
  SONG_GENERATION: 25,
  BEAT_GENERATION: 5,
  LYRICS_GENERATION: 4,
  SONG_ANALYSIS: 2,
};

const avgCreditValue = 0.04;

let allProfitable = true;
let minMargin = Infinity;
let maxMargin = -Infinity;

for (const [operation, apiCost] of Object.entries(apiCosts)) {
  const credits = creditCosts[operation as keyof typeof creditCosts];
  const userPays = credits * avgCreditValue;
  const profit = userPays - apiCost;
  const margin = (profit / apiCost) * 100;
  
  if (margin < 50) allProfitable = false;
  if (margin < minMargin) minMargin = margin;
  if (margin > maxMargin) maxMargin = margin;
}

console.log(`✅ All Operations Profitable: ${allProfitable ? 'YES' : 'NO'}`);
console.log(`📈 Profit Margin Range: ${minMargin.toFixed(1)}% - ${maxMargin.toFixed(1)}%`);
console.log(`🎯 Target Margin: 100-150%`);
console.log(`⚡ Status: ${minMargin >= 100 ? 'EXCELLENT ✅' : minMargin >= 50 ? 'GOOD ⚠️' : 'NEEDS ADJUSTMENT ❌'}\n`);

console.log('💡 Tip: Update API_COSTS in profitCalculator.ts with real usage data');
console.log('📊 Monitor: Check Replicate & XAI dashboards for actual costs\n');
