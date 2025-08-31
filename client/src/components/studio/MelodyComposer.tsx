import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMIDI } from "@/hooks/use-midi";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RealisticAudioEngine } from "@/lib/realisticAudio";

interface Note {
  note: string;
  octave: number;
  duration: number; // In beats (1 = quarter note, 2 = half note, etc.)
  start: number; // In beats
  track: string;
  velocity?: number; // Note velocity (0-127)
  noteDuration?: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'; // Visual representation
}

interface Track {
  id: string;
  name: string;
  color: string;
  instrument: string;
  visible: boolean;
  muted: boolean;
  volume: number;
}

const instrumentCategories = {
  piano: {
    name: 'Piano & Keys',
    color: 'bg-blue-500',
    instruments: [
      { id: 'piano-grand', name: 'Grand Piano', icon: '🎹' },
      { id: 'piano-upright', name: 'Upright Piano', icon: '🎹' },
      { id: 'piano-electric', name: 'Electric Piano', icon: '🎹' },
      { id: 'piano-organ', name: 'Organ', icon: '⛪' },
      { id: 'piano-harpsichord', name: 'Harpsichord', icon: '🎼' },
      { id: 'piano-celesta', name: 'Celesta', icon: '✨' }
    ]
  },
  strings: {
    name: 'Strings',
    color: 'bg-green-500',
    instruments: [
      { id: 'strings-violin', name: 'Violin', icon: '🎻' },
      { id: 'strings-viola', name: 'Viola', icon: '🎻' },
      { id: 'strings-cello', name: 'Cello', icon: '🎻' },
      { id: 'strings-doublebass', name: 'Double Bass', icon: '🎻' },
      { id: 'strings-guitar-acoustic', name: 'Acoustic Guitar', icon: '🎸' },
      { id: 'strings-guitar-electric', name: 'Electric Guitar', icon: '🎸' },
      { id: 'strings-guitar-classical', name: 'Classical Guitar', icon: '🎸' },
      { id: 'strings-banjo', name: 'Banjo', icon: '🪕' },
      { id: 'strings-mandolin', name: 'Mandolin', icon: '🎼' },
      { id: 'strings-harp', name: 'Harp', icon: '🪄' }
    ]
  },
  woodwinds: {
    name: 'Woodwinds',
    color: 'bg-purple-500',
    instruments: [
      { id: 'flute-concert', name: 'Concert Flute', icon: '🪈' },
      { id: 'flute-piccolo', name: 'Piccolo', icon: '🪈' },
      { id: 'flute-alto', name: 'Alto Flute', icon: '🪈' },
      { id: 'clarinet-bb', name: 'Bb Clarinet', icon: '🎼' },
      { id: 'clarinet-bass', name: 'Bass Clarinet', icon: '🎼' },
      { id: 'oboe', name: 'Oboe', icon: '🎶' },
      { id: 'english-horn', name: 'English Horn', icon: '🎶' },
      { id: 'bassoon', name: 'Bassoon', icon: '🎼' },
      { id: 'saxophone-alto', name: 'Alto Saxophone', icon: '🎷' },
      { id: 'saxophone-tenor', name: 'Tenor Saxophone', icon: '🎷' },
      { id: 'recorder', name: 'Recorder', icon: '🪈' }
    ]
  },
  brass: {
    name: 'Brass',
    color: 'bg-yellow-500',
    instruments: [
      { id: 'trumpet-bb', name: 'Bb Trumpet', icon: '🎺' },
      { id: 'trumpet-piccolo', name: 'Piccolo Trumpet', icon: '🎺' },
      { id: 'horn-french', name: 'French Horn', icon: '📯' },
      { id: 'trombone-tenor', name: 'Tenor Trombone', icon: '🔔' },
      { id: 'trombone-bass', name: 'Bass Trombone', icon: '🔔' },
      { id: 'tuba', name: 'Tuba', icon: '🎺' },
      { id: 'euphonium', name: 'Euphonium', icon: '🎺' },
      { id: 'cornet', name: 'Cornet', icon: '🎺' }
    ]
  },
  percussion: {
    name: 'Percussion',
    color: 'bg-red-500',
    instruments: [
      { id: 'timpani', name: 'Timpani', icon: '🥁' },
      { id: 'snare-drum', name: 'Snare Drum', icon: '🥁' },
      { id: 'bass-drum', name: 'Bass Drum', icon: '🥁' },
      { id: 'cymbals', name: 'Cymbals', icon: '🥁' },
      { id: 'xylophone', name: 'Xylophone', icon: '🎼' },
      { id: 'marimba', name: 'Marimba', icon: '🎼' },
      { id: 'vibraphone', name: 'Vibraphone', icon: '✨' },
      { id: 'triangle', name: 'Triangle', icon: '🔺' },
      { id: 'tambourine', name: 'Tambourine', icon: '🥁' }
    ]
  },
  bass: {
    name: 'Bass',
    color: 'bg-orange-500',
    instruments: [
      { id: 'bass-electric', name: 'Electric Bass', icon: '🎸' },
      { id: 'bass-upright', name: 'Upright Bass', icon: '🎻' },
      { id: 'bass-synth', name: 'Synth Bass', icon: '🎹' },
      { id: 'bass-fretless', name: 'Fretless Bass', icon: '🎸' },
      { id: 'bass-acoustic', name: 'Acoustic Bass', icon: '🎻' }
    ]
  },
  synthesizer: {
    name: 'Synthesizer',
    color: 'bg-indigo-500',
    instruments: [
      { id: 'synth-analog', name: 'Analog Synth', icon: '🎹' },
      { id: 'synth-digital', name: 'Digital Synth', icon: '🎹' },
      { id: 'synth-fm', name: 'FM Synth', icon: '📻' },
      { id: 'synth-wavetable', name: 'Wavetable Synth', icon: '🌊' },
      { id: 'synth-granular', name: 'Granular Synth', icon: '✨' },
      { id: 'synth-additive', name: 'Additive Synth', icon: '➕' }
    ]
  },
  pads: {
    name: 'Pads & Textures',
    color: 'bg-cyan-500',
    instruments: [
      { id: 'pad-warm', name: 'Warm Pad', icon: '☀️' },
      { id: 'pad-strings', name: 'String Pad', icon: '🎻' },
      { id: 'pad-choir', name: 'Choir Pad', icon: '👥' },
      { id: 'pad-ambient', name: 'Ambient Pad', icon: '🌌' },
      { id: 'pad-crystal', name: 'Crystal Pad', icon: '💎' },
      { id: 'pad-dark', name: 'Dark Pad', icon: '🌙' }
    ]
  },
  leads: {
    name: 'Lead Synths',
    color: 'bg-pink-500',
    instruments: [
      { id: 'lead-square', name: 'Square Lead', icon: '⬜' },
      { id: 'lead-saw', name: 'Saw Lead', icon: '🔶' },
      { id: 'lead-pluck', name: 'Pluck Lead', icon: '🎸' },
      { id: 'lead-acid', name: 'Acid Lead', icon: '🧪' },
      { id: 'lead-distorted', name: 'Distorted Lead', icon: '⚡' },
      { id: 'lead-smooth', name: 'Smooth Lead', icon: '🌊' }
    ]
  },
  ethnic: {
    name: 'World & Ethnic',
    color: 'bg-emerald-500',
    instruments: [
      { id: 'sitar', name: 'Sitar', icon: '🎼' },
      { id: 'tabla', name: 'Tabla', icon: '🥁' },
      { id: 'didgeridoo', name: 'Didgeridoo', icon: '🪃' },
      { id: 'erhu', name: 'Erhu', icon: '🎻' },
      { id: 'koto', name: 'Koto', icon: '🎼' },
      { id: 'mbira', name: 'Mbira', icon: '🎵' },
      { id: 'pan-flute', name: 'Pan Flute', icon: '🪈' },
      { id: 'bagpipes', name: 'Bagpipes', icon: '🎵' }
    ]
  }
};

