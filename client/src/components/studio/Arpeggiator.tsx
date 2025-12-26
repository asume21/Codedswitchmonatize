/**
 * Arpeggiator Component - Compact version
 * Repeats notes automatically when keys are held down
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Repeat, Zap, ArrowUp, ArrowDown, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';
import { realisticAudio } from '@/lib/realisticAudio';

export type ArpPattern = 'up' | 'down' | 'updown' | 'downup' | 'random' | 'repeat';
export type ArpRate = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32';

interface ArpeggiatorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  bpm: number;
  activeNotes: Array<{ note: string; octave: number; midiNote?: number }>;
  instrument?: string;
  onNoteTriggered?: (note: string, octave: number) => void;
}

// Convert rate to milliseconds based on BPM
const rateToMs = (rate: ArpRate, bpm: number): number => {
  const beatMs = 60000 / bpm; // ms per beat
  switch (rate) {
    case '1/1': return beatMs * 4;
    case '1/2': return beatMs * 2;
    case '1/4': return beatMs;
    case '1/8': return beatMs / 2;
    case '1/16': return beatMs / 4;
    case '1/32': return beatMs / 8;
    default: return beatMs / 2;
  }
};

export function Arpeggiator({
  enabled,
  onEnabledChange,
  bpm,
  activeNotes,
  instrument = 'piano',
  onNoteTriggered,
}: ArpeggiatorProps) {
  const [pattern, setPattern] = useState<ArpPattern>('up');
  const [rate, setRate] = useState<ArpRate>('1/8');
  const [octaveRange, setOctaveRange] = useState(1); // How many octaves to span
  const [velocity, setVelocity] = useState(80);
  const [gate, setGate] = useState(80); // Note length as % of step
  const [swing, setSwing] = useState(0); // Swing amount 0-100
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);
  const directionRef = useRef<'up' | 'down'>('up');
  const swingToggleRef = useRef(false);

  // Generate the sequence of notes based on pattern
  const generateSequence = useCallback(() => {
    if (activeNotes.length === 0) return [];
    
    // Sort notes by pitch (MIDI note number or calculate from note/octave)
    const sortedNotes = [...activeNotes].sort((a, b) => {
      const midiA = a.midiNote ?? (a.octave * 12 + getNoteValue(a.note));
      const midiB = b.midiNote ?? (b.octave * 12 + getNoteValue(b.note));
      return midiA - midiB;
    });

    // Expand to multiple octaves if needed
    let sequence = [...sortedNotes];
    for (let oct = 1; oct < octaveRange; oct++) {
      sequence = sequence.concat(
        sortedNotes.map(n => ({ ...n, octave: n.octave + oct }))
      );
    }

    return sequence;
  }, [activeNotes, octaveRange]);

  // Get numeric value for note name
  const getNoteValue = (note: string): number => {
    const noteMap: Record<string, number> = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    return noteMap[note] ?? 0;
  };

  // Get next note based on pattern - FIXED to properly cycle through notes
  const getNextNote = useCallback((sequence: typeof activeNotes) => {
    if (sequence.length === 0) return null;
    if (sequence.length === 1) return sequence[0]; // Single note always repeats

    let index = currentIndexRef.current;

    switch (pattern) {
      case 'up':
        // Go up through the sequence, wrap around
        index = (index + 1) % sequence.length;
        break;
      case 'down':
        // Go down through the sequence, wrap around
        index = index - 1;
        if (index < 0) index = sequence.length - 1;
        break;
      case 'updown':
        // Go up, then down, then up again
        if (directionRef.current === 'up') {
          index++;
          if (index >= sequence.length - 1) {
            index = sequence.length - 1;
            directionRef.current = 'down';
          }
        } else {
          index--;
          if (index <= 0) {
            index = 0;
            directionRef.current = 'up';
          }
        }
        break;
      case 'downup':
        // Go down, then up, then down again
        if (directionRef.current === 'down') {
          index--;
          if (index <= 0) {
            index = 0;
            directionRef.current = 'up';
          }
        } else {
          index++;
          if (index >= sequence.length - 1) {
            index = sequence.length - 1;
            directionRef.current = 'down';
          }
        }
        break;
      case 'random':
        // Pick a random note (but not the same one twice in a row)
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * sequence.length);
        } while (newIndex === index && sequence.length > 1);
        index = newIndex;
        break;
      case 'repeat':
        // Stay on same note (index doesn't change)
        break;
    }

    currentIndexRef.current = Math.max(0, Math.min(index, sequence.length - 1));
    return sequence[currentIndexRef.current];
  }, [pattern]);

  // Main arpeggiator loop
  useEffect(() => {
    console.log('🎹 ARP: enabled=', enabled, 'notes=', activeNotes.length, activeNotes);
    
    if (!enabled || activeNotes.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      currentIndexRef.current = 0;
      directionRef.current = 'up';
      return;
    }

    const sequence = generateSequence();
    const baseInterval = rateToMs(rate, bpm);
    console.log('🎹 ARP: Starting! interval=', baseInterval, 'ms, sequence=', sequence);
    
    // Play first note immediately
    const firstNote = sequence[0];
    if (firstNote) {
      const noteDuration = Math.max(0.1, (baseInterval * gate / 100) / 1000);
      console.log('🎹 ARP playing:', firstNote.note, firstNote.octave, 'duration:', noteDuration);
      realisticAudio.playNote(
        firstNote.note,
        firstNote.octave,
        noteDuration,
        instrument,
        velocity / 100
      );
      onNoteTriggered?.(firstNote.note, firstNote.octave);
    }

    // Set up interval for subsequent notes
    const tick = () => {
      const seq = generateSequence();
      if (seq.length === 0) return;
      
      const note = getNextNote(seq);
      
      if (note) {
        // Apply swing (delay every other note)
        const swingDelay = swingToggleRef.current ? (baseInterval * swing / 200) : 0;
        swingToggleRef.current = !swingToggleRef.current;

        setTimeout(() => {
          const noteDuration = Math.max(0.1, (baseInterval * gate / 100) / 1000);
          console.log('🎹 ARP tick:', note.note, note.octave, 'idx:', currentIndexRef.current);
          realisticAudio.playNote(
            note.note,
            note.octave,
            noteDuration,
            instrument,
            velocity / 100
          );
          onNoteTriggered?.(note.note, note.octave);
        }, swingDelay);
      }
    };

    intervalRef.current = setInterval(tick, baseInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, activeNotes, bpm, rate, pattern, gate, velocity, swing, instrument, generateSequence, getNextNote, onNoteTriggered]);

  // Reset index when notes change
  useEffect(() => {
    currentIndexRef.current = 0;
    directionRef.current = 'up';
  }, [activeNotes.length]);

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="inline-flex flex-col bg-gray-900/90 rounded-lg border border-purple-500/40 w-48">
      {/* Compact Header - Always visible */}
      <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/50 rounded-t-lg">
        <div 
          className="flex items-center gap-2 cursor-pointer flex-1"
          onClick={() => enabled ? setExpanded(!expanded) : onEnabledChange(true)}
        >
          <Zap className={`w-4 h-4 ${enabled ? 'text-yellow-400' : 'text-gray-500'}`} />
          <span className="text-xs font-bold text-white">ARP</span>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            className="scale-75"
          />
          {enabled && (
            <div 
              className="cursor-pointer p-1" 
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </div>
          )}
        </div>
      </div>

      {/* Quick Controls - Show when enabled */}
      {enabled && (
        <div className="px-3 pb-2 space-y-2">
          {/* Pattern & Rate in one row */}
          <div className="flex gap-1">
            <Select value={pattern} onValueChange={(v) => setPattern(v as ArpPattern)}>
              <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="up">↑ Up</SelectItem>
                <SelectItem value="down">↓ Down</SelectItem>
                <SelectItem value="updown">↕ Up-Down</SelectItem>
                <SelectItem value="random">⚡ Random</SelectItem>
                <SelectItem value="repeat">🔁 Repeat</SelectItem>
              </SelectContent>
            </Select>
            <Select value={rate} onValueChange={(v) => setRate(v as ArpRate)}>
              <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1/4">1/4</SelectItem>
                <SelectItem value="1/8">1/8</SelectItem>
                <SelectItem value="1/16">1/16</SelectItem>
                <SelectItem value="1/32">1/32</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expanded options */}
          {expanded && (
            <div className="space-y-2 pt-1 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Gate</span>
                <span className="text-[10px] text-purple-400">{gate}%</span>
              </div>
              <Slider value={[gate]} onValueChange={([v]) => setGate(v)} min={10} max={100} step={10} className="h-1" />
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Velocity</span>
                <span className="text-[10px] text-purple-400">{velocity}%</span>
              </div>
              <Slider value={[velocity]} onValueChange={([v]) => setVelocity(v)} min={10} max={100} step={10} className="h-1" />
            </div>
          )}

          {/* Active notes indicator */}
          {activeNotes.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {activeNotes.slice(0, 4).map((n, i) => (
                <span key={i} className="px-1 py-0.5 bg-purple-600/40 text-purple-200 text-[9px] rounded">
                  {n.note}{n.octave}
                </span>
              ))}
              {activeNotes.length > 4 && (
                <span className="text-[9px] text-gray-500">+{activeNotes.length - 4}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Arpeggiator;
