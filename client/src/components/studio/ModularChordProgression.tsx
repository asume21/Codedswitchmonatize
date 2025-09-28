import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Sparkles } from 'lucide-react';
import { useAudio } from '@/hooks/use-audio';

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

  // AI Suggest real backend
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleAISuggest = async () => {
    if (!onProgressionChange) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/ai/chord-suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Failed to fetch chord suggestion');
      const data = await res.json();
      if (data && Array.isArray(data.progression)) {
        onProgressionChange(data.progression);
      } else {
        setError('Invalid response from AI');
      }
    } catch (e: any) {
      setError(e.message || 'AI suggestion failed');
    } finally {
      setLoading(false);
    }
  };

  // Playback: play each chord as a block chord
  const handlePlay = () => {
    progression.forEach((chord, i) => {
      setTimeout(() => {
        // Map root/quality to notes (simple triad for demo)
        const rootMidi = CHORD_ROOTS.indexOf(chord.root.replace('m','')) + 60; // C4 = 60
        const isMinor = chord.quality.includes('min') || chord.quality === 'm7';
        const notes = [rootMidi, rootMidi + (isMinor ? 3 : 4), rootMidi + 7];
        notes.forEach(n => playNote && playNote('C', 4, 1, 'piano', 0.8, true)); // Replace with real note mapping
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
          <Button size="sm" onClick={onAISuggest || handleAISuggest}><Sparkles className="w-4 h-4 mr-1" /> AI Suggest</Button>
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
    </Card>
  );
}
