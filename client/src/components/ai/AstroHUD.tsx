import React, { useMemo } from 'react';
import { Track, Note } from '../studio/types/pianoRollTypes';

interface AstroHUDProps {
  tracks: Track[];
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
}

export const AstroHUD: React.FC<AstroHUDProps> = ({ tracks, currentStep, totalSteps, isPlaying }) => {
  const visibleTracks = useMemo(() => tracks.slice(0, 4), [tracks]);

  return (
    <div className="relative w-full h-40 bg-black/60 rounded-lg border border-cyan-500/40 overflow-hidden backdrop-blur-md shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]">
      {/* Dynamic Digital Noise/Grain Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] mix-blend-overlay animate-pulse" />
      
      {/* Scanning Line Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.6)] animate-scan opacity-50" />
      </div>

      {/* Cyberpunk Grid Background */}
      <div className="absolute inset-0 opacity-[0.15] pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)', 
             backgroundSize: '30px 30px',
             perspective: '500px',
             transform: 'rotateX(20deg)'
           }} />

      {/* Waveform Visualization Overlay (Purely Aesthetic) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-around px-4 opacity-10">
        {Array.from({ length: 24 }).map((_, i) => (
          <div 
            key={i} 
            className="w-1 bg-cyan-400 rounded-full animate-pulse"
            style={{ 
              height: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.5 + Math.random() * 1}s`
            }}
          />
        ))}
      </div>

      {/* Multi-Track Mini Lanes */}
      <div className="flex flex-col h-full p-3 gap-2 relative z-10">
        {visibleTracks.length > 0 ? (
          visibleTracks.map((track, i) => (
            <div key={track.id || i} className="flex-1 flex items-center gap-2 group">
              <div className="w-1.5 h-full rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: track.color || '#3b82f6', color: track.color || '#3b82f6' }} />
              <div className="flex-1 h-full relative overflow-hidden bg-cyan-950/20 border border-cyan-500/10 rounded-sm backdrop-blur-sm">
                {/* Waveform-ish Note Blocks */}
                {track.notes.slice(0, 50).map((note: Note) => {
                  const left = (note.step / totalSteps) * 100;
                  const width = (note.length / totalSteps) * 100;
                  return (
                    <div
                      key={note.id}
                      className="absolute h-3 top-1/2 -translate-y-1/2 rounded-sm opacity-80 mix-blend-screen transition-all group-hover:opacity-100"
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(1.5, width)}%`,
                        backgroundColor: track.color || '#3b82f6',
                        boxShadow: `0 0 12px ${track.color || '#3b82f6'}88`,
                        border: `1px solid ${track.color || '#3b82f6'}aa`
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-cyan-500/40 text-[10px] uppercase tracking-widest font-mono">
            Waiting for Signal...
          </div>
        )}
      </div>

      {/* Playhead */}
      <div 
        className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_15px_#fff,0_0_30px_rgba(34,211,238,0.8)] z-20 transition-all duration-100 ease-linear flex flex-col items-center"
        style={{ left: `${(currentStep / totalSteps) * 100}%` }}
      >
        <div className="w-3 h-3 bg-white rotate-45 -mt-1.5 shadow-[0_0_10px_white]" />
        <div className="flex-1 w-full bg-white/80" />
        <div className="w-3 h-3 bg-white rotate-45 -mb-1.5 shadow-[0_0_10px_white]" />
      </div>
      
      {/* HUD Accents */}
      <div className="absolute top-2 right-2 flex gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-pulse delay-75" />
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/20 animate-pulse delay-150" />
      </div>

      {/* Cyber Corner Accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/40 rounded-tl-sm pointer-events-none" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/40 rounded-tr-sm pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/40 rounded-bl-sm pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/40 rounded-br-sm pointer-events-none" />
    </div>
  );
};
