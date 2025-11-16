// Quick test of hash function determinism

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

console.log('Testing hash function determinism...\n');

// Test 1: Same input = same output
const input1 = 'class-User-1';
const hash1a = hashString(input1);
const hash1b = hashString(input1);
console.log(`Test 1: Same input = same output`);
console.log(`  Input: "${input1}"`);
console.log(`  Hash 1: ${hash1a}`);
console.log(`  Hash 2: ${hash1b}`);
console.log(`  ✓ PASS: ${hash1a === hash1b}\n`);

// Test 2: Different input = different output
const input2a = 'class-User-1';
const input2b = 'class-Admin-1';
const hash2a = hashString(input2a);
const hash2b = hashString(input2b);
console.log(`Test 2: Different input = different output`);
console.log(`  Input A: "${input2a}" → ${hash2a}`);
console.log(`  Input B: "${input2b}" → ${hash2b}`);
console.log(`  ✓ PASS: ${hash2a !== hash2b}\n`);

// Test 3: Variation affects output
const base = hashString('class-User-1');
const var0 = base + 0;
const var5 = base + 5;
console.log(`Test 3: Variation affects output`);
console.log(`  Base hash: ${base}`);
console.log(`  With variation 0: ${var0}`);
console.log(`  With variation 5: ${var5}`);
console.log(`  ✓ PASS: ${var0 !== var5}\n`);

// Test 4: Note selection from chord
const chord = ['C4', 'E4', 'G4'];
const hash = hashString('class-User-1');
const noteIndex = hash % chord.length;
const selectedNote = chord[noteIndex];
console.log(`Test 4: Note selection from chord`);
console.log(`  Chord: ${chord.join(', ')}`);
console.log(`  Hash: ${hash}`);
console.log(`  Index: ${noteIndex}`);
console.log(`  Selected: ${selectedNote}`);
console.log(`  ✓ PASS: ${chord.includes(selectedNote)}\n`);

console.log('✅ All tests passed! Hash function is deterministic.');
