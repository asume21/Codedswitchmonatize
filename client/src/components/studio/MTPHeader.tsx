import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pause, Play, Repeat, RepeatIcon, StopCircle, Upload, Plus, Layers, Mic, Headphones, Library, FolderOpen, Music } from "lucide-react";
import StudioMenuBar from "./StudioMenuBar";
import ProfessionalMixer from "./ProfessionalMixer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button as ButtonBase } from "@/components/ui/button";
import { useState } from "react";

interface MTPHeaderProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  loop: boolean;
  onToggleLoop: () => void;
  punch: { enabled: boolean; in: number; out: number };
  setPunch: (punch: { enabled: boolean; in: number; out: number }) => void;
  tempo: number;
  setTempo: (n: number) => void;
  projectName: string;
  setProjectName: (n: string) => void;
  projectKey: string;
  setProjectKey: (k: string) => void;
  timeSignature: string;
  setTimeSignature: (ts: string) => void;
  metronomeOn: boolean;
  setMetronomeOn: (v: boolean) => void;
  onMixPreview: () => void;
  onImportTracks: () => void;
  onApplyBandTemplate: () => void;
  onApplyPodcastTemplate: () => void;
  onOpenAddTrack: () => void;
  onOpenSources: () => void;
  onOpenLibrary: () => void;
  currentTime: string;
  duration: string;
  tracksCount: number;
  zoomLevel: number;
  menuHandlers: Parameters<typeof StudioMenuBar>[0];
}

export function MTPHeader(props: MTPHeaderProps) {
  const {
    isPlaying,
    onPlay,
    onPause,
    onStop,
    loop,
    onToggleLoop,
    punch,
    setPunch,
    tempo,
    setTempo,
    projectName,
    setProjectName,
    projectKey,
    setProjectKey,
    timeSignature,
    setTimeSignature,
    metronomeOn,
    setMetronomeOn,
    onImportTracks,
    onApplyBandTemplate,
    onApplyPodcastTemplate,
    onOpenAddTrack,
    onOpenSources,
    onOpenLibrary,
    currentTime,
    duration,
    tracksCount,
    zoomLevel,
    menuHandlers,
  } = props;

  return (
    <div className="bg-gray-900 text-white">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <StudioMenuBar {...menuHandlers} />
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <Input className="w-48 h-8 bg-gray-800 border-gray-700" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <span>BPM:</span>
          <Input type="number" className="w-16 h-8 bg-gray-800 border-gray-700" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
          <span>Key:</span>
          <Input className="w-16 h-8 bg-gray-800 border-gray-700" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
          <span>TS:</span>
          <Input className="w-16 h-8 bg-gray-800 border-gray-700" value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)} />
          <Button size="sm" variant={metronomeOn ? "default" : "outline"} onClick={() => setMetronomeOn(!metronomeOn)}>
            {metronomeOn ? "Metronome On" : "Metronome Off"}
          </Button>
        </div>
      </div>
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Music className="w-6 h-6" />
              Master Multi-Track Player
            </h2>
            <p className="text-sm text-gray-400 mt-1">Load and mix multiple audio files together</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={isPlaying ? "destructive" : "default"} onClick={isPlaying ? onPause : onPlay}>
              {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button variant="outline" onClick={onStop}>
              <StopCircle className="w-4 h-4 mr-2" /> Stop
            </Button>
            <Button variant={loop ? "default" : "outline"} onClick={onToggleLoop}>
              <Repeat className="w-4 h-4 mr-2" /> Loop
            </Button>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-gray-400">Punch In</span>
              <Input type="number" value={punch.in} onChange={(e) => setPunch({ ...punch, in: Number(e.target.value) })} className="w-20" />
              <span className="text-xs text-gray-400">Punch Out</span>
              <Input type="number" value={punch.out} onChange={(e) => setPunch({ ...punch, out: Number(e.target.value) })} className="w-20" />
            </div>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-gray-400">Tempo</span>
              <Input type="number" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} className="w-20" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Professional Multi-Track Mixing</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">
              Tracks: <span className="text-white font-semibold">{tracksCount}</span>
            </span>
            <span className="text-gray-400">
              Duration: <span className="text-white font-semibold">{duration}</span>
            </span>
            <span className="text-gray-400">
              Current Time: <span className="text-white font-semibold">{currentTime}</span>
            </span>
            <div className="text-gray-400 text-xs">Zoom: {zoomLevel.toFixed(2)}x</div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={onOpenLibrary}>
              <Library className="w-4 h-4 mr-1" />
              Library
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenSources}>
              <FolderOpen className="w-4 h-4 mr-1" />
              Sources
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenAddTrack}>
              <Plus className="w-4 h-4 mr-2" />
              Add Track
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
