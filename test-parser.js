// Test the code parser with different languages

const testCases = [
  {
    name: 'Python Code',
    language: 'python',
    code: `
class User:
    def __init__(self, name):
        self.name = name
    
    def login(self):
        for attempt in range(3):
            if self.authenticate():
                return True
        return False
    `.trim()
  },
  {
    name: 'JavaScript Code',
    language: 'javascript',
    code: `
class MusicPlayer {
    constructor() {
        this.volume = 50;
    }
    
    play(song) {
        for (let i = 0; i < song.length; i++) {
            if (song[i].isValid()) {
                return true;
            }
        }
    }
}
    `.trim()
  },
  {
    name: 'TypeScript Code',
    language: 'typescript',
    code: `
export class DataProcessor {
    private data: string[] = [];
    
    async process(): Promise<void> {
        for (const item of this.data) {
            if (item) {
                await this.save(item);
            }
        }
    }
}
    `.trim()
  }
];

console.log('🧪 Testing Code Parser\n');
console.log('='.repeat(60));

testCases.forEach(test => {
  console.log(`\n📝 ${test.name} (${test.language})`);
  console.log('-'.repeat(60));
  console.log(test.code);
  console.log('-'.repeat(60));
  
  const lines = test.code.split('\n');
  let classCount = 0;
  let functionCount = 0;
  let loopCount = 0;
  let conditionalCount = 0;
  
  lines.forEach(line => {
    if (line.match(/^\s*class\s+/)) classCount++;
    if (line.match(/^\s*(def|function|async)\s+/) || line.match(/constructor/)) functionCount++;
    if (line.match(/^\s*(for|while)\s+/)) loopCount++;
    if (line.match(/^\s*if\s+/)) conditionalCount++;
  });
  
  console.log(`\n📊 Detected Elements:`);
  console.log(`  Classes: ${classCount}`);
  console.log(`  Functions: ${functionCount}`);
  console.log(`  Loops: ${loopCount}`);
  console.log(`  Conditionals: ${conditionalCount}`);
  console.log(`  Total Lines: ${lines.length}`);
  console.log('='.repeat(60));
});

console.log('\n✅ Parser test complete!');
console.log('\nExpected behavior:');
console.log('- Python: 1 class, 2 functions, 1 loop, 1 conditional');
console.log('- JavaScript: 1 class, 2 functions, 1 loop, 1 conditional');
console.log('- TypeScript: 1 class, 1 function, 1 loop, 1 conditional');
