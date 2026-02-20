// server/ai/utils/robustJsonParser.ts
// Robust JSON extraction for AI responses that may contain markdown fences,
// commentary, truncated output, or other non-JSON artifacts.
// Phi3 (3.8B) frequently wraps JSON in ```json blocks, adds trailing commas,
// or truncates long arrays. This parser handles all of those cases.

export interface ParseResult {
  success: boolean;
  data: any;
  method: string;
  warnings: string[];
  rawLength: number;
}

export function extractJSON(raw: string): ParseResult {
  const warnings: string[] = [];
  const rawLength = raw.length;

  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return { success: false, data: null, method: 'none', warnings: ['Empty response'], rawLength: 0 };
  }

  // 1. Try direct parse first (best case)
  try {
    const data = JSON.parse(raw);
    return { success: true, data, method: 'direct', warnings, rawLength };
  } catch {
    // continue
  }

  // 2. Extract from markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const data = JSON.parse(fenceMatch[1].trim());
      warnings.push('Extracted JSON from markdown code fence');
      return { success: true, data, method: 'markdown_fence', warnings, rawLength };
    } catch {
      // Try fixing the fenced content
      const fixed = repairJSON(fenceMatch[1].trim());
      if (fixed.success) {
        warnings.push('Extracted JSON from markdown fence + repaired');
        return { success: true, data: fixed.data, method: 'markdown_fence_repaired', warnings: [...warnings, ...fixed.warnings], rawLength };
      }
    }
  }

  // 3. Find the outermost { ... } block
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = raw.slice(braceStart, braceEnd + 1);
    try {
      const data = JSON.parse(candidate);
      warnings.push('Extracted JSON from brace boundaries');
      return { success: true, data, method: 'brace_extract', warnings, rawLength };
    } catch {
      const fixed = repairJSON(candidate);
      if (fixed.success) {
        warnings.push('Extracted JSON from brace boundaries + repaired');
        return { success: true, data: fixed.data, method: 'brace_extract_repaired', warnings: [...warnings, ...fixed.warnings], rawLength };
      }
    }
  }

  // 4. Try aggressive repair on the whole string
  const fullRepair = repairJSON(raw);
  if (fullRepair.success) {
    warnings.push('Repaired raw AI response');
    return { success: true, data: fullRepair.data, method: 'full_repair', warnings: [...warnings, ...fullRepair.warnings], rawLength };
  }

  return {
    success: false,
    data: null,
    method: 'failed',
    warnings: [...warnings, 'All JSON extraction methods failed'],
    rawLength,
  };
}

function repairJSON(text: string): { success: boolean; data: any; warnings: string[] } {
  const warnings: string[] = [];
  let fixed = text.trim();

  // Remove trailing commas before } or ]
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  if (fixed !== text.trim()) warnings.push('Removed trailing commas');

  // Remove single-line comments
  fixed = fixed.replace(/\/\/[^\n]*/g, '');

  // Fix unquoted keys: { key: "value" } → { "key": "value" }
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');

  // Fix single quotes to double quotes (careful with apostrophes)
  fixed = fixed.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  // Handle truncated arrays — if the string ends mid-array, close it
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;

  if (openBrackets > closeBrackets || openBraces > closeBraces) {
    warnings.push('Detected truncated JSON, attempting to close brackets');
    // Remove any trailing partial element (e.g. `{ "step": 4, "note":`)
    fixed = fixed.replace(/,\s*\{[^}]*$/g, '');
    fixed = fixed.replace(/,\s*\[[^\]]*$/g, '');
    fixed = fixed.replace(/,\s*"[^"]*$/g, '');
    fixed = fixed.replace(/,\s*\d+$/g, '');
    // Remove trailing comma after cleanup
    fixed = fixed.replace(/,\s*$/g, '');
    // Close remaining brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
  }

  try {
    const data = JSON.parse(fixed);
    return { success: true, data, warnings };
  } catch {
    return { success: false, data: null, warnings: [...warnings, 'Repair failed'] };
  }
}

/**
 * Merge partial AI output with fallback data.
 * If the AI returned drums and bass but not chords/melody,
 * fill in the missing tracks from the fallback instead of discarding everything.
 */
export function mergePartialWithFallback(
  partial: Record<string, any>,
  fallback: Record<string, any>
): { merged: Record<string, any>; filledFields: string[] } {
  const merged = { ...fallback };
  const filledFields: string[] = [];
  const trackFields = ['drums', 'bass', 'chords', 'melody'];

  // Copy over top-level scalars from AI if present
  for (const key of ['bpm', 'key', 'style', 'timeSignature', 'instruments']) {
    if (partial[key] !== undefined && partial[key] !== null) {
      merged[key] = partial[key];
    }
  }

  // For each track field, use AI data if it has enough events, otherwise keep fallback
  for (const field of trackFields) {
    const aiData = partial[field];
    if (Array.isArray(aiData) && aiData.length >= 2) {
      merged[field] = aiData;
    } else {
      filledFields.push(field);
    }
  }

  // Mark as partially merged
  merged.meta = {
    ...(merged.meta || {}),
    partialMerge: filledFields.length > 0,
    filledFromFallback: filledFields,
    aiSource: filledFields.length === 4 ? 'astutely-fallback' : 'astutely-ai-partial',
  };

  return { merged, filledFields };
}
