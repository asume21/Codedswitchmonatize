/**
 * Core AI music and analysis types shared between server and client.
 * These are frontend-agnostic contracts for every AI endpoint.
 */

export interface SongSection {
  id: string;
  type: string;
  bars: number;
}

export interface SongPlan {
  id: string;
  bpm: number;
  key: string;
  timeSignature: string;
  genre: string;
  subGenre?: string;
  mood: string;
  durationSeconds: number;
  sections: SongSection[];
  referenceArtists?: string[];
  createdAt: string;
}

export interface GeneratedLyricsSection {
  id: string;
  songPlanId: string;
  sectionId: string;
  lines: string[];
  metadata: {
    rhymeScheme?: string;
    syllablesPerLine?: number[];
  };
  createdAt: string;
}

export interface LyricsPunchupResult {
  sectionId: string;
  originalLines: string[];
  rewrittenLines: string[];
  notes?: string;
}

export interface AiNote {
  time: number; // beats
  duration: number; // beats
  pitch: string; // e.g. "C4"
  velocity: number; // 0-1
}

export interface MelodyTrack {
  sectionId: string;
  trackType: "melody";
  notes: AiNote[];
}

export interface BassTrack {
  sectionId: string;
  trackType: "bass";
  notes: AiNote[];
}

export interface DrumGrid {
  sectionId: string;
  trackType: "drums";
  grid: {
    kick: number[];
    snare: number[];
    hihat: number[];
    [other: string]: number[];
  };
  resolution: "1/16" | "1/8";
  bars: number;
}

export interface ArrangementTimeline {
  timeline: { sectionId: string; startBar: number }[];
  automationIdeas?: string[];
}

export interface SongAnalysis {
  bpm: number | null;
  key: string | null;
  vocalAnalysis: string | null;
  lyricsQuality: string | null;
  productionQuality: string | null;
  specificIssues: string[];
  commercialViability: string | null;
  analysisNotes?: string | null;
}

export interface LyricsAnalysis {
  rhyme: string | null;
  syllables: number | null;
  syllablesPerLine?: number[];
  sentiment: string | null;
  flow: string | null;
  suggestions: string[];
}
