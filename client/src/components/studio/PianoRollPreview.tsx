import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as Tone from 'tone';

type PianoRollNote = {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity?: number;
};

const NOTE_HEIGHT = 12;
const NOTE_SPACING = 1;
const PIXELS_PER_SECOND = 60;
const RESIZE_HANDLE_WIDTH = 8;
const MIN_NOTE_DURATION = 0.1;

const DEFAULT_NOTES: PianoRollNote[] = [
  { id: 'c4', pitch: 60, start: 0, duration: 0.75, velocity: 96 },
  { id: 'e4', pitch: 64, start: 0.75, duration: 0.75, velocity: 82 },
  { id: 'g4', pitch: 67, start: 1.5, duration: 0.75, velocity: 88 },
  { id: 'c5', pitch: 72, start: 2.25, duration: 1, velocity: 110 },
  { id: 'g4-held', pitch: 67, start: 3.25, duration: 0.5, velocity: 76 },
  { id: 'e4-outro', pitch: 64, start: 3.75, duration: 0.5, velocity: 68 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ensurePositiveDuration = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0.25;
  }
  return value;
};

const normalizeVelocity = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  const scaled = value <= 1 ? value * 127 : value;
  return Math.round(clamp(scaled, 0, 127));
};

const mapVelocityToOpacity = (velocity?: number) => {
  const baseline = 0.2;
  if (velocity === undefined) {
    return clamp(0.8, baseline, 1);
  }
  const normalized = clamp(velocity / 127, 0, 1);
  return clamp(normalized + baseline, baseline, 1);
};

const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const midiToNoteName = (pitch: number) => {
  const octave = Math.floor(pitch / 12) - 1;
  const noteName = MIDI_NOTE_NAMES[((pitch % 12) + 12) % 12];
  return `${noteName}${octave}`;
};

const midiToFrequency = (midi: number) => {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

const formatSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds)) {
    return '0.00s';
  }
  return `${seconds.toFixed(2)}s`;
};

const pickFirstNotesArray = (source: any): any[] | null => {
  if (!source) {
    return null;
  }

  const candidates = [
    source.notes,
    source.song?.notes,
    source.midi?.notes,
    source.midiSequence?.notes,
    source.sequence?.notes,
    source.tracks?.[0]?.notes,
    source.sections?.[0]?.notes,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate;
    }
  }

  return null;
};

const materializeNotes = (rawNotes: any[] | null): PianoRollNote[] => {
  if (!rawNotes) {
    return [];
  }

  return rawNotes
    .map((note, index) => {
      const rawPitch =
        note?.pitch ??
        note?.midi ??
        note?.note ??
        note?.noteNumber ??
        note?.pitchMidi;

      if (typeof rawPitch !== 'number' || Number.isNaN(rawPitch)) {
        return null;
      }

      const start =
        note?.start ??
        note?.startTime ??
        note?.onset ??
        note?.time ??
        0;

      const explicitEnd =
        note?.end ??
        note?.endTime ??
        note?.offset ??
        note?.durationEnd;

      const rawDuration =
        note?.duration ??
        note?.length ??
        (typeof explicitEnd === 'number'
          ? explicitEnd - (typeof start === 'number' ? start : 0)
          : undefined);

      const duration = ensurePositiveDuration(
        typeof rawDuration === 'number' ? rawDuration : 0,
      );

      const velocity = normalizeVelocity(
        note?.velocity ??
          note?.intensity ??
          note?.velocityPercent ??
          note?.gain ??
          note?.amplitude,
      );

      const safeStart = Number.isFinite(start) ? Math.max(0, start) : 0;

      return {
        id: String(note?.id ?? `${rawPitch}-${index}`),
        pitch: Math.round(rawPitch),
        start: safeStart,
        duration,
        velocity: velocity ?? undefined,
      } as PianoRollNote;
    })
    .filter((note): note is PianoRollNote => Boolean(note));
};

interface PianoRollPreviewProps {
  generatedSong: any;
  className?: string;
  editable?: boolean;
  onNotesChange?: (notes: PianoRollNote[]) => void;
}

