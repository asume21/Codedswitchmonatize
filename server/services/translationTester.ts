import { codeToMusic, musicToCode } from './grok.js';

// Test cases for circular translation validation
const TEST_CASES = [
  {
    name: "Simple Function",
    code: `function hello(name) {
  return "Hello, " + name;
}`,
    language: "javascript"
  },
  {
    name: "Class Definition", 
    code: `class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(num) {
    this.result += num;
    return this;
  }
  
  getValue() {
    return this.result;
  }
}`,
    language: "javascript"
  },
  {
    name: "Python Function",
    code: `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)`,
    language: "python"
  },
  {
    name: "React Component",
    code: `function Button({ onClick, children }) {
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
}`,
    language: "react"
  },
  {
    name: "Loop Structure",
    code: `for (let i = 0; i < 10; i++) {
  console.log(i);
}`,
    language: "javascript"
  }
];

export interface TestResult {
  testName: string;
  originalCode: string;
  regeneratedCode: string;
  similarityScore: number;
  structuralMatches: number;
  totalStructuralElements: number;
  passed: boolean;
  errors?: string[];
}

export interface CircularTestSuite {
  totalTests: number;
  passedTests: number;
  averageAccuracy: number;
  results: TestResult[];
  timestamp: string;
}

// Calculate real similarity between code strings
function calculateCodeSimilarity(original: string, regenerated: string): number {
  // Normalize both code strings
  const normalize = (code: string) => {
    return code
      .replace(/\/\/.*$/gm, '') // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  };

  const norm1 = normalize(original);
  const norm2 = normalize(regenerated);

  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;

  // Character-level similarity using simple ratio
  const longer = norm1.length > norm2.length ? norm1 : norm2;
  const shorter = norm1.length > norm2.length ? norm2 : norm1;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] === shorter[i]) matches++;
  }
  
  return (matches / longer.length) * 100;
}

// Analyze structural elements in code
function analyzeStructure(code: string, language: string) {
  const elements = {
    functions: 0,
    classes: 0,
    variables: 0,
    loops: 0,
    conditionals: 0
  };

  // Count structural elements based on language
  if (language === 'javascript' || language === 'react') {
    elements.functions = (code.match(/function\s+\w+|=>\s*{|const\s+\w+\s*=/g) || []).length;
    elements.classes = (code.match(/class\s+\w+/g) || []).length;
    elements.variables = (code.match(/(?:let|const|var)\s+\w+/g) || []).length;
    elements.loops = (code.match(/for\s*\(|while\s*\(/g) || []).length;
    elements.conditionals = (code.match(/if\s*\(/g) || []).length;
  } else if (language === 'python') {
    elements.functions = (code.match(/def\s+\w+/g) || []).length;
    elements.classes = (code.match(/class\s+\w+/g) || []).length;
    elements.variables = (code.match(/^\s*\w+\s*=/gm) || []).length;
    elements.loops = (code.match(/for\s+\w+\s+in|while\s+/g) || []).length;
    elements.conditionals = (code.match(/if\s+/g) || []).length;
  }

  return elements;
}

// Compare structural similarity
function compareStructure(original: any, regenerated: any): { matches: number; total: number } {
  let matches = 0;
  let total = 0;

  for (const [key, value] of Object.entries(original)) {
    total++;
    if (regenerated[key] === value) {
      matches++;
    } else if (Math.abs((regenerated[key] as number) - (value as number)) <= 1) {
      matches += 0.5; // Partial credit for close matches
    }
  }

  return { matches, total };
}

// Run a single circular translation test
async function runSingleTest(testCase: any): Promise<TestResult> {
  const errors: string[] = [];
  
  try {
    // Step 1: Convert code to music
    const musicData = await codeToMusic(testCase.code, testCase.language, 5);
    
    // Step 2: Convert music back to code
    const regeneratedResult = await musicToCode(musicData, testCase.language, "clean", 5);
    const regeneratedCode = regeneratedResult.code?.code || '';
    
    // Step 3: Calculate similarity
    const similarityScore = calculateCodeSimilarity(testCase.code, regeneratedCode);
    
    // Step 4: Analyze structural similarity
    const originalStructure = analyzeStructure(testCase.code, testCase.language);
    const regeneratedStructure = analyzeStructure(regeneratedCode, testCase.language);
    const structuralComparison = compareStructure(originalStructure, regeneratedStructure);
    
    // Test passes if similarity > 60% or structural elements match well
    const passed = similarityScore > 60 || (structuralComparison.matches / structuralComparison.total) > 0.7;
    
    return {
      testName: testCase.name,
      originalCode: testCase.code,
      regeneratedCode,
      similarityScore: Math.round(similarityScore * 100) / 100,
      structuralMatches: structuralComparison.matches,
      totalStructuralElements: structuralComparison.total,
      passed,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Translation failed: ${errorMessage}`);
    
    return {
      testName: testCase.name,
      originalCode: testCase.code,
      regeneratedCode: '',
      similarityScore: 0,
      structuralMatches: 0,
      totalStructuralElements: 0,
      passed: false,
      errors
    };
  }
}

// Run the complete circular translation test suite
export async function runCircularTranslationTests(): Promise<CircularTestSuite> {
  console.log('🧪 Starting circular translation test suite...');
  
  const results: TestResult[] = [];
  
  // Run tests sequentially to avoid rate limiting
  for (const testCase of TEST_CASES) {
    console.log(`Testing: ${testCase.name}`);
    const result = await runSingleTest(testCase);
    results.push(result);
    
    // Small delay to be respectful to the AI service
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Calculate overall statistics
  const passedTests = results.filter(r => r.passed).length;
  const averageAccuracy = results.reduce((sum, r) => sum + r.similarityScore, 0) / results.length;
  
  const testSuite: CircularTestSuite = {
    totalTests: results.length,
    passedTests,
    averageAccuracy: Math.round(averageAccuracy * 100) / 100,
    results,
    timestamp: new Date().toISOString()
  };
  
  console.log(`🧪 Test suite complete: ${passedTests}/${results.length} passed, ${testSuite.averageAccuracy}% average accuracy`);
  
  return testSuite;
}