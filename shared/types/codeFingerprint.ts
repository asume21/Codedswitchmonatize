// shared/types/codeFingerprint.ts
// The structural read of a source file, produced by analyzeCodeStructure and
// consumed by composeArrangementFromCode. Purely structural — no music here.

/** One top-level code unit (function/class) — becomes a song section. */
export interface CodeUnit {
  name: string;
  /** How many times this unit's name appears elsewhere (call/reference count).
   *  The highest-referenced unit becomes the hook/chorus. */
  references: number;
  /** Lines of code spanned (approx) — longer unit = longer section. */
  span: number;
  /** Max loop-nesting depth inside this unit — drives density. */
  maxNesting: number;
  /** Count of conditional branches inside — drives energy variation. */
  branches: number;
  /** Count of loops inside — drives groove intensity. */
  loops: number;
}

export interface CodeFingerprint {
  language: string;
  totalLines: number;
  /** 1-10, reused from getCodeStatistics/parseCodeStructure. */
  complexity: number;
  mood: 'happy' | 'sad' | 'neutral' | 'energetic' | 'chill';
  /** Ordered top-level units (functions/classes). May be empty for trivial code. */
  units: CodeUnit[];
  /** All identifier names in source order — seeds the motif. */
  identifiers: string[];
  /** Total loop count across the whole file. */
  totalLoops: number;
  /** Total branch (if/switch) count across the whole file. */
  totalBranches: number;
}