const PianoRollPreview = ({ 
  generatedSong, 
  className, 
  editable = false,
  onNotesChange 
}: PianoRollPreviewProps) => {
  const [hoveredNote, setHoveredNote] = useState<PianoRollNote | null>(null);
  const [resizing, setResizing] = useState<{ noteId: string; startX: number; originalDuration: number } | null>(null);
  const [internalNotes, setInternalNotes] = useState<PianoRollNote[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    synthRef.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 }
    }).toDestination();
    
    return () => {
      synthRef.current?.dispose();
    };
  }, []);

  const notes = useMemo(() => {
    if (editable && internalNotes.length > 0) {
      return internalNotes;
    }
    const extracted = materializeNotes(pickFirstNotesArray(generatedSong));
    return extracted.length ? extracted : DEFAULT_NOTES;
  }, [generatedSong, editable, internalNotes]);

  useEffect(() => {
    if (editable) {
      const extracted = materializeNotes(pickFirstNotesArray(generatedSong));
      setInternalNotes(extracted.length ? extracted : DEFAULT_NOTES);
    }
  }, [generatedSong, editable]);

  const metrics = useMemo(() => {
    if (!notes.length) {
      const pitchSpan = 12;
      const minPitch = 60;
      const renderMaxPitch = minPitch + pitchSpan - 1;
      return {
        minPitch,
        maxPitch: renderMaxPitch,
        totalTime: 4,
        pitchSpan,
        renderMaxPitch,
        renderMinPitch: minPitch,
      };
    }

    const minPitch = notes.reduce((min, note) => Math.min(min, note.pitch), notes[0].pitch);
    const maxPitch = notes.reduce((max, note) => Math.max(max, note.pitch), notes[0].pitch);
    const totalTime = notes.reduce(
      (max, note) => Math.max(max, note.start + note.duration),
      0,
    );

    const pitchSpan = Math.max(maxPitch - minPitch + 1, 12);
    const renderMaxPitch = Math.max(maxPitch, minPitch + pitchSpan - 1);
    const renderMinPitch = renderMaxPitch - pitchSpan + 1;

    return {
      minPitch,
      maxPitch,
      totalTime: Math.max(totalTime, 1),
      pitchSpan,
      renderMaxPitch,
      renderMinPitch,
    };
  }, [notes]);

  const svgHeight = metrics.pitchSpan * NOTE_HEIGHT;
  const svgWidth = Math.max(metrics.totalTime * PIXELS_PER_SECOND, 240);
  const beatCount = Math.ceil(metrics.totalTime);
  const pitchRows = useMemo(
    () => Array.from({ length: metrics.pitchSpan }, (_, index) => metrics.renderMaxPitch - index),
    [metrics.pitchSpan, metrics.renderMaxPitch],
  );

  const playNote = useCallback(async (note: PianoRollNote) => {
    try {
      await Tone.start();
      const freq = midiToFrequency(note.pitch);
      synthRef.current?.triggerAttackRelease(freq, note.duration);
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    if (!editable) return;
    const newNotes = internalNotes.filter(n => n.id !== noteId);
    setInternalNotes(newNotes);
    onNotesChange?.(newNotes);
  }, [editable, internalNotes, onNotesChange]);

  const handleNoteClick = useCallback((e: React.MouseEvent, note: PianoRollNote) => {
    e.stopPropagation();
    playNote(note);
  }, [playNote]);

  const handleNoteDoubleClick = useCallback((e: React.MouseEvent, note: PianoRollNote) => {
    e.stopPropagation();
    e.preventDefault();
    deleteNote(note.id);
  }, [deleteNote]);

  const isNearRightEdge = useCallback((e: React.MouseEvent<SVGRectElement>, note: PianoRollNote) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const noteWidth = note.duration * PIXELS_PER_SECOND;
    return mouseX >= noteWidth - RESIZE_HANDLE_WIDTH;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGRectElement>, note: PianoRollNote) => {
    if (!editable) return;
    
    if (isNearRightEdge(e, note)) {
      e.preventDefault();
      e.stopPropagation();
      setResizing({
        noteId: note.id,
        startX: e.clientX,
        originalDuration: note.duration
      });
    }
  }, [editable, isNearRightEdge]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!resizing || !editable) return;
    
    const deltaX = e.clientX - resizing.startX;
    const deltaDuration = deltaX / PIXELS_PER_SECOND;
    const newDuration = Math.max(MIN_NOTE_DURATION, resizing.originalDuration + deltaDuration);
    
    const newNotes = internalNotes.map(n => 
      n.id === resizing.noteId ? { ...n, duration: newDuration } : n
    );
    setInternalNotes(newNotes);
  }, [resizing, editable, internalNotes]);

  const handleMouseUp = useCallback(() => {
    if (resizing && editable) {
      onNotesChange?.(internalNotes);
    }
    setResizing(null);
  }, [resizing, editable, internalNotes, onNotesChange]);

  const getCursor = useCallback((e: React.MouseEvent<SVGRectElement>, note: PianoRollNote) => {
    if (!editable) return 'pointer';
    if (isNearRightEdge(e, note)) return 'ew-resize';
    return 'pointer';
  }, [editable, isNearRightEdge]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  }, [notes]);

  useEffect(() => {
    if (resizing) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - resizing.startX;
        const deltaDuration = deltaX / PIXELS_PER_SECOND;
        const newDuration = Math.max(MIN_NOTE_DURATION, resizing.originalDuration + deltaDuration);
        
        setInternalNotes(prev => prev.map(n => 
          n.id === resizing.noteId ? { ...n, duration: newDuration } : n
        ));
      };
      
      const handleGlobalMouseUp = () => {
        onNotesChange?.(internalNotes);
        setResizing(null);
      };
      
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [resizing, editable, internalNotes, onNotesChange]);

  return (
    <Card className={cn('bg-slate-900/30 border-slate-700/40', className)} data-testid="card-piano-roll-preview">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="w-4 h-4 text-cyan-400" />
          Piano Roll Preview
          {editable && (
            <span className="text-xs text-muted-foreground ml-2">(Click to play, double-click to delete, drag right edge to resize)</span>
          )}
        </CardTitle>
        <p className="text-xs text-slate-400">
          Velocity-tinted notes with auto-scaling inspired by Magenta&apos;s PianoRoll visualizer.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={containerRef}
          className="overflow-x-auto overflow-y-hidden rounded-md border border-slate-800/70 bg-slate-950/60"
        >
          <svg 
            width={svgWidth} 
            height={svgHeight} 
            className="block min-h-[180px]"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            data-testid="svg-piano-roll"
          >
            {pitchRows.map((pitch, rowIndex) => {
              const y = rowIndex * NOTE_HEIGHT;
              const isOctave = pitch % 12 === 0;
              const fill = rowIndex % 2 === 0 ? 'rgba(15,23,42,0.65)' : 'rgba(15,23,42,0.5)';

              return (
                <g key={`row-${pitch}`}>
                  <rect x={0} y={y} width={svgWidth} height={NOTE_HEIGHT} fill={fill} />
                  {isOctave && (
                    <line
                      x1={0}
                      y1={y}
                      x2={svgWidth}
                      y2={y}
                      stroke="rgba(148, 163, 184, 0.35)"
                      strokeWidth={0.8}
                    />
                  )}
                </g>
              );
            })}

            {Array.from({ length: beatCount + 1 }).map((_, beat) => {
              const x = beat * PIXELS_PER_SECOND;
              const strongBeat = beat % 4 === 0;
              return (
                <line
                  key={`beat-${beat}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={svgHeight}
                  stroke={`rgba(148, 163, 184, ${strongBeat ? 0.35 : 0.15})`}
                  strokeWidth={strongBeat ? 1.2 : 0.6}
                />
              );
            })}

            {notes.map((note) => {
              const clampedPitch = clamp(
                note.pitch,
                metrics.renderMinPitch,
                metrics.renderMaxPitch,
              );
              const y =
                (metrics.renderMaxPitch - clampedPitch) * NOTE_HEIGHT + NOTE_SPACING * 0.5;
              const x = Math.max(0, note.start * PIXELS_PER_SECOND + NOTE_SPACING);
              const width = Math.max(
                note.duration * PIXELS_PER_SECOND - NOTE_SPACING * 2,
                3,
              );
              const height = NOTE_HEIGHT - NOTE_SPACING;
              const opacity = mapVelocityToOpacity(note.velocity);
              const isHovered = hoveredNote?.id === note.id;
              const isBeingResized = resizing?.noteId === note.id;

              return (
                <rect
                  key={note.id}
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={2}
                  fill={`rgba(56, 189, 248, ${opacity.toFixed(3)})`}
                  stroke={`rgba(14, 165, 233, ${isHovered || isBeingResized ? 0.9 : 0.45})`}
                  strokeWidth={isHovered || isBeingResized ? 1.4 : 0.8}
                  className={editable ? 'transition-colors' : ''}
                  style={{ cursor: editable ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHoveredNote(note)}
                  onMouseLeave={() => !resizing && setHoveredNote(null)}
                  onClick={(e) => handleNoteClick(e, note)}
                  onDoubleClick={(e) => handleNoteDoubleClick(e, note)}
                  onMouseDown={(e) => handleMouseDown(e, note)}
                  data-testid={`note-${note.id}`}
                >
                  <title>
                    {`${midiToNoteName(note.pitch)} · start ${formatSeconds(note.start)} · duration ${formatSeconds(note.duration)}${editable ? ' · Click to play, double-click to delete' : ''}`}
                  </title>
                </rect>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>
            Range {midiToNoteName(metrics.renderMinPitch)} – {midiToNoteName(metrics.renderMaxPitch)} · Length {formatSeconds(metrics.totalTime)}
          </span>
          <span>
            {hoveredNote
              ? `Pitch ${midiToNoteName(hoveredNote.pitch)} • Start ${formatSeconds(hoveredNote.start)} • Duration ${formatSeconds(hoveredNote.duration)}`
              : `${notes.length} notes · opacity mirrors MIDI velocity`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PianoRollPreview;
