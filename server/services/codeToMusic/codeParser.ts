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
    loop: /^\s*(for|while|do)\s*[({]/,
    conditional: /^\s*if\s*\(/,
    import: /^\s*(import|require|from)\s+/,
    return: /^\s*return\s+/,
  },
  
  typescript: {
    class: /^\s*(export\s+)?(class|interface|type)\s+(\w+)/,
    function: /^\s*(export\s+)?(function|const|let)\s+(\w+)\s*[=:]?\s*(\(|async|function)/,
    variable: /^\s*(const|let|var)\s+(\w+)\s*[:=]/,
    loop: /^\s*(for|while|do)\s*[({]/,
    conditional: /^\s*if\s*\(/,
    import: /^\s*import\s+/,
    return: /^\s*return\s+/,
  },
  
  // Java patterns
  java: {
    class: /^\s*(public|private|protected)?\s*(class|interface)\s+(\w+)/,
    function: /^\s*(public|private|protected)?\s*(static\s+)?(\w+)\s+(\w+)\s*\(/,
    variable: /^\s*(public|private|protected)?\s*(static\s+)?(\w+)\s+(\w+)\s*=/,
    loop: /^\s*(for|while|do)\s*[({]/,
    conditional: /^\s*if\s*\(/,
    import: /^\s*import\s+/,
    return: /^\s*return\s+/,
  },
  
  // C/C++ patterns
  cpp: {
    class: /^\s*(class|struct)\s+(\w+)/,
    function: /^\s*(\w+)\s+(\w+)\s*\(/,
    variable: /^\s*(\w+)\s+(\w+)\s*=/,
    loop: /^\s*(for|while|do)\s*[({]/,
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
 * Pre-process code: strip comments, normalize whitespace, clean input
 */
function preprocessCode(code: string, language: string): string {
  let cleaned = code;

  // Remove block comments (/* ... */ and """ ... """)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/"""[\s\S]*?"""/g, '');
  cleaned = cleaned.replace(/'''[\s\S]*?'''/g, '');

  // Remove single-line comments but preserve the line structure
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  if (['python', 'py', 'ruby'].includes(language.toLowerCase())) {
    cleaned = cleaned.replace(/#.*$/gm, '');
  }

  // Normalize tabs to spaces
  cleaned = cleaned.replace(/\t/g, '  ');

  // Remove trailing whitespace per line
  cleaned = cleaned.replace(/[ \t]+$/gm, '');

  // Collapse multiple blank lines into one
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Parse code structure and extract elements
 */
export function parseCodeStructure(code: string, language: string): ParsedCode {
  const normalizedLang = normalizeLanguage(language);
  const patterns = LANGUAGE_PATTERNS[normalizedLang];
  
  // Pre-process code before parsing
  const cleanedCode = preprocessCode(code, language);
  const lines = cleanedCode.split('\n');
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
  
  // Detect mood based on keywords (use cleaned code for better accuracy)
  const mood = detectMood(cleanedCode);
  
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
  
  // Count occurrences of each keyword (frequency-based, not just presence)
  const countOccurrences = (text: string, keyword: string): number => {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(keyword, pos)) !== -1) {
      count++;
      pos += keyword.length;
    }
    return count;
  };

  // Weighted keyword maps: [keyword, weight]
  const happyKeywords: [string, number][] = [
    ['success', 3], ['win', 2], ['complete', 2], ['done', 2], ['resolve', 2],
    ['true', 1], ['ok', 1], ['valid', 2], ['approve', 3], ['accept', 2],
    ['create', 1], ['build', 1], ['new', 1], ['start', 1], ['open', 1],
    ['enable', 2], ['allow', 1], ['grant', 2], ['welcome', 3], ['celebrate', 3],
  ];

  const sadKeywords: [string, number][] = [
    ['error', 3], ['fail', 3], ['exception', 3], ['crash', 3], ['bug', 2],
    ['false', 1], ['invalid', 2], ['reject', 2], ['deny', 2], ['block', 2],
    ['delete', 1], ['remove', 1], ['destroy', 2], ['kill', 2], ['abort', 3],
    ['deprecated', 2], ['broken', 3], ['missing', 2], ['null', 1], ['undefined', 1],
    ['throw', 2], ['catch', 1], ['warn', 1], ['fatal', 3], ['panic', 3],
  ];

  const energeticKeywords: [string, number][] = [
    ['fast', 2], ['quick', 2], ['speed', 2], ['run', 1], ['go', 1],
    ['async', 2], ['parallel', 3], ['concurrent', 3], ['stream', 2], ['emit', 2],
    ['loop', 2], ['iterate', 2], ['recursive', 3], ['while', 1], ['for', 1],
    ['spawn', 2], ['thread', 3], ['worker', 2], ['batch', 2], ['queue', 2],
    ['realtime', 3], ['instant', 2], ['trigger', 2], ['fire', 2], ['dispatch', 2],
  ];

  // Calculate weighted scores
  let happyScore = 0;
  let sadScore = 0;
  let energeticScore = 0;

  for (const [keyword, weight] of happyKeywords) {
    happyScore += countOccurrences(codeLower, keyword) * weight;
  }
  for (const [keyword, weight] of sadKeywords) {
    sadScore += countOccurrences(codeLower, keyword) * weight;
  }
  for (const [keyword, weight] of energeticKeywords) {
    energeticScore += countOccurrences(codeLower, keyword) * weight;
  }

  // Structural analysis boosts
  const lines = code.split('\n');
  const loopCount = lines.filter(l => /\b(for|while|do)\b/.test(l)).length;
  const condCount = lines.filter(l => /\b(if|switch|case)\b/.test(l)).length;
  const funcCount = lines.filter(l => /\b(function|def|fn|func)\b/.test(l)).length;

  // Many loops → energetic; many conditionals → complex/sad; many functions → structured/happy
  energeticScore += loopCount * 2;
  sadScore += Math.max(0, condCount - 3); // Only sad if lots of branching
  happyScore += Math.max(0, funcCount - 2); // Well-structured code feels positive

  // Normalize by code length to avoid bias toward longer code
  const normalizer = Math.max(1, lines.length / 20);
  happyScore /= normalizer;
  sadScore /= normalizer;
  energeticScore /= normalizer;

  // Determine mood with minimum threshold
  const maxScore = Math.max(happyScore, sadScore, energeticScore);
  if (maxScore < 1) return 'neutral';
  if (energeticScore === maxScore) return 'energetic';
  if (happyScore === maxScore) return 'happy';
  if (sadScore === maxScore) return 'sad';
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
