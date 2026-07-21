import { parseCodeStructure, getCodeStatistics } from '../codeToMusic/codeParser';
import type { CodeElement } from '../../../shared/types/codeToMusic';
import type { CodeFingerprint, CodeUnit } from '../../../shared/types/codeFingerprint';

// Non-identifier placeholders that parseCodeStructure's extractName() can fall
// back to for some language patterns (e.g. a bare "(" for plain JS
// `function foo() {}` declarations, or the element type itself as a fallback
// like "conditional"). When we see one of these we recover the real name from
// the element's raw `content` instead of inventing new parsing.
const PARSER_KEYWORDS = new Set([
  'function', 'const', 'let', 'var', 'class', 'def', 'fn', 'func', 'struct',
  'interface', 'trait', 'type', 'public', 'private', 'protected', 'static',
  'async', 'export', 'conditional', 'loop', 'variable', 'import', 'return',
]);

const VALID_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Recover a usable name for a code element. parseCodeStructure's extractName()
 * sometimes returns a non-identifier capture (punctuation, or the element
 * type as a generic fallback) depending on which regex group matched for the
 * language. Fall back to pulling the name out of the element's own raw
 * `content` line rather than reimplementing parsing.
 */
function resolveName(el: CodeElement): string {
  if (VALID_IDENTIFIER.test(el.name) && !PARSER_KEYWORDS.has(el.name)) {
    return el.name;
  }

  const content = el.content ?? '';
  const declMatch = content.match(/\b(?:function|def|fn|func)\s+(\w+)/);
  if (declMatch) return declMatch[1];

  const typeMatch = content.match(/\b(?:class|struct|interface|trait|type)\s+(\w+)/);
  if (typeMatch) return typeMatch[1];

  const callMatch = content.match(/(\w+)\s*\(/);
  if (callMatch && !PARSER_KEYWORDS.has(callMatch[1])) return callMatch[1];

  return el.name;
}

/**
 * Analyze source code into a purely structural CodeFingerprint.
 * Deterministic: same (code, language) → deeply equal output. No music here.
 */
export function analyzeCodeStructure(code: string, language: string): CodeFingerprint {
  if (code.trim().length === 0) {
    return {
      language,
      totalLines: 0,
      complexity: 1,
      mood: 'neutral',
      units: [],
      identifiers: [],
      totalLoops: 0,
      totalBranches: 0,
    };
  }

  const parsed = parseCodeStructure(code, language);
  getCodeStatistics(parsed);

  const elements = parsed.elements.map(e => ({ ...e, name: resolveName(e) }));
  const identifiers = elements
    .map(e => e.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  const totalLoops = elements.filter(e => e.type === 'loop').length;
  const totalBranches = elements.filter(e => e.type === 'conditional').length;

  // Top-level units = functions and classes at nestingLevel 0 (fallback: any
  // function/class if none are at depth 0, e.g. everything is indented).
  const unitElements = elements.filter(e => e.type === 'function' || e.type === 'class');
  const topLevel = unitElements.filter(e => e.nestingLevel === 0);
  const chosen = topLevel.length > 0 ? topLevel : unitElements;

  const units: CodeUnit[] = chosen.map((unit, idx) => {
    // Span: lines until the next unit starts (or end of file).
    const nextUnit = chosen[idx + 1];
    const endLine = nextUnit ? nextUnit.line : parsed.totalLines + 1;
    const span = Math.max(1, endLine - unit.line);

    // References: how many times this unit's name appears among all identifiers,
    // minus its own declaration (min 0).
    const references = Math.max(0, identifiers.filter(n => n === unit.name).length - 1);

    // Elements physically inside this unit's line range.
    const inside = elements.filter(e => e.line > unit.line && e.line < endLine);
    const loops = inside.filter(e => e.type === 'loop').length;
    const branches = inside.filter(e => e.type === 'conditional').length;
    const maxNesting = inside.reduce((m, e) => Math.max(m, e.nestingLevel || 0), 0);

    return { name: unit.name, references, span, maxNesting, branches, loops };
  });

  return {
    language,
    totalLines: parsed.totalLines,
    complexity: parsed.complexity,
    mood: (parsed.mood ?? 'neutral') as CodeFingerprint['mood'],
    units,
    identifiers,
    totalLoops,
    totalBranches,
  };
}
