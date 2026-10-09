import React from 'react';
import { useWindowManager, STUDIO_WINDOWS } from '@/contexts/WindowManagerContext';
import FloatingWindow from '@/components/studio/FloatingWindow';
import UndoRedoControls from '@/components/studio/UndoRedoControls';
import { Save, Undo2, Sliders, Music, Mic, Scissors, Snowflake, Wand2 } from 'lucide-react';

const ProjectManagerPanel = React.lazy(() => import('@/components/studio/ProjectManagerPanel'));
const ProfessionalMixer = React.lazy(() => import('@/components/studio/ProfessionalMixer'));
const RecordingPanel = React.lazy(() => import('@/components/studio/RecordingPanel'));
const SampleSlicerPanel = React.lazy(() => import('@/components/studio/SampleSlicerPanel'));
const FreezeBounceControls = React.lazy(() => import('@/components/studio/FreezeBounceControls'));
const SampleLibrary = React.lazy(() => import('@/components/studio/SampleLibrary'));
const AIStemSeparation = React.lazy(() => import('@/components/studio/AIStemSeparation'));

interface StudioWindowRendererProps {
  // Project
  onProjectLoaded?: (projectData: unknown) => void;
  getProjectData?: () => unknown;

  // Recording
  recordingTrackId?: string;
  recordingTrackName?: string;
  currentBeat?: number;
  onTakeReady?: (take: any) => void;
  onRecordingLatencyMeasured?: (latencyMs: number) => void;

  // Sample Slicer
  slicerAudioUrl?: string;
  slicerAudioName?: string;
  slicerBpm?: number;
  onSlicesReady?: (slices: any[]) => void;

  // Freeze/Bounce
  freezeTracks?: Array<{
    id: string;
    name: string;
    audioUrl?: string;
    volume: number;
    pan: number;
    startTimeSeconds?: number;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    latencyCompensationMs?: number;
    effects?: any[];
    notes?: any[];
    clips?: any[];
  }>;
  freezeBpm?: number;
  freezeTotalBeats?: number;
  onTrackFrozen?: (trackId: string, url: string) => void;
  onTrackUnfrozen?: (trackId: string) => void;
  onBounceComplete?: (url: string, blob: Blob) => void;
}

export default function StudioWindowRenderer(props: StudioWindowRendererProps) {
  const { windows, closeWindow, focusWindow, minimizeWindow, isOpen, isMinimized, getZIndex, getConfig } = useWindowManager();
  const deferredFallback = <div className="p-4 text-cyan-300/60 text-sm">Loading window…</div>;

  const renderDeferred = (node: React.ReactNode) => (
    <React.Suspense fallback={deferredFallback}>
      {node}
    </React.Suspense>
  );

  const renderWindowContent = (windowId: string) => {
    switch (windowId) {
      case 'project-manager':
        return renderDeferred(
          <ProjectManagerPanel
            onProjectLoaded={props.onProjectLoaded}
            getProjectData={props.getProjectData}
            onClose={() => closeWindow('project-manager')}
          />
        );

      case 'undo-history':
        return (
          <div className="p-3">
            <UndoRedoControls />
          </div>
        );

      case 'mixer':
        return renderDeferred(
          <ProfessionalMixer />
        );

      case 'recording':
        return renderDeferred(
          <RecordingPanel
            trackId={props.recordingTrackId || ''}
            trackName={props.recordingTrackName || 'Track'}
            currentBeat={props.currentBeat || 0}
            onTakeReady={props.onTakeReady}
            onLatencyCompensationChange={props.onRecordingLatencyMeasured}
          />
        );

      case 'sample-slicer':
        return renderDeferred(
          <SampleSlicerPanel
            audioUrl={props.slicerAudioUrl}
            audioName={props.slicerAudioName}
            bpm={props.slicerBpm}
            onSlicesReady={props.onSlicesReady}
          />
        );

      case 'freeze-bounce':
        return renderDeferred(
          <FreezeBounceControls
            tracks={props.freezeTracks || []}
            bpm={props.freezeBpm || 120}
            totalBeats={props.freezeTotalBeats || 64}
            onTrackFrozen={props.onTrackFrozen}
            onTrackUnfrozen={props.onTrackUnfrozen}
            onBounceComplete={props.onBounceComplete}
          />
        );

      case 'sample-library':
        return renderDeferred(<SampleLibrary />);

      case 'stem-generator':
        return renderDeferred(<AIStemSeparation />);

      default:
        return <div className="p-4 text-zinc-500 text-sm">Window not configured</div>;
    }
  };

  return (
    <>
      {windows.filter(w => w.open).map(w => {
        const config = getConfig(w.id);
        if (!config) return null;
        const Icon = config.icon;

        return (
          <FloatingWindow
            key={w.id}
            id={w.id}
            title={config.title}
            icon={<Icon className="w-3.5 h-3.5" />}
            defaultX={w.x}
            defaultY={w.y}
            defaultWidth={config.defaultWidth}
            defaultHeight={config.defaultHeight}
            minWidth={config.minWidth}
            minHeight={config.minHeight}
            resizable={config.resizable}
            zIndex={getZIndex(w.id)}
            minimized={isMinimized(w.id)}
            onClose={() => closeWindow(w.id)}
            onFocus={() => focusWindow(w.id)}
            onMinimize={() => minimizeWindow(w.id)}
          >
            {renderWindowContent(w.id)}
          </FloatingWindow>
        );
      })}
    </>
  );
}
