/**
 * Code Parser - Extract structural elements from code
 * Supports multiple programming languages
 */

import type { ParsedCode, CodeElement } from '../../../shared/types/codeToMusic';

/**
 * Language-specific patterns for code element detection
 */
const LANGUAGE_PATTERNS = {
  // Python patterns
  python: {
    class: /^\s*class\s+(\w+)/,
    function: /^\s*def\s+(\w+)/,
    variable: /^\s*(\w+)\s*=/,
    loop: /^\s*(for|while)\s+/,
    conditional: /^\s*if\s+/,
    import: /^\s*(import|from)\s+/,
    return: /^\s*return\s+/,
  },
  
  // JavaScript/TypeScript patterns
  javascript: {
    class: /^\s*class\s+(\w+)/,
    function: /^\s*(function|const|let|var)\s+(\w+)\s*=?\s*(\(|async|function)/,
    variable: /^\s*(const|let|var)\s+(\w+)\s*=/,
    loop: /^\s*(for|while|do)\s*[\(\{]/,
    conditional: /^\s*if\s*\(/,
    import: /^\s*(import|require|from)\s+/,
    return: /^\s*return\s+/,
  },
  
  typescript: {
    class: /^\s*(export\s+)?(class|interface|type)\s+(\w+)/,
    function: /^\s*(export\s+)?(function|const|let)\s+(\w+)\s*[=:]?\s*(\(|async|function)/,
    variable: /^\s*(const|let|var)\s+(\w+)\s*[:=]/,
    loop: /^\s*(for|while|do)\s*[\(\{]/,
    conditional: /^\s*if\s*\(/,
    import: /^\s*import\s+/,
    return: /^\s*return\s+/,
  },
  
  // Java patterns
  java: {
    class: /^\s*(public|private|protected)?\s*(class|interface)\s+(\w+)/,
    function: /^\s*(public|private|protected)?\s*(static\s+)?(\w+)\s+(\w+)\s*\(/,
    variable: /^\s*(public|private|protected)?\s*(static\s+)?(\w+)\s+(\w+)\s*=/,
    loop: /^\s*(for|while|do)\s*[\(\{]/,
    conditional: /^\s*if\s*\(/,
    import: /^\s*import\s+/,
    return: /^\s*return\s+/,
  },
  
  // C/C++ patterns
  cpp: {
    class: /^\s*(class|struct)\s+(\w+)/,
    function: /^\s*(\w+)\s+(\w+)\s*\(/,
    variable: /^\s*(\w+)\s+(\w+)\s*=/,
    loop: /^\s*(for|while|do)\s*[\(\{]/,
    conditional: /^\s*if\s*\(/,
    import: /^\s*#include\s+/,
    return: /^\s*return\s+/,
  },
};

/**
 * Normalize language name
 */
function normalizeLanguage(language: string): keyof typeof LANGUAGE_PATTERNS {
  const normalized = language.toLowerCase();
  
  if (['js', 'jsx', 'javascript'].includes(normalized)) return 'javascript';
  if (['ts', 'tsx', 'typescript'].includes(normalized)) return 'typescript';
  if (['py', 'python'].includes(normalized)) return 'python';
  if (['java'].includes(normalized)) return 'java';
  if (['c', 'cpp', 'c++', 'cc', 'cxx'].includes(normalized)) return 'cpp';
  
  return 'javascript'; // Default fallback
}

/**
 * Extract name from matched pattern
 */
function extractName(line: string, match: RegExpMatchArray, elementType: string): string {
  // Try to find the most relevant capture group
  for (let i = match.length - 1; i >= 1; i--) {
    const captured = match[i];
    if (captured && captured.length > 0 && captured !== 'const' && captured !== 'let' && 
        captured !== 'var' && captured !== 'function' && captured !== 'async' &&
        captured !== 'public' && captured !== 'private' && captured !== 'protected' &&
        captured !== 'static' && captured !== 'export') {
      return captured;
    }
  }
  
  return elementType;
}

/**
 * Calculate nesting level based on indentation
 */
function calculateNestingLevel(line: string): number {
  const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
  // Assume 2 or 4 spaces per level
  return Math.floor(leadingSpaces / 2);
}

/**
 * Parse code structure and extract elements
 */
export function parseCodeStructure(code: string, language: string): ParsedCode {
  const normalizedLang = normalizeLanguage(language);
  const patterns = LANGUAGE_PATTERNS[normalizedLang];
  
  const lines = code.split('\n');
  const elements: CodeElement[] = [];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
      return;
    }
    
    // Try to match each pattern
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = line.match(pattern);
      if (match) {
        const elementType = type as CodeElement['type'];
        const name = extractName(line, match, type);
        const nestingLevel = calculateNestingLevel(line);
        
        elements.push({
          type: elementType,
          name,
          line: index + 1,
          content: trimmed,
          nestingLevel,
        });
        
        break; // Only match first pattern per line
      }
    }
  });
  
  // Calculate complexity (simple heuristic)
  const complexity = Math.min(10, Math.max(1, Math.floor(elements.length / 3) + 1));
  
  // Detect mood based on keywords
  const mood = detectMood(code);
  
  return {
    elements,
    language: normalizedLang,
    totalLines: lines.length,
    complexity,
    mood,
  };
}

/**
 * Detect mood from code keywords
 */
function detectMood(code: string): 'happy' | 'sad' | 'neutral' | 'energetic' {
  const codeLower = code.toLowerCase();
  
  // Happy keywords
  const happyKeywords = ['success', 'win', 'complete', 'done', 'yes', 'true', 'ok', 'valid'];
  const happyCount = happyKeywords.filter(k => codeLower.includes(k)).length;
  
  // Sad keywords
  const sadKeywords = ['error', 'fail', 'exception', 'crash', 'bug', 'false', 'invalid'];
  const sadCount = sadKeywords.filter(k => codeLower.includes(k)).length;
  
  // Energetic keywords
  const energeticKeywords = ['fast', 'quick', 'speed', 'run', 'go', 'async', 'parallel'];
  const energeticCount = energeticKeywords.filter(k => codeLower.includes(k)).length;
  
  // Determine mood
  if (energeticCount > happyCount && energeticCount > sadCount) return 'energetic';
  if (happyCount > sadCount) return 'happy';
  if (sadCount > happyCount) return 'sad';
  return 'neutral';
}

/**
 * Get code statistics
 */
export function getCodeStatistics(parsed: ParsedCode) {
  const stats = {
    totalElements: parsed.elements.length,
    classes: parsed.elements.filter(e => e.type === 'class').length,
    functions: parsed.elements.filter(e => e.type === 'function').length,
    variables: parsed.elements.filter(e => e.type === 'variable').length,
    loops: parsed.elements.filter(e => e.type === 'loop').length,
    conditionals: parsed.elements.filter(e => e.type === 'conditional').length,
    imports: parsed.elements.filter(e => e.type === 'import').length,
    returns: parsed.elements.filter(e => e.type === 'return').length,
    maxNestingLevel: Math.max(...parsed.elements.map(e => e.nestingLevel), 0),
    avgNestingLevel: parsed.elements.length > 0
      ? parsed.elements.reduce((sum, e) => sum + e.nestingLevel, 0) / parsed.elements.length
      : 0,
  };
  
  return stats;
}
