import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Track, Note } from './types/pianoRollTypes';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

interface TrackWaveformLaneProps {
  tracks: Track[];
  selectedTrackIndex: number;
  onTrackSelect: (index: number) => void;
  currentStep: number;
  totalSteps: number;
  stepWidth: number;
  horizontalZoom: number;
  onPlayheadClick?: (step: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const LANE_HEIGHT = 32;
const HEADER_WIDTH = 112;

export function TrackWaveformLane({
  tracks,
  selectedTrackIndex,
  onTrackSelect,
  currentStep,
  totalSteps,
  stepWidth,
  horizontalZoom,
  onPlayheadClick,
  isCollapsed = false,
  onToggleCollapse,
}: TrackWaveformLaneProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [visibleTracks, setVisibleTracks] = useState<Set<number>>(new Set(tracks.map((_, i) => i)));

  const toggleTrackVisibility = (index: number) => {
    setVisibleTracks(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const gridWidth = totalSteps * stepWidth * horizontalZoom;

  const renderTrackWaveform = (track: Track, trackIndex: number) => {
    if (!visibleTracks.has(trackIndex)) return null;
    
    const isSelected = trackIndex === selectedTrackIndex;
    const trackColor = track.color || getTrackColor(trackIndex);
    
    return (
      <div 
        key={track.id} 
        className={`flex border-b border-gray-700 ${isSelected ? 'bg-blue-900/20' : 'bg-gray-900/50'}`}
        style={{ height: LANE_HEIGHT }}
      >
        {/* Track Label */}
        <div 
          className={`flex items-center gap-1 px-2 border-r border-gray-700 cursor-pointer hover:bg-gray-700/50 ${isSelected ? 'bg-blue-800/30' : ''}`}
          style={{ width: HEADER_WIDTH, minWidth: HEADER_WIDTH }}
          onClick={() => onTrackSelect(trackIndex)}
        >
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0" 
            style={{ backgroundColor: trackColor }}
          />
          <span className="text-xs text-gray-300 truncate flex-1">{track.name}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleTrackVisibility(trackIndex);
            }}
          >
            {visibleTracks.has(trackIndex) ? (
              <Eye className="w-3 h-3 text-gray-400" />
            ) : (
              <EyeOff className="w-3 h-3 text-gray-500" />
            )}
          </Button>
        </div>
        
        {/* Waveform/Note Blocks */}
        <div 
          className="relative flex-1 overflow-hidden"
          style={{ height: LANE_HEIGHT }}
        >
          <svg 
            width={gridWidth} 
            height={LANE_HEIGHT}
            className="absolute top-0 left-0"
          >
            {/* Background grid lines every 4 steps */}
            {Array.from({ length: Math.ceil(totalSteps / 4) }, (_, i) => (
              <line
                key={`grid-${i}`}
                x1={i * 4 * stepWidth * horizontalZoom}
                y1={0}
                x2={i * 4 * stepWidth * horizontalZoom}
                y2={LANE_HEIGHT}
                stroke="rgba(100, 116, 139, 0.3)"
                strokeWidth={1}
              />
            ))}
            
            {/* Note blocks as waveform representation */}
            {track.notes.map((note) => {
              const x = note.step * stepWidth * horizontalZoom;
              const width = note.length * stepWidth * horizontalZoom;
              const height = Math.max(4, (note.velocity / 127) * (LANE_HEIGHT - 4));
              const y = (LANE_HEIGHT - height) / 2;
              
              return (
                <rect
                  key={note.id}
                  x={x}
                  y={y}
                  width={Math.max(2, width - 1)}
                  height={height}
                  fill={trackColor}
                  opacity={0.8}
                  rx={1}
                  className="cursor-pointer hover:opacity-100"
                />
              );
            })}
            
            {/* Playhead indicator */}
            <line
              x1={currentStep * stepWidth * horizontalZoom}
              y1={0}
              x2={currentStep * stepWidth * horizontalZoom}
              y2={LANE_HEIGHT}
              stroke="#ef4444"
              strokeWidth={2}
            />
          </svg>
        </div>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className="border-b border-gray-600 bg-gray-800/50">
        <div 
          className="flex items-center justify-between px-3 py-1 cursor-pointer hover:bg-gray-700/50"
          onClick={onToggleCollapse}
        >
          <span className="text-xs text-gray-400 font-medium">Track Overview</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-600 bg-gray-850">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-1 bg-gray-800/80 border-b border-gray-700 cursor-pointer hover:bg-gray-700/50"
        onClick={onToggleCollapse}
      >
        <span className="text-xs text-gray-300 font-medium">Track Overview</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{tracks.length} tracks</span>
          <ChevronUp className="w-4 h-4 text-gray-400" />
        </div>
      </div>
      
      {/* Track Lanes */}
      <div className="flex">
        {/* Fixed track labels column */}
        <div style={{ width: HEADER_WIDTH, minWidth: HEADER_WIDTH }}>
          {tracks.map((track, index) => (
            visibleTracks.has(index) && (
              <div 
                key={track.id}
                className={`flex items-center gap-1 px-2 border-b border-r border-gray-700 cursor-pointer hover:bg-gray-700/50 ${index === selectedTrackIndex ? 'bg-blue-800/30' : ''}`}
                style={{ height: LANE_HEIGHT }}
                onClick={() => onTrackSelect(index)}
              >
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: track.color || getTrackColor(index) }}
                />
                <span className="text-xs text-gray-300 truncate flex-1">{track.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTrackVisibility(index);
                  }}
                >
                  <Eye className="w-3 h-3 text-gray-400" />
                </Button>
              </div>
            )
          ))}
        </div>
        
        {/* Scrollable waveform area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto"
          onClick={(e) => {
            if (onPlayheadClick) {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
              const step = Math.floor(x / (stepWidth * horizontalZoom));
              if (step >= 0 && step < totalSteps) {
                onPlayheadClick(step);
              }
            }
          }}
        >
          <div style={{ width: gridWidth, minWidth: gridWidth }}>
            {tracks.map((track, index) => (
              visibleTracks.has(index) && (
                <div 
                  key={track.id}
                  className={`relative border-b border-gray-700 ${index === selectedTrackIndex ? 'bg-blue-900/20' : 'bg-gray-900/50'}`}
                  style={{ height: LANE_HEIGHT }}
                >
                  <svg 
                    width={gridWidth} 
                    height={LANE_HEIGHT}
                    className="absolute top-0 left-0"
                  >
                    {/* Background grid lines every 4 steps */}
                    {Array.from({ length: Math.ceil(totalSteps / 4) }, (_, i) => (
                      <line
                        key={`grid-${i}`}
                        x1={i * 4 * stepWidth * horizontalZoom}
                        y1={0}
                        x2={i * 4 * stepWidth * horizontalZoom}
                        y2={LANE_HEIGHT}
                        stroke="rgba(100, 116, 139, 0.2)"
                        strokeWidth={1}
                      />
                    ))}
                    
                    {/* Note blocks */}
                    {track.notes.map((note) => {
                      const x = note.step * stepWidth * horizontalZoom;
                      const width = note.length * stepWidth * horizontalZoom;
                      const height = Math.max(6, (note.velocity / 127) * (LANE_HEIGHT - 8));
                      const y = (LANE_HEIGHT - height) / 2;
                      const color = track.color || getTrackColor(index);
                      
                      return (
                        <rect
                          key={note.id}
                          x={x}
                          y={y}
                          width={Math.max(3, width - 1)}
                          height={height}
                          fill={color}
                          opacity={0.85}
                          rx={2}
                        />
                      );
                    })}
                    
                    {/* Playhead */}
                    <line
                      x1={currentStep * stepWidth * horizontalZoom}
                      y1={0}
                      x2={currentStep * stepWidth * horizontalZoom}
                      y2={LANE_HEIGHT}
                      stroke="#ef4444"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTrackColor(index: number): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];
  return colors[index % colors.length];
}
