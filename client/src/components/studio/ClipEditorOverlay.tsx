import { useState, useCallback, useRef, useEffect } from 'react';
import { Scissors, Copy, Trash2, Volume2, Repeat, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  trimClipStart,
  trimClipEnd,
  moveClip,
  setFadeIn,
  setFadeOut,
  setClipGain,
  splitClip,
  duplicateClip,
  toggleClipLoop,
  getClipDuration,
  snapToGrid,
} from '@/lib/clipEditor';
import type { AudioClip as AudioClipType } from '@/lib/projectManager';

interface ClipEditorOverlayProps {
  clips: AudioClipType[];
  selectedClipId: string | null;
  pixelsPerBeat: number;
  gridSize: number;
  bpm: number;
  playheadBeat: number;
  onClipsChange: (clips: AudioClipType[]) => void;
  onSelectClip: (clipId: string | null) => void;
}

export default function ClipEditorOverlay({
  clips,
  selectedClipId,
  pixelsPerBeat,
  gridSize,
  bpm,
  playheadBeat,
  onClipsChange,
  onSelectClip,
}: ClipEditorOverlayProps) {
  const [dragState, setDragState] = useState<{
    type: 'move' | 'trim-start' | 'trim-end' | 'fade-in' | 'fade-out';
    clipId: string;
    startX: number;
    startBeat: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const selectedClip = clips.find(c => c.id === selectedClipId);

  const updateClip = useCallback((clipId: string, updater: (clip: AudioClipType) => AudioClipType) => {
    onClipsChange(clips.map(c => c.id === clipId ? updater(c) : c));
  }, [clips, onClipsChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent, clipId: string, type: 'move' | 'trim-start' | 'trim-end' | 'fade-in' | 'fade-out') => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    onSelectClip(clipId);
    setDragState({
      type,
      clipId,
      startX: e.clientX,
      startBeat: type === 'trim-start' ? clip.startBeat : type === 'trim-end' ? clip.endBeat : clip.startBeat,
    });
  }, [clips, onSelectClip]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;
    const deltaPx = e.clientX - dragState.startX;
    const deltaBeats = deltaPx / pixelsPerBeat;
    const newBeat = snapToGrid(dragState.startBeat + deltaBeats, gridSize);

    switch (dragState.type) {
      case 'move':
        updateClip(dragState.clipId, c => moveClip(c, newBeat));
        break;
      case 'trim-start':
        updateClip(dragState.clipId, c => trimClipStart(c, newBeat));
        break;
      case 'trim-end':
        updateClip(dragState.clipId, c => trimClipEnd(c, newBeat));
        break;
      case 'fade-in':
        updateClip(dragState.clipId, c => setFadeIn(c, Math.max(0, deltaBeats)));
        break;
      case 'fade-out':
        updateClip(dragState.clipId, c => setFadeOut(c, Math.max(0, -deltaBeats)));
        break;
    }
  }, [dragState, pixelsPerBeat, gridSize, updateClip]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const handleSplit = useCallback(() => {
    if (!selectedClipId) return;
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) return;
    const result = splitClip(clip, playheadBeat);
    if (!result) return;
    const [left, right] = result;
    onClipsChange(clips.filter(c => c.id !== selectedClipId).concat([left, right]));
    onSelectClip(left.id);
  }, [selectedClipId, clips, playheadBeat, onClipsChange, onSelectClip]);

  const handleDuplicate = useCallback(() => {
    if (!selectedClipId) return;
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) return;
    const dup = duplicateClip(clip);
    onClipsChange([...clips, dup]);
    onSelectClip(dup.id);
  }, [selectedClipId, clips, onClipsChange, onSelectClip]);

  const handleDelete = useCallback(() => {
    if (!selectedClipId) return;
    onClipsChange(clips.filter(c => c.id !== selectedClipId));
    onSelectClip(null);
  }, [selectedClipId, clips, onClipsChange, onSelectClip]);

  const handleToggleLoop = useCallback(() => {
    if (!selectedClip) return;
    updateClip(selectedClip.id, c => toggleClipLoop(c, !c.loop));
  }, [selectedClip, updateClip]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedClipId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handleSplit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedClipId, handleDelete, handleDuplicate, handleSplit]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Clip blocks */}
      {clips.map(clip => {
        const left = clip.startBeat * pixelsPerBeat;
        const width = getClipDuration(clip) * pixelsPerBeat;
        const isSelected = clip.id === selectedClipId;
        const fadeInWidth = clip.fadeInBeats * pixelsPerBeat;
        const fadeOutWidth = clip.fadeOutBeats * pixelsPerBeat;

        return (
          <div
            key={clip.id}
            className={`absolute top-0 h-full rounded-md border transition-colors cursor-pointer ${
              isSelected
                ? 'border-purple-500 bg-purple-500/20 z-10'
                : 'border-zinc-600 bg-zinc-700/30 hover:bg-zinc-700/50'
            } ${clip.loop ? 'border-dashed' : ''}`}
            style={{ left: `${left}px`, width: `${Math.max(width, 4)}px` }}
            onClick={() => onSelectClip(clip.id)}
          >
            {/* Clip name */}
            <div className="absolute top-0 left-1 text-[9px] text-white/70 truncate max-w-full pointer-events-none">
              {clip.name}
              {clip.loop && <Repeat className="w-2.5 h-2.5 inline ml-1 opacity-50" />}
            </div>

            {/* Gain indicator */}
            {clip.gain !== 1 && (
              <div className="absolute bottom-0 left-1 text-[8px] text-zinc-400 pointer-events-none">
                {clip.gain > 1 ? '+' : ''}{((clip.gain - 1) * 100).toFixed(0)}%
              </div>
            )}

            {/* Fade in triangle */}
            {fadeInWidth > 0 && (
              <div
                className="absolute top-0 left-0 h-full pointer-events-none"
                style={{ width: `${fadeInWidth}px` }}
              >
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points="0,100 100,0 100,100" fill="rgba(255,255,255,0.1)" />
                </svg>
              </div>
            )}

            {/* Fade out triangle */}
            {fadeOutWidth > 0 && (
              <div
                className="absolute top-0 right-0 h-full pointer-events-none"
                style={{ width: `${fadeOutWidth}px` }}
              >
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points="0,0 0,100 100,100" fill="rgba(255,255,255,0.1)" />
                </svg>
              </div>
            )}

            {/* Trim handles */}
            <div
              className="absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-white/10"
              onMouseDown={(e) => handleMouseDown(e, clip.id, 'trim-start')}
            />
            <div
              className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-white/10"
              onMouseDown={(e) => handleMouseDown(e, clip.id, 'trim-end')}
            />

            {/* Move handle (center) */}
            <div
              className="absolute top-0 left-2 right-2 h-full cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => handleMouseDown(e, clip.id, 'move')}
            />

            {/* Fade handles */}
            {isSelected && (
              <>
                <div
                  className="absolute top-0 left-0 w-3 h-3 bg-white/30 rounded-br cursor-nw-resize"
                  onMouseDown={(e) => handleMouseDown(e, clip.id, 'fade-in')}
                  title="Drag to set fade in"
                />
                <div
                  className="absolute top-0 right-0 w-3 h-3 bg-white/30 rounded-bl cursor-ne-resize"
                  onMouseDown={(e) => handleMouseDown(e, clip.id, 'fade-out')}
                  title="Drag to set fade out"
                />
              </>
            )}
          </div>
        );
      })}

      {/* Toolbar for selected clip */}
      {selectedClip && (
        <div className="absolute -top-9 left-0 flex items-center gap-1 bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1 z-20 shadow-lg">
          <Button size="sm" variant="ghost" onClick={handleSplit} className="p-1 h-6" title="Split at playhead (Ctrl+B)">
            <Scissors className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDuplicate} className="p-1 h-6" title="Duplicate (Ctrl+D)">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleToggleLoop} className={`p-1 h-6 ${selectedClip.loop ? 'text-cyan-400' : ''}`} title="Toggle loop">
            <Repeat className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-4 bg-zinc-600 mx-0.5" />
          <div className="flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-zinc-500" />
            <Slider
              value={[selectedClip.gain]}
              min={0}
              max={2}
              step={0.01}
              onValueChange={([v]) => updateClip(selectedClip.id, c => setClipGain(c, v))}
              className="w-16 h-3"
            />
            <span className="text-[9px] text-zinc-400 w-8">
              {selectedClip.gain === 1 ? '0dB' : `${selectedClip.gain > 1 ? '+' : ''}${(20 * Math.log10(selectedClip.gain)).toFixed(1)}`}
            </span>
          </div>
          <div className="w-px h-4 bg-zinc-600 mx-0.5" />
          <Button size="sm" variant="ghost" onClick={handleDelete} className="p-1 h-6 text-red-400 hover:text-red-300" title="Delete (Del)">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
