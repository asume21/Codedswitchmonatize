import { GenreSpec, getGenreSpec } from "./genreDatabase";

export interface GenreInsights {
  energyCurve: string;
  signatureElements: string[];
  sectionBlueprint: Array<{
    section: string;
    bars: number;
    notes: string;
  }>;
  loopTips: string[];
  vocalProfile?: string;
}

const insightsMap: Record<string, GenreInsights> = {
  "trap": {
    energyCurve: "Start atmospheric, add percussion layers by bar 9, peak energy with 808 + synth stack in final bar",
    signatureElements: [
      "1/32 hi-hat rolls with occasional triplets",
      "Pitch-bent 808 slides",
      "Half-time clap with subtle reverb tail"
    ],
    sectionBlueprint: [
      { section: "Intro", bars: 4, notes: "Filtered pads + riser, no drums" },
      { section: "Drop", bars: 8, notes: "Full drums + bass, sparse melody" },
      { section: "Break", bars: 4, notes: "Remove kick, keep hats + vox chop" },
      { section: "Final", bars: 8, notes: "Bring back full kit with variation" }
    ],
    loopTips: [
      "Leave open hat hits on the " + "and" + " of beat 2 for bounce",
      "Keep melody under two bars and reuse with automation"
    ],
    vocalProfile: "Dark, whispered delivery with aggressive ad-libs"
  },
  "house": {
    energyCurve: "Consistent drive with gradual filter lifts every 8 bars",
    signatureElements: [
      "Four-on-the-floor kick",
      "Off-beat open hi-hats",
      "Sidechained piano stabs"
    ],
    sectionBlueprint: [
      { section: "Intro", bars: 8, notes: "Kick + filtered pads" },
      { section: "Build", bars: 8, notes: "Add bass + claps, automate filter" },
      { section: "Drop", bars: 8, notes: "Full instrumentation, bright piano" },
      { section: "Break", bars: 4, notes: "Strip to pads + vocal chop" }
    ],
    loopTips: [
      "Always leave space on beat 4 for clap reverb tail",
      "Layer ride cymbal every 8 beats for lift"
    ],
    vocalProfile: "Uplifting, airy topline with chopped ad-libs"
  },
  "lo-fi": {
    energyCurve: "Low, consistent energy with subtle swells at section changes",
    signatureElements: [
      "Vinyl crackle + tape hiss",
      "Dusty Rhodes or Wurlitzer chords",
      "Lazy swing drums"
    ],
    sectionBlueprint: [
      { section: "Intro", bars: 4, notes: "Filtered sample + noise" },
      { section: "Main Loop", bars: 8, notes: "Full drums + bass" },
      { section: "Variation", bars: 8, notes: "Introduce counter-melody" }
    ],
    loopTips: [
      "Use 60-65% swing on hats and snares",
      "Humanize chord timing ±10ms"
    ],
    vocalProfile: "Soft spoken word or chopped vocal textures"
  },
  "afrobeats": {
    energyCurve: "Bouncy from start, add percussive layers and log drums through arrangement",
    signatureElements: [
      "Syncopated log drum hits",
      "Highlife guitar plucks",
      "Off-beat shakers"
    ],
    sectionBlueprint: [
      { section: "Intro", bars: 4, notes: "Percussion + vox FX" },
      { section: "Hook", bars: 8, notes: "Full drums, log drums, guitar" },
      { section: "Verse", bars: 8, notes: "Reduce percussion, keep groove" },
      { section: "Bridge", bars: 4, notes: "Call-and-response vocal space" }
    ],
    loopTips: [
      "Accent beat 3 with rim click or tom",
      "Use question/answer melodic phrasing"
    ],
    vocalProfile: "Warm, rhythmic delivery with melodic runs"
  }
};

export function getGenreInsights(style: string): GenreInsights | null {
  const spec = getGenreSpec(style);
  if (!spec) return null;
  const normalized = spec.name.toLowerCase().replace(/\s+/g, "-");
  return insightsMap[normalized] || null;
}