// Musical scales with their note patterns
const MUSICAL_SCALES = {
  'C Major': { notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], root: 'C' },
  'G Major': { notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'], root: 'G' },
  'D Major': { notes: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'], root: 'D' },
  'A Major': { notes: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'], root: 'A' },
  'E Major': { notes: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'], root: 'E' },
  'B Major': { notes: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'], root: 'B' },
  'F# Major': { notes: ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'], root: 'F#' },
  'C# Major': { notes: ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'], root: 'C#' },
  'F Major': { notes: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'], root: 'F' },
  'Bb Major': { notes: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'], root: 'Bb' },
  'Eb Major': { notes: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'], root: 'Eb' },
  'Ab Major': { notes: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'], root: 'Ab' },
  'Db Major': { notes: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'], root: 'Db' },
  'Gb Major': { notes: ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'], root: 'Gb' },
  'Cb Major': { notes: ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'], root: 'Cb' },
  // Minor scales
  'A Minor': { notes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], root: 'A' },
  'E Minor': { notes: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'], root: 'E' },
  'B Minor': { notes: ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'], root: 'B' },
  'F# Minor': { notes: ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'], root: 'F#' },
  'C# Minor': { notes: ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'], root: 'C#' },
  'G# Minor': { notes: ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'], root: 'G#' },
  'D# Minor': { notes: ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#'], root: 'D#' },
  'A# Minor': { notes: ['A#', 'B#', 'C#', 'D#', 'E#', 'F#', 'G#'], root: 'A#' },
  'D Minor': { notes: ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'], root: 'D' },
  'G Minor': { notes: ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'], root: 'G' },
  'C Minor': { notes: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'], root: 'C' },
  'F Minor': { notes: ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'], root: 'F' },
  'Bb Minor': { notes: ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab'], root: 'Bb' },
  'Eb Minor': { notes: ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db'], root: 'Eb' },
  'Ab Minor': { notes: ['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'Gb'], root: 'Ab' },
  // Pentatonic scales
  'C Major Pentatonic': { notes: ['C', 'D', 'E', 'G', 'A'], root: 'C' },
  'G Major Pentatonic': { notes: ['G', 'A', 'B', 'D', 'E'], root: 'G' },
  'D Major Pentatonic': { notes: ['D', 'E', 'F#', 'A', 'B'], root: 'D' },
  'A Major Pentatonic': { notes: ['A', 'B', 'C#', 'E', 'F#'], root: 'A' },
  'E Major Pentatonic': { notes: ['E', 'F#', 'G#', 'B', 'C#'], root: 'E' },
  'A Minor Pentatonic': { notes: ['A', 'C', 'D', 'E', 'G'], root: 'A' },
  'E Minor Pentatonic': { notes: ['E', 'G', 'A', 'B', 'D'], root: 'E' },
  'B Minor Pentatonic': { notes: ['B', 'D', 'E', 'F#', 'A'], root: 'B' },
  'F# Minor Pentatonic': { notes: ['F#', 'A', 'B', 'C#', 'E'], root: 'F#' },
  'C# Minor Pentatonic': { notes: ['C#', 'E', 'F#', 'G#', 'B'], root: 'C#' },
  // Blues scales
  'C Blues': { notes: ['C', 'Eb', 'F', 'F#', 'G', 'Bb'], root: 'C' },
  'G Blues': { notes: ['G', 'Bb', 'C', 'C#', 'D', 'F'], root: 'G' },
  'D Blues': { notes: ['D', 'F', 'G', 'G#', 'A', 'C'], root: 'D' },
  'A Blues': { notes: ['A', 'C', 'D', 'D#', 'E', 'G'], root: 'A' },
  'E Blues': { notes: ['E', 'G', 'A', 'A#', 'B', 'D'], root: 'E' },
  // Modal scales
  'C Dorian': { notes: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'], root: 'C' },
  'D Dorian': { notes: ['D', 'E', 'F', 'G', 'A', 'B', 'C'], root: 'D' },
  'E Dorian': { notes: ['E', 'F#', 'G', 'A', 'B', 'C#', 'D'], root: 'E' },
  'C Phrygian': { notes: ['C', 'Db', 'Eb', 'F', 'G', 'Ab', 'Bb'], root: 'C' },
  'D Phrygian': { notes: ['D', 'Eb', 'F', 'G', 'A', 'Bb', 'C'], root: 'D' },
  'E Phrygian': { notes: ['E', 'F', 'G', 'A', 'B', 'C', 'D'], root: 'E' },
  'C Lydian': { notes: ['C', 'D', 'E', 'F#', 'G', 'A', 'B'], root: 'C' },
  'F Lydian': { notes: ['F', 'G', 'A', 'B', 'C', 'D', 'E'], root: 'F' },
  'G Lydian': { notes: ['G', 'A', 'B', 'C#', 'D', 'E', 'F#'], root: 'G' },
  'C Mixolydian': { notes: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'], root: 'C' },
  'G Mixolydian': { notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F'], root: 'G' },
  'D Mixolydian': { notes: ['D', 'E', 'F#', 'G', 'A', 'B', 'C'], root: 'D' },
  'C Locrian': { notes: ['C', 'Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb'], root: 'C' },
  'B Locrian': { notes: ['B', 'C', 'D', 'E', 'F', 'G', 'A'], root: 'B' },
  'F# Locrian': { notes: ['F#', 'G', 'A', 'B', 'C', 'D', 'E'], root: 'F#' }
};

const pianoKeys = [
  { note: 'C', type: 'white' }, { note: 'C#', type: 'black' },
  { note: 'D', type: 'white' }, { note: 'D#', type: 'black' },
  { note: 'E', type: 'white' },
  { note: 'F', type: 'white' }, { note: 'F#', type: 'black' },
  { note: 'G', type: 'white' }, { note: 'G#', type: 'black' },
  { note: 'A', type: 'white' }, { note: 'A#', type: 'black' },
  { note: 'B', type: 'white' }
];

// Circle of Fifths - Professional music theory integration
const circleOfFifths = {
  majorKeys: ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'Ab', 'Eb', 'Bb', 'F'],
  minorKeys: ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Fm', 'Cm', 'Gm', 'Dm'],

  getRelatedKeys: (key: string) => {
    const index = circleOfFifths.majorKeys.indexOf(key);
    if (index === -1) return {};

    return {
      dominant: circleOfFifths.majorKeys[(index + 1) % 12], // Fifth up
      subdominant: circleOfFifths.majorKeys[(index + 11) % 12], // Fourth up
      relative_minor: circleOfFifths.minorKeys[index],
      secondary_dominant: circleOfFifths.majorKeys[(index + 2) % 12], // V/V
    };
  },

  getChordProgression: (key: string, type: 'classic' | 'jazz' | 'pop' | 'electronic') => {
    const index = circleOfFifths.majorKeys.indexOf(key);
    if (index === -1) return [];

    const progressions = {
      classic: [key, circleOfFifths.majorKeys[(index + 11) % 12], circleOfFifths.majorKeys[(index + 1) % 12], key], // I-IV-V-I
      jazz: [key, circleOfFifths.minorKeys[(index + 9) % 12], circleOfFifths.minorKeys[(index + 2) % 12], circleOfFifths.majorKeys[(index + 1) % 12]], // I-vi-ii-V
      pop: [key, circleOfFifths.minorKeys[(index + 9) % 12], circleOfFifths.majorKeys[(index + 11) % 12], circleOfFifths.majorKeys[(index + 1) % 12]], // I-vi-IV-V
      electronic: [circleOfFifths.minorKeys[index], circleOfFifths.majorKeys[(index + 11) % 12], circleOfFifths.majorKeys[index], circleOfFifths.majorKeys[(index + 1) % 12]], // vi-IV-I-V
    };

    return progressions[type] || progressions.classic;
  }
};

const snapSizes = [
  { value: 0.125, label: '32nd' },
  { value: 0.25, label: '16th' },
  { value: 0.5, label: '8th' },
  { value: 1, label: 'Quarter' },
  { value: 2, label: 'Half' }
];

export default function MelodyComposer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const realisticAudioRef = useRef<RealisticAudioEngine | null>(null);
  const isPlayingRef = useRef(false);

  // Basic state
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedTrack, setSelectedTrack] = useState('track1');
  const [showInstrumentBrowser, setShowInstrumentBrowser] = useState(false);
  const [instrumentFilter, setInstrumentFilter] = useState('all');
  const [selectedInstrumentCategory, setSelectedInstrumentCategory] = useState('piano');
  const [tracks, setTracks] = useState<Track[]>([
    { id: 'track1', name: 'Grand Piano', color: 'bg-blue-500', instrument: 'piano-grand', visible: true, muted: false, volume: 80 },
    { id: 'track2', name: 'Violin', color: 'bg-green-500', instrument: 'strings-violin', visible: true, muted: false, volume: 70 },
    { id: 'track3', name: 'Concert Flute', color: 'bg-purple-500', instrument: 'flute-concert', visible: true, muted: false, volume: 60 },
    { id: 'track4', name: 'Electric Bass', color: 'bg-orange-500', instrument: 'bass-electric', visible: true, muted: false, volume: 75 },
  ]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMelodyPlaying, setIsMelodyPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  // Musical settings
  const [scale, setScale] = useState('C Major');
  const [selectedNoteDuration, setSelectedNoteDuration] = useState<'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'>('quarter');
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [snapToScale, setSnapToScale] = useState(true);
  const [sustainEnabled, setSustainEnabled] = useState(false);
  const [useRealisticSounds, setUseRealisticSounds] = useState(true);

  // Circle of Fifths state - show by default
  const [showCircleOfFifths, setShowCircleOfFifths] = useState(true);
  const [selectedChordProgression, setSelectedChordProgression] = useState<'classic' | 'jazz' | 'pop' | 'electronic'>('classic');

  // Grid and interface settings
  const [gridSnapSize, setGridSnapSize] = useState(0.25);
  const [zoom, setZoom] = useState(1);
  const [masterVolume, setMasterVolume] = useState(70);
  const [tempo, setTempo] = useState(120);

  // Dialog and UI state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(true);
  const [aiComplexity, setAiComplexity] = useState([5]);
  const [aiStyle, setAiStyle] = useState('jazz');
  const [aiMood, setAiMood] = useState('happy');
  const [aiSongStructure, setAiSongStructure] = useState('pop');
  const [aiDensity, setAiDensity] = useState(5);
  const [songStructure, setSongStructure] = useState('verse');
  const [chordProgression, setChordProgression] = useState('I-V-vi-IV');
  const [customInstructions, setCustomInstructions] = useState('');
  const [aiVoiceLeading, setAiVoiceLeading] = useState('smooth');

  // Top toolbar state
  const [isTopBarMinimized, setIsTopBarMinimized] = useState(false);

  // Piano roll interaction state
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeNoteIndex, setResizeNoteIndex] = useState<number | null>(null);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // MIDI support
  const midiHook = useMIDI();

  // Metadata state
  const [metadata, setMetadata] = useState({
    title: '',
    artist: '',
    album: '',
    genre: '',
    key: '',
    timeSignature: '4/4',
    copyright: '',
    description: '',
    tags: ''
  });

  // Helper functions
  const getCurrentScaleNotes = () => {
    return MUSICAL_SCALES[scale as keyof typeof MUSICAL_SCALES]?.notes || ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  };

  // Helper function to get harmony notes (thirds above)
  const getHarmonyNote = (baseNote: string): string => {
    const noteMap: { [key: string]: string } = {
      'C': 'E', 'D': 'F', 'E': 'G', 'F': 'A', 'G': 'B', 'A': 'C', 'B': 'D'
    };
    return noteMap[baseNote] || 'E';
  };

  const getInstrumentRole = (instrument: string): string => {
    const roleMap: { [key: string]: string } = {
      'piano-grand': 'harmony',
      'piano-electric': 'melody',
      'strings-violin': 'melody',
      'strings-guitar': 'rhythm',
      'guitar-electric': 'lead',
      'bass-electric': 'bass',
      'bass-upright': 'bass',
      'flute-concert': 'melody',
      'horns-trumpet': 'melody',
      'synth-analog': 'lead',
      'pads-warm': 'texture',
      'timpani': 'percussion',
      'snare-drum': 'rhythm'
    };
    return roleMap[instrument] || 'harmony';
  };

  const getInstrumentRegister = (instrument: string): string => {
    const registerMap: { [key: string]: string } = {
      'piano-grand': 'mid',
      'strings-violin': 'high',
      'bass-electric': 'low',
      'bass-upright': 'low',
      'flute-concert': 'high',
      'horns-trumpet': 'high',
      'strings-cello': 'low',
      'timpani': 'low'
    };
    return registerMap[instrument] || 'mid';
  };

  const isNoteInScale = (noteName: string) => {
    if (!snapToScale) return true;
    return getCurrentScaleNotes().includes(noteName);
  };

  const getNoteDurationInBeats = (duration: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth') => {
    switch (duration) {
      case 'whole': return 4;
      case 'half': return 2;
      case 'quarter': return 1;
      case 'eighth': return 0.5;
      case 'sixteenth': return 0.25;
      default: return 1;
    }
  };

  // Initialize Professional Audio Engine
  useEffect(() => {
    const initAudio = async () => {
      if (!realisticAudioRef.current) {
        realisticAudioRef.current = new RealisticAudioEngine();
        try {
          await realisticAudioRef.current.initialize();
          console.log('🎵 Professional RealisticAudioEngine initialized!');

          // Load all instruments in background
          const allInstruments = [
            'piano-grand', 'piano-electric', 'piano-organ',
            'strings-guitar', 'guitar-electric', 'strings-violin', 
            'horns-trumpet', 'flute-concert', 'bass-electric', 
            'bass-upright', 'synth-analog', 'leads-square', 'pads-warm'
          ];

          console.log('🎵 Loading professional instruments...');
          // Audio engine will load instruments automatically
          console.log('✅ All professional instruments loaded!');

        } catch (error) {
          console.error('❌ Failed to initialize professional audio:', error);
        }
      }
    };

    initAudio();
  }, []);

  // Update master volume
  useEffect(() => {
    // Volume control handled by audio engine
  }, [masterVolume]);

  // Track management functions
  const addTrack = () => {
    if (tracks.length >= 8) return;

    const trackColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-cyan-500', 'bg-pink-500', 'bg-yellow-500'];
    const newId = `track${tracks.length + 1}`;

    const newTrack: Track = {
      id: newId,
      name: `Track ${tracks.length + 1}`,
      color: trackColors[tracks.length % trackColors.length],
      instrument: 'piano-grand',
      visible: true,
      muted: false,
      volume: 70
    };

    setTracks(prev => [...prev, newTrack]);
  };

  const updateTrackInstrument = (trackId: string, instrumentId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId 
        ? { 
            ...track, 
            instrument: instrumentId,
            name: Object.values(instrumentCategories)
              .flatMap(cat => cat.instruments)
              .find(inst => inst.id === instrumentId)?.name || track.name
          }
        : track
    ));
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, volume } : track
    ));
  };

  const toggleTrackMute = (trackId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, muted: !track.muted } : track
    ));
  };

  const toggleTrackVisibility = (trackId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, visible: !track.visible } : track
    ));
  };

  // Note editing functions
  const removeNote = (index: number) => {
    setNotes(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllNotes = () => {
    setNotes([]);
    setCurrentBeat(0);
    setIsPlaying(false);
    setIsMelodyPlaying(false);
  };

  // Piano roll interaction handlers
  const handlePianoRollMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;

    // Ignore right-clicks (button 2) - they're for deleting notes
    if (e.button === 2) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsMouseDown(true);
    setDragStartX(x);
    setDragStartY(y);

    // Calculate note and time position
    const timePosition = (x / rect.width) * (8 * zoom);
    const notePosition = Math.floor((1 - (y / rect.height)) * 48);
    const noteIndex = notePosition % 12;
    const octave = Math.floor(notePosition / 12) + 2;

    const noteName = pianoKeys[noteIndex].note;

    // Check if note is in scale (if snap to scale is enabled)
    if (snapToScale && !isNoteInScale(noteName)) {
      return; // Don't add notes outside the scale
    }

    // Snap to grid
    const snappedTime = Math.round(timePosition / gridSnapSize) * gridSnapSize;

    const newNote: Note = {
      note: noteName,
      octave: Math.max(1, Math.min(octave, 8)),
      duration: getNoteDurationInBeats(selectedNoteDuration),
      start: Math.max(0, snappedTime),
      track: selectedTrack,
      velocity: 80,
      noteDuration: selectedNoteDuration
    };

    setNotes(prev => [...prev, newNote]);

    // Play the note
    if (useRealisticSounds) {
      playNoteSound(newNote);
    }
  };

  const handlePianoRollMouseUp = () => {
    setIsMouseDown(false);
    setIsDragging(false);
    setIsResizing(false);
    setResizeNoteIndex(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || isResizing) return;

    const deltaX = Math.abs(e.clientX - dragStartX);
    const deltaY = Math.abs(e.clientY - dragStartY);

    if ((deltaX > 5 || deltaY > 5) && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, noteIndex: number) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeNoteIndex(noteIndex);
    setResizeStartWidth(notes[noteIndex].duration);
  };

  // Professional Audio Playback
  const playNoteSound = async (note: Note) => {
    if (!realisticAudioRef.current) return;

    const track = tracks.find(t => t.id === note.track);
    if (!track || track.muted) return;

    try {
      // Calculate professional volumes
      const masterVol = masterVolume / 100;
      const trackVol = track.volume / 100;
      const noteVel = (note.velocity || 80) / 127;
      const finalVolume = masterVol * trackVol * noteVel * 0.8;

      console.log(`🎵 Playing PROFESSIONAL ${note.note}${note.octave} on ${track.instrument} (${track.name}) vol=${finalVolume.toFixed(2)}`);

      // Use realistic instrument playback
      await realisticAudioRef.current.playNote(
        note.note, 
        note.octave, 
        note.duration, 
        track.instrument, 
        finalVolume,
        true // sustain enabled
      );

    } catch (error) {
      console.error('❌ Professional audio playback failed:', error);
    }
  };

  // Circle of Fifths helpers
  const getCurrentKeyRoot = () => {
    return scale.split(' ')[0]; // Extract root from "C Major" -> "C"
  };

  const getRelatedKeysForCurrentScale = () => {
    const root = getCurrentKeyRoot();
    return circleOfFifths.getRelatedKeys(root);
  };

  const generateChordProgression = () => {
    const root = getCurrentKeyRoot();
    const progression = circleOfFifths.getChordProgression(root, selectedChordProgression);

    // Chord mapping - proper intervals for major/minor chords
    const getChordNotes = (chordRoot: string) => {
      const baseNote = chordRoot.replace('m', '');
      const isMinor = chordRoot.includes('m');

      // Return proper triad (root, third, fifth)
      return [
        { note: baseNote, interval: 0 }, // Root
        { note: baseNote, interval: isMinor ? 3 : 4 }, // Minor 3rd or Major 3rd
        { note: baseNote, interval: 7 } // Perfect 5th
      ];
    };

    const chordNotes: Note[] = [];
    let startTime = 0;

    progression.forEach((chordRoot, chordIndex) => {
      const chordTones = getChordNotes(chordRoot);

      chordTones.forEach((tone, noteIndex) => {
        chordNotes.push({
          note: tone.note,
          octave: 4,
          duration: 1.5, // Dotted quarter note
          start: startTime + (noteIndex * 0.05), // Very slight stagger for realism
          track: selectedTrack,
          velocity: 65 + (noteIndex === 0 ? 10 : 0) // Root note slightly louder
        });
      });

      startTime += 2; // Each chord lasts 2 beats
    });

    // Clear existing notes and add new progression
    setNotes(prev => [...prev, ...chordNotes]);

    toast({
      title: "🎼 Chord Progression Added!",
      description: `${selectedChordProgression.toUpperCase()} progression in ${root} Major: ${progression.join(' → ')}`
    });

    // Auto-play the progression to hear it
    setTimeout(() => {
      if (useRealisticSounds && realisticAudioRef.current) {
        handlePlayMelody();
      }
    }, 200);
  };

  // Helper functions for audio
  const noteToFrequency = (note: string, octave: number): number => {
    const noteMap: { [key: string]: number } = {
      'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
      'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
      'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
    };

    const baseFreq = noteMap[note] || 440;
    return baseFreq * Math.pow(2, octave - 4);
  };

  const handlePlayMelody = () => {
    if (isMelodyPlaying) {
      stopMelody();
    } else {
      playMelody();
    }
  };

  // Real-time playback with visual cursor
  useEffect(() => {
    let animationFrame: number;

    if (isPlaying) {
      const updateCursor = () => {
        setCurrentBeat(prev => {
          const maxBeat = Math.max(...notes.map(n => n.start + n.duration), 8);
          const newBeat = prev + (tempo / 60) * 0.016; // ~60fps updates

          if (newBeat >= maxBeat) {
            setIsPlaying(false);
            setIsMelodyPlaying(false);
            return 0;
          }

          return newBeat;
        });

        if (isPlaying) {
          animationFrame = requestAnimationFrame(updateCursor);
        }
      };

      animationFrame = requestAnimationFrame(updateCursor);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, tempo, notes]);

  const playMelody = () => {
    if (!realisticAudioRef.current) return;

    setIsMelodyPlaying(true);
    setIsPlaying(true);
    setCurrentBeat(0);
    isPlayingRef.current = true;

    const beatDuration = 60 / tempo; // seconds per beat

    // Sort notes by start time
    const sortedNotes = [...notes].sort((a, b) => a.start - b.start);

    console.log(`🎵 Playing melody with ${sortedNotes.length} notes using PROFESSIONAL instruments!`);

    // Schedule all notes for real-time playback
    sortedNotes.forEach(note => {
      const track = tracks.find(t => t.id === note.track);
      if (!track || track.muted) return;

      setTimeout(() => {
        if (isPlayingRef.current) {
          playNoteSound(note);
        }
      }, (note.start * beatDuration) * 1000);
    });
  };

  const stopMelody = () => {
    setIsMelodyPlaying(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
  };

  const toggleRealisticSounds = () => {
    setUseRealisticSounds(!useRealisticSounds);
    toast({
      title: useRealisticSounds ? "Realistic sounds disabled" : "Realistic sounds enabled",
      description: useRealisticSounds ? "Using basic tones" : "Using realistic instrument sounds"
    });
  };

  // API mutations
  const generateMelodyMutation = useMutation({
    mutationFn: async () => {
      const selectedTrackData = tracks.find(t => t.id === selectedTrack);

      const response = await fetch('/api/melodies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scale,
          style: aiStyle,
          complexity: aiComplexity[0],
          mood: aiMood,
          scaleNotes: getCurrentScaleNotes(),
          scaleRoot: scale.split(' ')[0],
          beatsPerMeasure,
          noteDurations: ['whole', 'half', 'quarter', 'eighth', 'sixteenth'],
          gridSnapSize,
          tempo,
          masterVolume,
          availableTracks: tracks.map(t => ({
            id: t.id,
            name: t.name,
            instrument: t.instrument,
            volume: t.volume,
            muted: t.muted
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log('🎼 Professional melody generation response:', data);
      console.log('🔍 Data structure check:', {
        hasNotes: !!data?.notes,
        hasNotesNotes: !!data?.notes?.notes,
        notesType: typeof data?.notes,
        notesNotesType: typeof data?.notes?.notes,
        isNotesArray: Array.isArray(data?.notes),
        isNotesNotesArray: Array.isArray(data?.notes?.notes)
      });

      // Handle the AI response format - the API returns data.notes.notes
      let melodyNotes = [];
      let musicalAnalysis = null;

      if (data?.notes?.notes && Array.isArray(data.notes.notes)) {
        melodyNotes = data.notes.notes;
        musicalAnalysis = data.notes.musicalAnalysis;
        console.log('✅ Using data.notes.notes format');
      } else if (data?.notes && Array.isArray(data.notes)) {
        melodyNotes = data.notes;
        musicalAnalysis = data.musicalAnalysis;
        console.log('✅ Using data.notes format');
      } else if (Array.isArray(data)) {
        melodyNotes = data;
        console.log('✅ Using direct array format');
      } else {
        console.error('❌ Unexpected response format:', data);
        console.error('❌ Full data object:', JSON.stringify(data, null, 2));
      }

      console.log('🎵 Extracted professional melody notes:', melodyNotes);
      console.log('🎼 Music theory analysis:', musicalAnalysis);

      console.log('🎯 Final check - melodyNotes:', melodyNotes, 'length:', melodyNotes.length, 'isArray:', Array.isArray(melodyNotes));

      if (Array.isArray(melodyNotes) && melodyNotes.length > 0) {
        console.log('🎼 Processing', melodyNotes.length, 'notes...');
        
        // Create notes for multiple tracks to build a full arrangement
        const allNewNotes: any[] = [];
        
        // Process notes - they now come pre-assigned to specific tracks from AI
        melodyNotes.forEach((note: any, index: number) => {
          console.log(`🎵 Processing note ${index}:`, note);
          
          // Map AI track names to actual track IDs
          let assignedTrackId = selectedTrack; // Default fallback
          
          if (note.track) {
            // Try to find a track that matches the AI's track assignment
            const matchingTrack = tracks.find(t => 
              t.name.toLowerCase().includes(note.track.toLowerCase()) ||
              note.track.toLowerCase().includes(t.name.toLowerCase()) ||
              t.instrument.toLowerCase().includes(note.track.toLowerCase())
            );
            
            if (matchingTrack) {
              assignedTrackId = matchingTrack.id;
            } else {
              // Assign based on track role for multi-instrument arrangements
              if (note.track.toLowerCase() === 'melody') {
                assignedTrackId = tracks.find(t => t.name.toLowerCase().includes('piano') || t.name.toLowerCase().includes('lead'))?.id || tracks[0]?.id;
              } else if (note.track.toLowerCase() === 'bass') {
                assignedTrackId = tracks.find(t => t.name.toLowerCase().includes('bass') || t.instrument.toLowerCase().includes('bass'))?.id || tracks[1]?.id;
              } else if (note.track.toLowerCase() === 'harmony') {
                assignedTrackId = tracks.find(t => t.name.toLowerCase().includes('harmony') || t.name.toLowerCase().includes('chord'))?.id || tracks[2]?.id;
              } else if (note.track.toLowerCase() === 'rhythm') {
                assignedTrackId = tracks.find(t => t.name.toLowerCase().includes('rhythm') || t.name.toLowerCase().includes('drum'))?.id || tracks[3]?.id;
              }
            }
          }
          
          allNewNotes.push({
            note: note.note || 'C',
            octave: Math.max(2, Math.min(6, note.octave || 4)),
            duration: Math.max(0.125, Math.min(4, note.duration || 1)),
            start: Math.max(0, note.start || 0),
            track: assignedTrackId || selectedTrack || tracks[0]?.id,
            velocity: Math.max(30, Math.min(120, note.velocity || 80))
          });
        });
        
        const newNotes = allNewNotes;

        console.log('✅ Generated full arrangement with', newNotes.length, 'notes across', tracks.length, 'tracks');
        console.log('🎼 Track distribution:', newNotes.reduce((acc: any, note) => {
          const trackName = tracks.find(t => t.id === note.track)?.name || 'Unknown';
          acc[trackName] = (acc[trackName] || 0) + 1;
          return acc;
        }, {}));
        
        setNotes(prev => {
          const updatedNotes = [...prev, ...newNotes];
          console.log('🎵 Total notes in sequencer:', updatedNotes.length);
          return updatedNotes;
        });

        // Enhanced success message with music theory details
        const analysisDetails = musicalAnalysis ? 
          `\n🎼 Theory: ${musicalAnalysis.scaleUsage}\n🎵 Style: ${musicalAnalysis.styleElements}` : 
          '';

        toast({
          title: "🎵 Professional AI Melody Generated!",
          description: `Added ${newNotes.length} theory-based notes to ${tracks.find(t => t.id === selectedTrack)?.name}.${analysisDetails}`,
          className: "max-w-md"
        });

        // Auto-play the new professional melody
        setTimeout(() => {
          if (useRealisticSounds && realisticAudioRef.current) {
            handlePlayMelody();
          }
        }, 500);

      } else {
        console.error('❌ No valid notes in professional AI response:', data);
        toast({
          title: "❌ Professional Generation Failed", 
          description: "The AI composer could not generate a quality melody. Please try different settings or check your music theory parameters.",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error('Melody generation error:', error);
      toast({
        title: "Error generating melody",
        description: "Failed to generate melody. Please try again.",
        variant: "destructive"
      });
    }
  });

  const saveMelodyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/melodies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Melody ${new Date().toLocaleString()}`,
          notes,
          tracks,
          settings: {
            scale,
            tempo,
            beatsPerMeasure,
            zoom,
            masterVolume
          }
        })
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Melody saved successfully",
        description: "Your composition has been saved"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/melodies'] });
    },
    onError: () => {
      toast({
        title: "Error saving melody",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    if (notes.length === 0) {
      toast({
        title: "No notes to save",
        description: "Add some notes to your composition first",
        variant: "destructive"
      });
      return;
    }
    saveMelodyMutation.mutate();
  };

  const generateMelody = () => {
    generateMelodyMutation.mutate();
  };

  const scales = Object.keys(MUSICAL_SCALES);

  // Piano keyboard state
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [currentOctave, setCurrentOctave] = useState(4);
  const [chordMode, setChordMode] = useState(false);
  const [chordNotes, setChordNotes] = useState<Set<string>>(new Set());

  // Enhanced chord playing functionality
  const handleKeyPress = (noteName: string, octave: number) => {
    const noteKey = `${noteName}${octave}`;

    if (chordMode) {
      // In chord mode, add/remove notes from chord AND play immediately
      setChordNotes(prev => {
        const newChord = new Set(prev);
        if (newChord.has(noteKey)) {
          newChord.delete(noteKey);
        } else {
          newChord.add(noteKey);
          // Play the note when added to chord
          playPianoKey(noteName, octave);
        }
        return newChord;
      });

      // Visual feedback for chord building
      setPressedKeys(prev => new Set(Array.from(prev).concat(noteKey)));
      setTimeout(() => {
        setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(noteKey);
          return newSet;
        });
      }, 200);
    } else {
      // Normal mode - play immediately
      setPressedKeys(prev => new Set(Array.from(prev).concat(noteKey)));
      playPianoKey(noteName, octave);
    }
  };

  const handleKeyRelease = (noteName: string, octave: number) => {
    const noteKey = `${noteName}${octave}`;

    if (!chordMode) {
      // Only auto-release in normal mode
      setTimeout(() => {
        setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(noteKey);
          return newSet;
        });
      }, 200);
    }
  };

  // Play the built chord
  const playChord = () => {
    if (chordNotes.size === 0) return;

    // Visual feedback - show all chord notes as pressed
    setPressedKeys(new Set(chordNotes));

    // Play all notes in the chord simultaneously
    chordNotes.forEach(noteKey => {
      const noteName = noteKey.slice(0, -1);
      const octave = parseInt(noteKey.slice(-1));
      playPianoKey(noteName, octave);
    });

    // Clear visual feedback after a moment
    setTimeout(() => {
      setPressedKeys(new Set());
    }, 500);
  };

  // Auto-play chord when it reaches 3 or more notes
  useEffect(() => {
    if (chordMode && chordNotes.size >= 3) {
      // Small delay to let the individual note play first
      setTimeout(() => {
        playChord();
      }, 100);
    }
  }, [chordNotes.size]);

  // Clear the chord
  const clearChord = () => {
    setChordNotes(new Set());
    setPressedKeys(new Set());
  };

  // Piano key functions
  const playPianoKey = (noteName: string, octave: number) => {
    const noteKey = `${noteName}${octave}`;

    // Play sound
    const note: Note = {
      note: noteName,
      octave,
      duration: getNoteDurationInBeats(selectedNoteDuration),
      start: currentBeat,
      track: selectedTrack,
      velocity: 80
    };
    playNoteSound(note);

    // Add to piano roll if sustain is enabled
    if (sustainEnabled) {
      setNotes(prev => [...prev, {
        ...note,
        start: Math.round(currentBeat / gridSnapSize) * gridSnapSize
      }]);
    }
  };

  const renderPianoKey = (noteName: string, isBlack: boolean, index: number, octave: number = currentOctave) => {
    const noteKey = `${noteName}${octave}`;
    const isPressed = pressedKeys.has(noteKey);
    const isInCurrentScale = isNoteInScale(noteName);
    const isCurrentOctaveKey = octave === currentOctave;

    return (
      <button
        key={`${noteName}-${currentOctave}`}
        className={`
          ${isBlack 
            ? `w-6 h-20 bg-black border border-gray-900 text-white rounded-b-md z-10 shadow-lg
               hover:bg-gray-900 active:bg-gray-800 
               ${isPressed ? 'bg-gray-700 shadow-inner' : ''}
               ${!isInCurrentScale && snapToScale ? 'opacity-30 cursor-not-allowed' : ''}`
            : `w-6 h-32 bg-gray-50 border border-gray-400 text-gray-900 rounded-b-lg shadow-md
               hover:bg-white active:bg-gray-200 
               ${isPressed ? 'bg-gray-300 shadow-inner' : ''}
               ${!isInCurrentScale && snapToScale ? 'opacity-30 cursor-not-allowed' : ''}`
          }
          transition-colors duration-100 select-none relative
          ${isInCurrentScale ? (isBlack ? 'shadow-lg shadow-blue-400/60' : 'shadow-lg shadow-blue-500/40') : ''}
          ${isCurrentOctaveKey ? 'ring-2 ring-yellow-400 ring-opacity-60' : ''}
        `}
        style={isBlack ? {
          left: `${(index * 48) - (index > 2 ? 8 : 0) - (index > 6 ? 8 : 0)}px`
        } : {}}
        onMouseDown={(e) => {
          e.preventDefault();
          if (!snapToScale || isInCurrentScale) {
            handleKeyPress(noteName, octave);
          }
        }}
        onMouseUp={() => handleKeyRelease(noteName, octave)}
        onMouseLeave={() => handleKeyRelease(noteName, octave)}
        onContextMenu={(e) => e.preventDefault()} // Prevent right-click menu for smoother chord playing
        disabled={snapToScale && !isInCurrentScale}
      >
        <div className={`
          absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs
          ${isBlack ? 'text-gray-300' : 'text-gray-600'}
        `}>
          {isBlack ? '' : noteName}
          <div className="text-xs opacity-60">{isCurrentOctaveKey ? octave : ''}</div>
        </div>

        {/* Show octave number on first key of each octave */}
        {noteName === 'C' && (
          <div className={`absolute top-1 left-1 text-xs font-bold ${isBlack ? 'text-blue-300' : 'text-blue-600'}`}>
            {octave}
          </div>
        )}

        {isInCurrentScale && (
          <div className={`
            absolute top-1 right-1 w-1.5 h-1.5 rounded-full
            ${isBlack ? 'bg-blue-400' : 'bg-blue-500'}
          `} title="In current scale" />
        )}
      </button>
    );
  };

  return (
    <div className="h-screen bg-studio-dark flex flex-col overflow-hidden">
      {/* Collapsible Top Toolbar */}
      <div className="border-b border-gray-600 bg-studio-panel">
        {/* Always visible minimize bar */}
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsTopBarMinimized(!isTopBarMinimized)}
              className="h-6 px-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <i className={`fas ${isTopBarMinimized ? 'fa-chevron-down' : 'fa-chevron-up'} mr-1`}></i>
              {isTopBarMinimized ? 'Expand' : 'Minimize'}
            </Button>
            <h2 className="text-sm font-semibold text-gray-200 flex items-center">
              <i className="fas fa-music mr-1 text-studio-accent text-sm"></i>
              Melody Composer
            </h2>
            {isTopBarMinimized && (
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <span>Scale: {scale}</span>
                <span>•</span>
                <span>{notes.length} notes</span>
                <span>•</span>
                <span>{tempo} BPM</span>
              </div>
            )}
          </div>

          {/* Essential controls always visible */}
          <div className="flex items-center space-x-2">
            <Button onClick={handlePlayMelody} size="sm" className="h-6 px-2 text-xs bg-studio-success hover:bg-green-500">
              <i className={`fas ${isMelodyPlaying ? "fa-pause" : "fa-play"} mr-1`}></i>
              {isMelodyPlaying ? "Stop" : "Play"}
            </Button>

            <Button
              onClick={generateMelody}
              disabled={generateMelodyMutation.isPending}
              size="sm"
              className="h-6 px-2 text-xs bg-studio-accent hover:bg-blue-500"
            >
              {generateMelodyMutation.isPending ? (
                <i className="fas fa-spinner animate-spin"></i>
              ) : (
                <i className="fas fa-magic"></i>
              )}
            </Button>
          </div>
        </div>

        {/* Expandable controls section */}
        {!isTopBarMinimized && (
          <div className="p-2 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1">
                  <label className="text-gray-400">Scale:</label>
                  <Select value={scale} onValueChange={setScale}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80 overflow-y-auto">
                      <div className="p-2 font-semibold text-green-400 border-b border-gray-600">Major</div>
                      {scales.filter(s => s.includes('Major') && !s.includes('Pentatonic')).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                      <div className="p-2 font-semibold text-purple-400 border-b border-gray-600">Minor</div>
                      {scales.filter(s => s.includes('Minor') && !s.includes('Pentatonic')).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                      <div className="p-2 font-semibold text-blue-400 border-b border-gray-600">Pentatonic</div>
                      {scales.filter(s => s.includes('Pentatonic')).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                      <div className="p-2 font-semibold text-orange-400 border-b border-gray-600">Blues</div>
                      {scales.filter(s => s.includes('Blues')).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                      <div className="p-2 font-semibold text-yellow-400 border-b border-gray-600">Modal</div>
                      {scales.filter(s => ['Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Locrian'].some(mode => s.includes(mode))).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-1">
                  <label className="text-gray-400">Duration:</label>
                  <Select value={selectedNoteDuration} onValueChange={(value: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth') => setSelectedNoteDuration(value)}>
                    <SelectTrigger className="w-20 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whole">🎵 Whole</SelectItem>
                      <SelectItem value="half">♩ Half</SelectItem>
                      <SelectItem value="quarter">♪ Quarter</SelectItem>
                      <SelectItem value="eighth">♫ Eighth</SelectItem>
                      <SelectItem value="sixteenth">♬ 16th</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-1">
                  <label className="text-gray-400">Time:</label>
                  <Select value={String(beatsPerMeasure)} onValueChange={(value) => setBeatsPerMeasure(Number(value))}>
                    <SelectTrigger className="w-14 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3/4</SelectItem>
                      <SelectItem value="4">4/4</SelectItem>
                      <SelectItem value="6">6/8</SelectItem>
                      <SelectItem value="7">7/8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-1">
                  <label className="text-gray-400">Lock:</label>
                  <Button
                    size="sm"
                    variant={snapToScale ? "default" : "outline"}
                    onClick={() => setSnapToScale(!snapToScale)}
                    className={`h-6 px-2 text-xs ${snapToScale ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
                    title="Only allow notes from selected scale"
                  >
                    {snapToScale ? "ON" : "OFF"}
                  </Button>
                </div>

                <div className="flex items-center space-x-1">
                  <label className="text-gray-400">Sustain:</label>
                  <Button
                    size="sm"
                    variant={sustainEnabled ? "default" : "outline"}
                    onClick={() => setSustainEnabled(!sustainEnabled)}
                    className={`h-6 px-2 text-xs ${sustainEnabled ? 'bg-studio-accent hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
                  >
                    {sustainEnabled ? "ON" : "OFF"}
                  </Button>
                </div>

                <div className="flex items-center space-x-1">
                  <label className="text-gray-400">Realistic:</label>
                  <Button
                    size="sm"
                    variant={useRealisticSounds ? "default" : "outline"}
                    onClick={toggleRealisticSounds}
                    className={`h-6 px-2 text-xs ${useRealisticSounds ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
                  >
                    {useRealisticSounds ? "ON" : "OFF"}
                  </Button>
                </div>

                {/* Circle of Fifths Controls - Compact */}
                <div className="flex items-center space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCircleOfFifths(!showCircleOfFifths)}
                    className={`h-6 px-2 text-xs ${showCircleOfFifths ? 'bg-purple-500 border-purple-400' : 'bg-purple-600 border-purple-500'} hover:bg-purple-400 text-white`}
                    data-testid="toggle-circle-of-fifths"
                  >
                    🎼 {showCircleOfFifths ? 'Hide' : 'Show'}
                  </Button>

                  <Select value={selectedChordProgression} onValueChange={(value: 'classic' | 'jazz' | 'pop' | 'electronic') => setSelectedChordProgression(value)}>
                    <SelectTrigger className="w-20 h-6 text-xs bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="classic">I-IV-V-I</SelectItem>
                      <SelectItem value="jazz">I-vi-ii-V</SelectItem>
                      <SelectItem value="pop">I-vi-IV-V</SelectItem>
                      <SelectItem value="electronic">vi-IV-I-V</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    onClick={generateChordProgression}
                    className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                    data-testid="add-chord-progression"
                  >
                    ✨ Add
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <Button
                    onClick={() => {
                      setCurrentBeat(0);
                      setIsPlaying(false);
                      setIsMelodyPlaying(false);
                    }}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs bg-gray-600 hover:bg-gray-500"
                  >
                    <i className="fas fa-stop mr-1"></i>
                    Reset
                  </Button>

                  <div className="text-xs text-gray-400 font-mono px-2">
                    {currentBeat.toFixed(1)} / {Math.max(...notes.map(n => n.start + n.duration), 8).toFixed(1)} beats
                  </div>
                </div>

                <Button
                  onClick={clearAllNotes}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white border-red-600"
                >
                  <i className="fas fa-trash mr-1"></i>
                  Clear
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={saveMelodyMutation.isPending}
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                >
                  <i className="fas fa-save mr-1"></i>
                  Save
                </Button>

                {/* Metadata Button */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-blue-600 hover:bg-blue-500 text-white border-blue-600" data-testid="button-metadata">
                      <i className="fas fa-tags mr-2"></i>
                      Metadata
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 border-gray-600 text-white max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-gray-200">
                        <i className="fas fa-tags mr-2"></i>
                        Song Metadata
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-300">Title</Label>
                          <Input
                            value={metadata.title}
                            onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                            placeholder="Song Title"
                            className="bg-gray-700 border-gray-600 text-white"
                            data-testid="input-metadata-title"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-300">Artist</Label>
                          <Input
                            value={metadata.artist}
                            onChange={(e) => setMetadata({...metadata, artist: e.target.value})}
                            placeholder="Artist Name"
                            className="bg-gray-700 border-gray-600 text-white"
                            data-testid="input-metadata-artist"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-300">Album</Label>
                          <Input
                            value={metadata.album}
                            onChange={(e) => setMetadata({...metadata, album: e.target.value})}
                            placeholder="Album Name"
                            className="bg-gray-700 border-gray-600 text-white"
                            data-testid="input-metadata-album"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-300">Genre</Label>
                          <Select value={metadata.genre} onValueChange={(value) => setMetadata({...metadata, genre: value})}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white" data-testid="select-metadata-genre">
                              <SelectValue placeholder="Select Genre" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-600">
                              <SelectItem value="pop">Pop</SelectItem>
                              <SelectItem value="rock">Rock</SelectItem>
                              <SelectItem value="jazz">Jazz</SelectItem>
                              <SelectItem value="classical">Classical</SelectItem>
                              <SelectItem value="electronic">Electronic</SelectItem>
                              <SelectItem value="hip-hop">Hip Hop</SelectItem>
                              <SelectItem value="country">Country</SelectItem>
                              <SelectItem value="folk">Folk</SelectItem>
                              <SelectItem value="blues">Blues</SelectItem>
                              <SelectItem value="reggae">Reggae</SelectItem>
                              <SelectItem value="ambient">Ambient</SelectItem>
                              <SelectItem value="experimental">Experimental</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-300">Key</Label>
                          <Input
                            value={metadata.key}
                            onChange={(e) => setMetadata({...metadata, key: e.target.value})}
                            placeholder="e.g., C Major, A Minor"
                            className="bg-gray-700 border-gray-600 text-white"
                            data-testid="input-metadata-key"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-300">Time Signature</Label>
                          <Select value={metadata.timeSignature} onValueChange={(value) => setMetadata({...metadata, timeSignature: value})}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white" data-testid="select-metadata-time">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-600">
                              <SelectItem value="4/4">4/4</SelectItem>
                              <SelectItem value="3/4">3/4</SelectItem>
                              <SelectItem value="6/8">6/8</SelectItem>
                              <SelectItem value="2/4">2/4</SelectItem>
                              <SelectItem value="7/8">7/8</SelectItem>
                              <SelectItem value="5/4">5/4</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-gray-300">Copyright</Label>
                        <Input
                          value={metadata.copyright}
                          onChange={(e) => setMetadata({...metadata, copyright: e.target.value})}
                          placeholder="© 2025 Artist Name"
                          className="bg-gray-700 border-gray-600 text-white"
                          data-testid="input-metadata-copyright"
                        />
                      </div>

                      <div>
                        <Label className="text-gray-300">Description</Label>
                        <Input
                          value={metadata.description}
                          onChange={(e) => setMetadata({...metadata, description: e.target.value})}
                          placeholder="Brief description of the song"
                          className="bg-gray-700 border-gray-600 text-white"
                          data-testid="input-metadata-description"
                        />
                      </div>

                      <div>
                        <Label className="text-gray-300">Tags</Label>
                        <Input
                          value={metadata.tags}
                          onChange={(e) => setMetadata({...metadata, tags: e.target.value})}
                          placeholder="ambient, peaceful, instrumental (comma separated)"
                          className="bg-gray-700 border-gray-600 text-white"
                          data-testid="input-metadata-tags"
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="outline" className="bg-gray-600 hover:bg-gray-500 text-white border-gray-600">
                          Clear All
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-500 text-white">
                          Save Metadata
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Settings Button */}
                <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-gray-600 hover:bg-gray-500 text-white border-gray-600">
                      <i className="fas fa-cog mr-2"></i>
                      Settings
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 border-gray-600 text-white max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-gray-200">
                        <i className="fas fa-cog mr-2"></i>
                        Melody Composer Settings
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">

                      {/* Tempo Setting */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-300">
                          Tempo: {tempo} BPM
                        </Label>
                        <Slider
                          value={[tempo]}
                          onValueChange={(value) => setTempo(value[0])}
                          min={60}
                          max={200}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>60 BPM</span>
                          <span>200 BPM</span>
                        </div>
                      </div>

                      {/* Master Volume */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-300">
                          Master Volume: {masterVolume}%
                        </Label>
                        <Slider
                          value={[masterVolume]}
                          onValueChange={(value) => setMasterVolume(value[0])}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* Grid Snap Size */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-300">Grid Snap Size</Label>
                        <Select value={gridSnapSize.toString()} onValueChange={(value) => setGridSnapSize(parseFloat(value))}>
                          <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-700 border-gray-600">
                            <SelectItem value="0.125">32nd Note</SelectItem>
                            <SelectItem value="0.25">16th Note</SelectItem>
                            <SelectItem value="0.5">8th Note</SelectItem>
                            <SelectItem value="1">Quarter Note</SelectItem>
                            <SelectItem value="2">Half Note</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Zoom Level */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-300">
                          Zoom Level: {zoom}x
                        </Label>
                        <Slider
                          value={[zoom]}
                          onValueChange={(value) => setZoom(value[0])}
                          min={0.5}
                          max={4}
                          step={0.25}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>0.5x</span>
                          <span>4x</span>
                        </div>
                      </div>

                      {/* Professional AI Settings */}
                      <div className="space-y-4 bg-gray-900 p-3 rounded border border-purple-500/30">
                        <Label className="text-sm font-medium text-purple-300">Professional AI Composer</Label>

                        {/* Musical Style */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">Musical Style</Label>
                          <Select value={aiStyle} onValueChange={setAiStyle}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600">
                              <SelectItem value="jazz">Jazz</SelectItem>
                              <SelectItem value="classical">Classical</SelectItem>
                              <SelectItem value="electronic">Electronic</SelectItem>
                              <SelectItem value="pop">Pop</SelectItem>
                              <SelectItem value="rock">Rock</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Musical Mood */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">Musical Mood</Label>
                          <Select value={aiMood} onValueChange={setAiMood}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600">
                              <SelectItem value="happy">Happy</SelectItem>
                              <SelectItem value="melancholy">Melancholy</SelectItem>
                              <SelectItem value="energetic">Energetic</SelectItem>
                              <SelectItem value="chill">Chill</SelectItem>
                              <SelectItem value="dramatic">Dramatic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* AI Complexity Setting */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">
                            Complexity: {aiComplexity[0]}/10
                          </Label>
                          <Slider
                            value={aiComplexity}
                            onValueChange={setAiComplexity}
                            min={1}
                            max={10}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Simple</span>
                            <span>Virtuosic</span>
                          </div>
                        </div>

                        {/* Song Structure Control */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">Song Structure</Label>
                          <Select value={aiSongStructure || 'pop'} onValueChange={setAiSongStructure}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600">
                              <SelectItem value="pop">Pop (Verse-Chorus)</SelectItem>
                              <SelectItem value="jazz">Jazz (Head-Solo-Head)</SelectItem>
                              <SelectItem value="classical">Classical (Sonata Form)</SelectItem>
                              <SelectItem value="blues">Blues (12-Bar Form)</SelectItem>
                              <SelectItem value="aba">ABA Form</SelectItem>
                              <SelectItem value="rondo">Rondo (ABACA)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Arrangement Density */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">
                            Arrangement Density: {aiDensity || 5}/10
                          </Label>
                          <Slider
                            value={[aiDensity || 5]}
                            onValueChange={(value) => setAiDensity(value[0])}
                            min={1}
                            max={10}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Minimal</span>
                            <span>Dense</span>
                          </div>
                        </div>

                        {/* Voice Leading Quality */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">Voice Leading</Label>
                          <Select value={aiVoiceLeading || 'smooth'} onValueChange={setAiVoiceLeading}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600">
                              <SelectItem value="smooth">Smooth (Step-wise)</SelectItem>
                              <SelectItem value="angular">Angular (Large jumps)</SelectItem>
                              <SelectItem value="chromatic">Chromatic</SelectItem>
                              <SelectItem value="quartal">Quartal Harmony</SelectItem>
                              <SelectItem value="modal">Modal Movement</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Toggle Settings */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-gray-300">Metronome</Label>
                          <Button
                            size="sm"
                            variant={metronomeEnabled ? "default" : "outline"}
                            onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                            className={`${metronomeEnabled ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
                          >
                            {metronomeEnabled ? "ON" : "OFF"}
                          </Button>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-gray-300">Auto-Save</Label>
                          <Button
                            size="sm"
                            variant={autoSaveEnabled ? "default" : "outline"}
                            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                            className={`${autoSaveEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
                          >
                            {autoSaveEnabled ? "ON" : "OFF"}
                          </Button>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-gray-300">Keyboard Shortcuts</Label>
                          <Button
                            size="sm"
                            variant={keyboardShortcutsEnabled ? "default" : "outline"}
                            onClick={() => setKeyboardShortcutsEnabled(!keyboardShortcutsEnabled)}
                            className={`${keyboardShortcutsEnabled ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
                          >
                            {keyboardShortcutsEnabled ? "ON" : "OFF"}
                          </Button>
                        </div>
                      </div>

                      {/* Keyboard Shortcuts Info */}
                      {keyboardShortcutsEnabled && (
                        <div className="pt-4 border-t border-gray-600">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            <i className="fas fa-keyboard mr-1"></i>
                            Keyboard Shortcuts
                          </h4>
                          <div className="text-xs text-gray-400 space-y-1">
                            <div><kbd className="px-1 bg-gray-700 rounded">Space</kbd> - Play/Pause</div>
                            <div><kbd className="px-1 bg-gray-700 rounded">Ctrl+S</kbd> - Save Project</div>
                            <div><kbd className="px-1 bg-gray-700 rounded">Ctrl+R</kbd> - AI Compose</div>
                            <div><kbd className="px-1 bg-gray-700 rounded">Shift+Del</kbd> - Clear All</div>
                          </div>
                        </div>
                      )}

                      {/* Settings Info */}
                      <div className="pt-4 border-t border-gray-600">
                        <p className="text-xs text-gray-400">
                          <i className="fas fa-info-circle mr-1"></i>
                          Settings are automatically saved locally. 
                          Tempo affects AI composition speed. 
                          Grid snap controls note placement precision.
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 p-6">
        {/* Multi-Track Studio Interface */}
        <div className="space-y-4">
          {/* Timeline Header */}
          <div className="flex bg-studio-panel border border-gray-600 rounded-lg">
            {/* Track Controls Header - Compact */}
            <div className="w-64 p-2 border-r border-gray-600">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-200">Track Mixer</h3>
                <Button size="sm" onClick={addTrack} disabled={tracks.length >= 8} className="h-6 px-2 text-xs">
                  <i className="fas fa-plus mr-1"></i>
                  Add
                </Button>
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {tracks.length}/8 tracks • {notes.length} notes
              </div>
            </div>

            {/* Timeline Ruler */}
            <div className="flex-1 p-3">
              <div className="relative h-8 bg-gray-800 rounded border border-gray-700">
                {/* Beat markers */}
                {Array(Math.floor(32 * zoom)).fill(0).map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 flex flex-col justify-between">
                    <div 
                      className={`w-px ${i % 4 === 0 ? 'bg-gray-400 h-full' : 'bg-gray-600 h-2'}`}
                      style={{ left: `${(i / (32 * zoom)) * 100}%` }}
                    />
                    {i % 4 === 0 && (
                      <span className="text-xs text-gray-400 absolute -top-5 -left-2">
                        {Math.floor(i / 4) + 1}
                      </span>
                    )}
                  </div>
                ))}

                {/* Playback position indicator */}
                {(isPlaying || currentBeat > 0) && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${(currentBeat / (8 * zoom)) * 100}%` }}
                  >
                    <div className="absolute -top-2 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Track Lanes - Multi-Track Studio Layout */}
          {tracks.map((track) => {
            const trackNotes = notes.filter(n => n.track === track.id);
            const currentInstrument = Object.values(instrumentCategories)
              .flatMap(cat => cat.instruments)
              .find(inst => inst.id === track.instrument);

            return (
              <div key={track.id} className={`flex bg-studio-panel border rounded-lg overflow-hidden ${
                selectedTrack === track.id ? 'border-studio-accent shadow-lg' : 'border-gray-600'
              }`}>
                {/* Track Control Strip - Compact */}
                <div className="w-64 p-2 border-r border-gray-600 bg-gray-800">
                  {/* Track Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded ${track.color}`}></div>
                      <div className="text-sm">{currentInstrument?.icon || '🎵'}</div>
                      <div>
                        <div className="text-xs font-medium text-white">{track.name}</div>
                        <Select 
                          value={track.instrument} 
                          onValueChange={(newInstrument) => updateTrackInstrument(track.id, newInstrument)}
                        >
                          <SelectTrigger className="w-28 h-5 text-xs bg-gray-700 border-gray-600 text-gray-300">
                            <SelectValue placeholder="Instrument" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-700 border-gray-600 max-h-60 overflow-y-auto">
                            {/* Piano & Keys */}
                            <SelectItem value="piano-grand">🎹 Grand Piano</SelectItem>
                            <SelectItem value="piano-electric">🎹 Electric Piano</SelectItem>
                            <SelectItem value="piano-organ">⛪ Organ</SelectItem>

                            {/* Strings */}
                            <SelectItem value="strings-guitar">🎸 Acoustic Guitar</SelectItem>
                            <SelectItem value="guitar-electric">⚡ Electric Guitar</SelectItem>
                            <SelectItem value="strings-violin">🎻 Violin</SelectItem>

                            {/* Brass & Wind */}
                            <SelectItem value="horns-trumpet">🎺 Trumpet</SelectItem>
                            <SelectItem value="flute-concert">🪈 Flute</SelectItem>

                            {/* Bass */}
                            <SelectItem value="bass-electric">🎸 Electric Bass</SelectItem>
                            <SelectItem value="bass-upright">🎻 Upright Bass</SelectItem>

                            {/* Synth */}
                            <SelectItem value="synth-analog">🎛️ Analog Synth</SelectItem>
                            <SelectItem value="leads-square">⚡ Square Lead</SelectItem>
                            <SelectItem value="pads-warm">🌊 Warm Pad</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => toggleTrackMute(track.id)}
                        className={`w-5 h-5 rounded text-xs ${
                          track.muted ? 'bg-red-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                        }`}
                        title={track.muted ? 'Unmute' : 'Mute'}
                      >
                        <i className={`fas ${track.muted ? 'fa-volume-mute' : 'fa-volume-up'} text-xs`}></i>
                      </button>
                      <button
                        onClick={() => setSelectedTrack(track.id)}
                        className={`w-5 h-5 rounded text-xs ${
                          selectedTrack === track.id ? 'bg-studio-accent text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                        }`}
                        title="Select for editing"
                      >
                        <i className="fas fa-edit text-xs"></i>
                      </button>
                    </div>
                  </div>

                  {/* Volume Control - Compact */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">VOL</span>
                      <span className="text-xs font-mono text-white">{track.volume}%</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Slider
                        value={[track.volume]}
                        onValueChange={(value) => updateTrackVolume(track.id, value[0])}
                        min={0}
                        max={100}
                        step={1}
                        className="flex-1 h-2"
                      />
                      {/* VU Meter - Smaller */}
                      <div className="flex space-x-px">
                        {Array.from({length: 8}, (_, i) => (
                          <div 
                            key={i}
                            className={`w-0.5 h-4 ${
                              track.volume > (i * 12.5)
                                ? i >= 6 ? 'bg-red-500' : i >= 4 ? 'bg-yellow-500' : 'bg-green-500'
                                : 'bg-gray-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Track Stats - Compact */}
                  <div className="mt-2 p-1 bg-gray-900 rounded text-xs font-mono">
                    <div className="flex justify-between text-gray-400">
                      <span>NOTES:</span>
                      <span className="text-blue-400">{trackNotes.length}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>STATUS:</span>
                      <span className={track.muted ? 'text-red-400' : 'text-green-400'}>
                        {track.muted ? 'MUTED' : 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Track Timeline Area - Shorter */}
                <div 
                  className="flex-1 h-12 bg-gray-900 relative cursor-crosshair overflow-hidden"
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const timePosition = (x / rect.width) * (8 * zoom);

                    if (selectedTrack === track.id) {
                      // Add note at clicked position with selected duration
                      const newNote: Note = {
                        note: 'C',
                        octave: 4,
                        duration: getNoteDurationInBeats(selectedNoteDuration),
                        start: Math.round(timePosition / gridSnapSize) * gridSnapSize,
                        track: track.id,
                        velocity: 80
                      };
                      setNotes(prev => [...prev, newNote]);
                      playNoteSound(newNote);
                    } else {
                      setSelectedTrack(track.id);
                    }
                  }}
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 pointer-events-none">
                    {Array(Math.floor(32 * zoom)).fill(0).map((_, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 w-px ${
                          i % 4 === 0 ? 'bg-gray-600' : 'bg-gray-700'
                        }`}
                        style={{ left: `${(i / (32 * zoom)) * 100}%` }}
                      />
                    ))}
                  </div>

                  {/* Track Notes/Regions - Smaller and more precise */}
                  {trackNotes.map((note, index) => {
                    const noteIndex = notes.findIndex(n => n === note);
                    return (
                      <div
                        key={index}
                        className={`absolute rounded cursor-pointer hover:opacity-80 group ${
                          track.color
                        } opacity-90 flex items-center px-1 border border-gray-700`}
                        style={{
                          left: `${(note.start / (8 * zoom)) * 100}%`,
                          width: `${Math.max((note.duration / (8 * zoom)) * 100, 3)}%`,
                          top: '2px',
                          height: 'calc(100% - 4px)',
                          minWidth: '20px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNote(noteIndex);
                        }}
                        title={`${note.note}${note.octave} - ${note.duration.toFixed(2)}s - Click to delete`}
                      >
                        <span className="text-xs font-medium text-white truncate">
                          {note.note}{note.octave}
                        </span>

                        {/* Right-click indicator - visible on hover */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 bg-white bg-opacity-30 cursor-ew-resize hover:bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsResizing(true);
                            setResizeNoteIndex(noteIndex);
                            setResizeStartWidth(note.duration);
                          }}
                          title="Drag to resize note"
                        />
                      </div>
                    );
                  })}

                  {/* Real-time playback cursor for this track */}
                  {(isPlaying || currentBeat > 0) && (
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                      style={{ left: `${(currentBeat / (8 * zoom)) * 100}%` }}
                    >
                      <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                  )}

                  {/* Track selection overlay */}
                  {selectedTrack === track.id && (
                    <div className="absolute inset-0 border-2 border-studio-accent pointer-events-none rounded">
                      <div className="absolute top-1 left-1 text-xs bg-studio-accent text-white px-1 rounded">
                        EDITING
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-Time Piano Keyboard - Compact */}
        <div className="mt-4 bg-studio-panel border border-gray-600 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <h3 className="text-sm font-medium text-gray-200 flex items-center">
                <i className="fas fa-keyboard mr-1 text-studio-accent"></i>
                Piano Keyboard
              </h3>
              <div className="flex items-center space-x-1">
                <label className="text-xs text-gray-400">Octave:</label>
                <div className="flex space-x-1">
                  {[2, 3, 4, 5, 6].map(octave => (
                    <button
                      key={octave}
                      onClick={() => setCurrentOctave(octave)}
                      className={`px-2 py-1 text-xs rounded ${
                        currentOctave === octave 
                          ? 'bg-studio-accent text-white' 
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {octave}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs text-gray-400">
              <div className="flex items-center space-x-2">
                <span>Scale Lock:</span>
                <span className={snapToScale ? 'text-green-400' : 'text-red-400'}>
                  {snapToScale ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Sustain:</span>
                <span className={sustainEnabled ? 'text-green-400' : 'text-red-400'}>
                  {sustainEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              {chordMode && (
                <div className="flex items-center space-x-3 text-purple-400 font-semibold">
                  <span>🎼 CHORD BUILD:</span>
                  <span>{chordNotes.size} notes</span>
                  <Button
                    size="sm"
                    onClick={playChord}
                    disabled={chordNotes.size === 0}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1"
                  >
                    ▶️ Play
                  </Button>
                  <Button
                    size="sm"
                    onClick={clearChord}
                    disabled={chordNotes.size === 0}
                    variant="outline"
                    className="px-3 py-1"
                  >
                    🗑️ Clear
                  </Button>
                </div>
              )}
              {pressedKeys.size > 1 && !chordMode && (
                <div className="flex items-center space-x-2 text-purple-400 font-semibold">
                  <span>🎹 CHORD:</span>
                  <span>{pressedKeys.size} keys</span>
                </div>
              )}
              <div>{chordMode ? 'Click keys to build chord • Plays individual notes + full chord at 3+ notes' : 'Click keys to play • Notes auto-add when Sustain is ON'}</div>
            </div>
          </div>

          {/* Full Piano Keyboard - Compact */}
          <div className="relative bg-gray-100 p-2 rounded-lg border border-gray-300 overflow-x-auto">
            <div className="relative" style={{ height: '100px', minWidth: '1000px' }}>

              {/* White keys across all octaves */}
              <div className="flex absolute top-0 left-0">
                {[2, 3, 4, 5, 6].map(octave => (
                  ['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((note, noteIndex) => {
                    const globalIndex = (octave - 2) * 7 + noteIndex;
                    return (
                      <button
                        key={`white-${note}${octave}`}
                        className={`
                          w-6 h-24 bg-gray-50 border border-gray-400 text-gray-900 rounded-b-lg shadow-md
                          hover:bg-white active:bg-gray-200 transition-colors duration-100 select-none relative
                          ${pressedKeys.has(`${note}${octave}`) ? 'bg-gray-300 shadow-inner' : ''}
                          ${chordNotes.has(`${note}${octave}`) ? 'bg-purple-200 ring-2 ring-purple-500' : ''}
                          ${isNoteInScale(note) ? 'shadow-lg shadow-blue-500/40' : ''}
                          ${octave === currentOctave ? 'ring-2 ring-yellow-400 ring-opacity-60' : ''}
                        `}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleKeyPress(note, octave);
                        }}
                        onMouseUp={() => handleKeyRelease(note, octave)}
                        onMouseLeave={() => handleKeyRelease(note, octave)}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-600">
                          {note}
                          {octave === currentOctave && <div className="text-xs opacity-60">{octave}</div>}
                        </div>

                        {note === 'C' && (
                          <div className="absolute top-1 left-1 text-xs font-bold text-blue-600">
                            {octave}
                          </div>
                        )}

                        {isNoteInScale(note) && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" title="In current scale" />
                        )}
                      </button>
                    );
                  })
                )).flat()}
              </div>

              {/* Black keys positioned correctly between white keys */}
              <div className="absolute top-0 left-0">
                {[2, 3, 4, 5, 6].map(octave => {
                  const octaveOffset = (octave - 2) * 7 * 24; // Each white key is 24px wide
                  return [
                    // C# - between C and D
                    { note: 'C#', position: octaveOffset + 15 },
                    // D# - between D and E  
                    { note: 'D#', position: octaveOffset + 39 },
                    // F# - between F and G
                    { note: 'F#', position: octaveOffset + 87 },
                    // G# - between G and A
                    { note: 'G#', position: octaveOffset + 111 },
                    // A# - between A and B
                    { note: 'A#', position: octaveOffset + 135 }
                  ].map(({ note, position }) => (
                    <button
                      key={`black-${note}${octave}`}
                      className={`
                        absolute w-4 h-16 bg-black border border-gray-900 text-white rounded-b-md z-10 shadow-lg
                        hover:bg-gray-900 active:bg-gray-800 transition-colors duration-100 select-none
                        ${pressedKeys.has(`${note}${octave}`) ? 'bg-gray-700 shadow-inner' : ''}
                        ${chordNotes.has(`${note}${octave}`) ? 'bg-purple-700 ring-2 ring-purple-400' : ''}
                        ${isNoteInScale(note) ? 'shadow-lg shadow-blue-400/60' : ''}
                        ${octave === currentOctave ? 'ring-2 ring-yellow-400 ring-opacity-60' : ''}
                      `}
                      style={{ left: `${position}px` }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleKeyPress(note, octave);
                      }}
                      onMouseUp={() => handleKeyRelease(note, octave)}
                      onMouseLeave={() => handleKeyRelease(note, octave)}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-300">
                        {octave === currentOctave && <div className="text-xs opacity-60">{octave}</div>}
                      </div>

                      {isNoteInScale(note) && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400" title="In current scale" />
                      )}
                    </button>
                  ));
                }).flat()}
              </div>
            </div>

            {/* Scale indicator */}
            <div className="mt-4 flex items-center justify-center space-x-2">
              <span className="text-xs text-gray-600">Current Scale: {scale}</span>
              <div className="flex space-x-1">
                {getCurrentScaleNotes().map(note => (
                  <span key={note} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Keyboard controls */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                🎹 Click piano keys to play • Left click grid to add notes • Right click notes to delete
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant={sustainEnabled ? "default" : "outline"}
                onClick={() => setSustainEnabled(!sustainEnabled)}
                className={`${sustainEnabled ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
              >
                <i className="fas fa-hand-paper mr-1"></i>
                {sustainEnabled ? 'Sustain ON' : 'Sustain OFF'}
              </Button>

              <Button
                size="sm"
                variant={snapToScale ? "default" : "outline"}
                onClick={() => setSnapToScale(!snapToScale)}
                className={`${snapToScale ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
              >
                <i className="fas fa-lock mr-1"></i>
                {snapToScale ? 'Scale Lock ON' : 'Scale Lock OFF'}
              </Button>

              <Button
                size="sm"
                variant={chordMode ? "default" : "outline"}
                onClick={() => {
                  setChordMode(!chordMode);
                  if (!chordMode) {
                    clearChord();
                  }
                }}
                className={`${chordMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
              >
                <i className="fas fa-layer-group mr-1"></i>
                {chordMode ? 'Chord Mode ON' : 'Chord Mode OFF'}
              </Button>
            </div>
          </div>
        </div>

        {/* Circle of Fifths Panel */}
        {showCircleOfFifths && (
          <div className="mt-6 mb-4 p-4 bg-gray-800 rounded-lg border border-purple-500/30">
            <h3 className="text-lg font-semibold text-white mb-3">🎼 Circle of Fifths - {getCurrentKeyRoot()} Major</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Related Keys */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Related Keys:</h4>
                <div className="space-y-1 text-sm">
                  {(() => {
                    const related = getRelatedKeysForCurrentScale();
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Dominant (V):</span>
                          <span className="text-green-400 font-medium">{related.dominant}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Subdominant (IV):</span>
                          <span className="text-blue-400 font-medium">{related.subdominant}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Relative Minor:</span>
                          <span className="text-purple-400 font-medium">{related.relative_minor}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Secondary Dominant:</span>
                          <span className="text-orange-400 font-medium">{related.secondary_dominant}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Circle Visualization */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Key Relationships:</h4>
                <div className="relative w-32 h-32 mx-auto border border-gray-600 rounded-full">
                  {circleOfFifths.majorKeys.map((key, index) => {
                    const angle = (index * 30) - 90; // Start at top, 30° increments
                    const radian = (angle * Math.PI) / 180;
                    const radius = 45;
                    const x = 50 + radius * Math.cos(radian);
                    const y = 50 + radius * Math.sin(radian);
                    const isCurrentKey = key === getCurrentKeyRoot();

                    return (
                      <div
                        key={key}
                        className={`absolute text-xs font-medium cursor-pointer transform -translate-x-1/2 -translate-y-1/2 ${
                          isCurrentKey ? 'text-yellow-400 font-bold' : 'text-gray-300 hover:text-white'
                        }`}
                        style={{ left: `${x}%`, top: `${y}%` }}
                        onClick={() => setScale(`${key} Major`)}
                        data-testid={`circle-key-${key}`}
                      >
                        {key}
                      </div>
                    );
                  })}

                  {/* Center indicator */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-600">
              <p className="text-xs text-gray-400">
                Current progression: <span className="text-white font-medium">
                  {circleOfFifths.getChordProgression(getCurrentKeyRoot(), selectedChordProgression).join(' → ')}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Enhanced Piano Roll Section - Compact */}
        <div className="mt-4 bg-studio-panel border border-gray-600 rounded-lg p-3">
          {/* Piano Roll Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="text-2xl">
                  {(() => {
                    const currentTrack = tracks.find(t => t.id === selectedTrack);
                    const instrument = Object.values(instrumentCategories)
                      .flatMap(cat => cat.instruments)
                      .find(inst => inst.id === currentTrack?.instrument);
                    return instrument?.icon || '🎵';
                  })()}
                </div>
                <div>
                  <h3 className="font-medium text-gray-200">
                    Piano Roll - {tracks.find(t => t.id === selectedTrack)?.name}
                  </h3>
                  <div className="flex items-center space-x-4 text-xs text-gray-400 font-mono">
                    <span>INST: {tracks.find(t => t.id === selectedTrack)?.instrument}</span>
                    <span>VOL: {tracks.find(t => t.id === selectedTrack)?.volume}%</span>
                    <span>NOTES: {notes.filter(n => n.track === selectedTrack).length}</span>
                  </div>
                </div>
              </div>

              {/* Waveform Visualization */}
              <div className="flex-1 max-w-xs">
                <div className="text-xs text-gray-400 mb-1">Signal Level</div>
                <div className="h-8 bg-gray-800 rounded border border-gray-600 relative overflow-hidden">
                  {/* Simulated waveform based on track activity */}
                  <div className="absolute inset-0 flex items-center">
                    {Array.from({length: 50}, (_, i) => {
                      const trackNotes = notes.filter(n => n.track === selectedTrack);
                      const hasNoteAt = trackNotes.some(n => Math.floor(n.start * 10) === Math.floor(i * 2));
                      const height = hasNoteAt ? Math.random() * 80 + 20 : Math.random() * 10;
                      return (
                        <div 
                          key={i} 
                          className={`w-0.5 mx-px ${
                            hasNoteAt ? 'bg-green-400' : 'bg-gray-600'
                          }`}
                          style={{height: `${height}%`}}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Note Management Controls */}
            <div className="flex items-center space-x-3">
              <div className="text-right space-y-1">
                <div className="text-sm text-gray-400 font-mono">
                  POS: {currentBeat.toFixed(2)} / {8 * zoom} beats
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  GRID: {snapSizes.find(s => s.value === gridSnapSize)?.label || gridSnapSize}
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  SCALE: {scale} | {getCurrentScaleNotes().join('-')}
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  ZOOM: {zoom}x | SNAP: {snapToScale ? 'ON' : 'OFF'}
                </div>
              </div>

              {/* Note Deletion Controls */}
              <div className="flex flex-col space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAllNotes}
                  disabled={notes.length === 0}
                  className="bg-red-600 hover:bg-red-500 text-white border-red-500"
                >
                  🗑️ Clear All
                </Button>
                <div className="text-xs text-gray-400 text-center">
                  Right-click notes to delete
                </div>
              </div>
            </div>
          </div>

          {/* Compact Piano Roll Grid */}
          <div 
            className="h-64 bg-gray-900 rounded border border-gray-600 relative overflow-hidden cursor-crosshair piano-roll-container"
            onMouseDown={handlePianoRollMouseDown}
            onMouseUp={handlePianoRollMouseUp}
            onMouseMove={handleMouseMove}
            onContextMenu={(e) => e.preventDefault()} // Prevent browser context menu
          >
            {/* Vertical grid lines (beats) */}
            <div className="absolute inset-0 pointer-events-none">
              {Array(Math.floor(32 * zoom)).fill(0).map((_, i) => (
                <div
                  key={`beat-${i}`}
                  className={`absolute top-0 bottom-0 ${i % (4 / gridSnapSize) === 0 ? 'border-gray-500' : 'border-gray-700'} border-l`}
                  style={{ left: `${(i / (32 * zoom)) * 100}%` }}
                />
              ))}
            </div>

            {/* Horizontal grid lines (notes) */}
            <div className="absolute inset-0 pointer-events-none">
              {Array(48).fill(0).map((_, i) => {
                const isWhiteKey = ![1, 3, 6, 8, 10].includes(i % 12);
                return (
                  <div 
                    key={`note-${i}`} 
                    className={`border-b ${isWhiteKey ? 'bg-gray-800' : 'bg-gray-850'} ${i % 12 === 0 ? 'border-gray-500' : 'border-gray-700'}`}
                    style={{ 
                      height: `${100 / 48}%`,
                      top: `${(47 - i) * (100 / 48)}%`,
                      position: 'absolute',
                      left: 0,
                      right: 0
                    }}
                  />
                );
              })}
            </div>

            {/* Enhanced Playback cursor with glow effect */}
            {isPlaying && (
              <div 
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: `${(currentBeat / (8 * zoom)) * 100}%` }}
              >
                {/* Main cursor line */}
                <div className="w-0.5 h-full bg-red-500 shadow-lg"></div>
                {/* Glow effect */}
                <div className="absolute -left-1 top-0 w-2 h-full bg-red-500 opacity-30 blur-sm"></div>
                {/* Position indicator at top */}
                <div className="absolute -top-2 -left-2 w-4 h-2 bg-red-500 rounded-b-sm">
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-red-500"></div>
                </div>
              </div>
            )}

            {/* Static position cursor when not playing */}
            {!isPlaying && currentBeat > 0 && (
              <div 
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: `${(currentBeat / (8 * zoom)) * 100}%` }}
              >
                <div className="w-0.5 h-full bg-yellow-400 opacity-70"></div>
                <div className="absolute -top-2 -left-2 w-4 h-2 bg-yellow-400 rounded-b-sm opacity-70">
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-yellow-400"></div>
                </div>
              </div>
            )}

            {/* Enhanced Notes with Technical Information */}
            {notes.map((note, index) => {
              const track = tracks.find(t => t.id === note.track);
              if (!track || !track.visible) return null;

              const noteIndex = pianoKeys.findIndex(k => k.note === note.note);
              const yPosition = (47 - (noteIndex + (note.octave - 2) * 12)) * (100 / 48);
              const isSelected = selectedTrack === note.track;
              const velocity = note.velocity || 80;
              const isInScale = isNoteInScale(note.note);

              return (
                <div
                  key={index}
                  className={`absolute rounded cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-red-400 group z-10 ${track.color} ${track.muted ? 'opacity-50' : 'opacity-90'} select-none`}
                  style={{
                    left: `${(note.start / (8 * zoom)) * 100}%`,
                    width: `${Math.max((note.duration / (8 * zoom)) * 100, 0.8)}%`,
                    top: `${Math.max(0, Math.min(yPosition, 97))}%`,
                    height: `${Math.max(100 / 72, 1.2)}%`, // Smaller, more compact notes
                    minHeight: '2px' // Ensure visibility
                  }}
                  title={`${note.note}${note.octave} - ${track.name} - RIGHT CLICK TO DELETE`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Left click does nothing now - just prevents event bubbling
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeNote(index);
                    toast({
                      title: "🗑️ Note Deleted",
                      description: `Removed ${note.note}${note.octave} from ${track.name}`,
                      duration: 1000
                    });
                  }}
                >
                  {/* Note content */}
                  <div className="w-full h-full rounded flex items-center justify-between px-1">
                    <span className="text-xs font-medium text-white opacity-80 truncate">
                      {note.note}{note.octave}
                    </span>

                    {/* Right-click indicator - visible on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center space-x-1">
                      <div className="text-xs text-white bg-red-500 px-1 rounded">
                        Right-click to delete
                      </div>

                      {/* Resize handle */}
                      <div
                        className="w-2 h-full bg-white bg-opacity-30 cursor-ew-resize hover:bg-opacity-50 flex-shrink-0"
                        onMouseDown={(e) => handleResizeStart(e, index)}
                        title="Drag to resize note"
                      />
                    </div>
                  </div>

                  {/* Tooltip */}
                  <div className="hidden group-hover:block absolute -top-8 left-0 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap z-30">
                    {track.name}: {note.note}{note.octave} - Duration: {note.duration.toFixed(2)}s - Click to delete • Drag right edge to resize
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Instrument Browser Modal */}
        <Dialog open={showInstrumentBrowser} onOpenChange={setShowInstrumentBrowser}>
          <DialogContent className="bg-gray-800 border-gray-600 text-white max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-xl font-bold text-gray-200">
                <i className="fas fa-music mr-2"></i>
                Instrument Library
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 overflow-y-auto flex-1 min-h-0">
              {Object.entries(instrumentCategories).map(([categoryKey, category]) => (
                <div key={categoryKey} className="space-y-2">
                  <h3 className="font-semibold text-gray-300 border-b border-gray-600 pb-1">
                    🎼 {category.name}
                  </h3>
                  <div className="space-y-1">
                    {category.instruments.map((inst) => (
                      <div 
                        key={inst.id}
                        className="flex items-center space-x-2 p-2 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer"
                        onClick={() => {
                          if (selectedTrack) {
                            updateTrackInstrument(selectedTrack, inst.id);
                            setShowInstrumentBrowser(false);
                          }
                        }}
                      >
                        <span className="text-lg">{inst.icon}</span>
                        <span className="text-sm">{inst.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-6 text-center">
          <Button 
            onClick={() => setShowInstrumentBrowser(true)}
            variant="outline"
            className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
          >
            <i className="fas fa-search mr-2"></i>
            Browse All Instruments
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}