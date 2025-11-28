import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Sparkles } from 'lucide-react';
import { useAudio } from '@/hooks/use-audio';
import { UpgradeModal, useLicenseGate } from '@/lib/LicenseGuard';

export type Chord = {
  root: string; // e.g. 'C', 'D#', 'F#'
  quality: string; // e.g. 'maj', 'min', '7', 'm7', etc.
};

export type ChordProgressionProps = {
  progression: Chord[];
  onProgressionChange?: (progression: Chord[]) => void;
  onAISuggest?: () => void;
  onPlay?: () => void;
};

const CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_QUALITIES = ['maj', 'min', '7', 'm7', 'maj7', 'dim', 'aug'];

export default function ModularChordProgression({ progression, onProgressionChange, onAISuggest, onPlay }: ChordProgressionProps) {
  const { playNote } = useAudio();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [presetIdx, setPresetIdx] = useState<number>(-1);
  const { requirePro, startUpgrade } = useLicenseGate();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Preset progressions
  const PRESETS: Chord[][] = [
    [ { root: 'C', quality: 'maj' }, { root: 'G', quality: 'maj' }, { root: 'Am', quality: 'min' }, { root: 'F', quality: 'maj' } ], // I–V–vi–IV
    [ { root: 'D', quality: 'min' }, { root: 'G', quality: 'maj' }, { root: 'C', quality: 'maj' } ], // ii–V–I
    [ { root: 'C', quality: 'maj' }, { root: 'Am', quality: 'min' }, { root: 'F', quality: 'maj' }, { root: 'G', quality: 'maj' } ], // I–vi–IV–V
  ];

  const handleChange = (idx: number, field: 'root' | 'quality', value: string) => {
    if (!onProgressionChange) return;
    const next = progression.map((chord, i) =>
      i === idx ? { ...chord, [field]: value } : chord
    );
    onProgressionChange(next);
  };

  const handleAddChord = () => {
    if (!onProgressionChange) return;
    onProgressionChange([...progression, { root: 'C', quality: 'maj' }]);
  };

  const handleRemoveChord = (idx: number) => {
    if (!onProgressionChange) return;
    onProgressionChange(progression.filter((_, i) => i !== idx));
  };

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDrop = (idx: number) => {
    if (draggedIdx === null || !onProgressionChange) return;
    const next = progression.slice();
    const [removed] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, removed);
    onProgressionChange(next);
    setDraggedIdx(null);
  };

  const handlePreset = (idx: number) => {
    setPresetIdx(idx);
    if (onProgressionChange) onProgressionChange(PRESETS[idx]);
  };

  // AI Suggest real backend - uses secure server-side OpenAI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState('C');
  const [selectedMood, setSelectedMood] = useState('happy');
  
  const handleAISuggest = async () => {
    if (!onProgressionChange) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/chords', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: selectedKey, mood: selectedMood })
      });
      
      const data = await res.json();
      
      if (data.success && Array.isArray(data.chords)) {
        // Convert chord strings to Chord objects
        const newProgression: Chord[] = data.chords.map((chordStr: string, idx: number) => {
          // Parse chord string like "Am" or "Cmaj7"
          const match = chordStr.match(/^([A-G]#?)(.*)$/);
          if (match) {
            return {
              root: match[1],
              quality: match[2] || 'maj',
              duration: 1,
              position: idx
            };
          }
          return { root: 'C', quality: 'maj', duration: 1, position: idx };
        });
        onProgressionChange(newProgression);
      } else {
        setError(data.error || 'Invalid response from AI');
      }
    } catch (e: any) {
      setError(e.message || 'AI suggestion failed');
    } finally {
      setLoading(false);
    }
  };

  // Convert MIDI pitch to note name and octave
  const midiToNote = (pitch: number): { note: string; octave: number } => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(pitch / 12) - 1;
    const noteIndex = pitch % 12;
    return { note: noteNames[noteIndex], octave };
  };

  // Playback: play each chord as a block chord
  const handlePlay = () => {
    progression.forEach((chord, i) => {
      setTimeout(() => {
        // Map root/quality to notes (simple triad)
        const rootMidi = CHORD_ROOTS.indexOf(chord.root.replace('m','')) + 60; // C4 = 60
        const isMinor = chord.quality.includes('min') || chord.quality === 'm7';
        const chordMidiNotes = [rootMidi, rootMidi + (isMinor ? 3 : 4), rootMidi + 7];
        
        // Play each note in the chord with actual pitch
        chordMidiNotes.forEach(midiNote => {
          const { note, octave } = midiToNote(midiNote);
          playNote && playNote(note, octave, 1, 'piano', 0.8, true);
        });
      }, i * 600);
    });
  };

  // Harmonic analysis (simple key guess)
  const getAnalysis = () => {
    if (!progression.length) return '';
    // For demo, just show number of unique roots and qualities
    const roots = Array.from(new Set(progression.map(c => c.root)));
    const qualities = Array.from(new Set(progression.map(c => c.quality)));
    return `Roots: ${roots.join(', ')} | Qualities: ${qualities.join(', ')}`;
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Chord Progression (AI & Manual)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-2">
          <Button
            size="sm"
            onClick={() => {
              if (!requirePro("ai-chords", () => setShowUpgrade(true))) return;
              (onAISuggest || handleAISuggest)();
            }}
          >
            <Sparkles className="w-4 h-4 mr-1" /> AI Suggest
          </Button>
          <Button size="sm" onClick={onPlay || handlePlay}><Play className="w-4 h-4 mr-1" /> Play</Button>
          <Button size="sm" onClick={handleAddChord}>Add Chord</Button>
          <select value={presetIdx} onChange={e => handlePreset(Number(e.target.value))} className="rounded px-2 ml-2">
            <option value={-1}>Preset Progressions…</option>
            <option value={0}>I–V–vi–IV (C–G–Am–F)</option>
            <option value={1}>ii–V–I (Dm–G–C)</option>
            <option value={2}>I–vi–IV–V (C–Am–F–G)</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {progression.map((chord, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1"
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDrop={() => handleDrop(idx)}
              onDragOver={e => e.preventDefault()}
              style={{ opacity: draggedIdx === idx ? 0.5 : 1 }}
            >
              <select
                value={chord.root}
                onChange={e => handleChange(idx, 'root', e.target.value)}
                className="rounded px-1 py-0.5"
              >
                {CHORD_ROOTS.map(root => (
                  <option key={root} value={root}>{root}</option>
                ))}
              </select>
              <select
                value={chord.quality}
                onChange={e => handleChange(idx, 'quality', e.target.value)}
                className="rounded px-1 py-0.5"
              >
                {CHORD_QUALITIES.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              <Button size="sm" variant="ghost" onClick={() => handleRemoveChord(idx)} title="Remove Chord">✕</Button>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-blue-700">{getAnalysis()}</div>
      </CardContent>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} onUpgrade={startUpgrade} />
    </Card>
  );
}
