import { listOrganismKits, pickBestOrganismKit } from '../server/services/organismKitLibrary.ts';

const kits = listOrganismKits();
console.log(`\nFound ${kits.length} kit(s):\n`);

for (const kit of kits) {
  const counts = { kick: 0, snare: 0, hat: 0, perc: 0, tom: 0, bass808: 0, loop: 0 };
  for (const s of kit.samples) counts[s.role]++;
  console.log(`  ${kit.id.padEnd(22)}  ${String(kit.samples.length).padStart(4)} classified`);
  console.log(`    kick:${counts.kick}  snare:${counts.snare}  hat:${counts.hat}  perc:${counts.perc}  tom:${counts.tom}  bass808:${counts.bass808}  loop:${counts.loop}`);
}

const best = pickBestOrganismKit();
console.log(`\nBest pick: ${best?.id ?? '(none)'}\n`);
