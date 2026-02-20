import { useWindowManager, STUDIO_WINDOWS } from '@/contexts/WindowManagerContext';
import FloatingWindow from '@/components/studio/FloatingWindow';
import ProjectManagerPanel from '@/components/studio/ProjectManagerPanel';
import UndoRedoControls from '@/components/studio/UndoRedoControls';
import AutomationLaneEditor from '@/components/studio/AutomationLaneEditor';
import EffectsChainPanel from '@/components/studio/EffectsChainPanel';
import MixerWithBuses from '@/components/studio/MixerWithBuses';
import RecordingPanel from '@/components/studio/RecordingPanel';
import SampleSlicerPanel from '@/components/studio/SampleSlicerPanel';
import FreezeBounceControls from '@/components/studio/FreezeBounceControls';
import ClipEditorOverlay from '@/components/studio/ClipEditorOverlay';
import MidiEditorPanel from '@/components/studio/MidiEditorPanel';
import { Save, Undo2, Sliders, Music, Mic, Scissors, Snowflake, Layers, Wand2 } from 'lucide-react';
import type { AutomationLane, AudioClip, MixerChannel, MixBus } from '@/lib/projectManager';
import type { EffectInstance } from '@/lib/effectsChain';
import type { Note } from '../../../../shared/studioTypes';

interface StudioWindowRendererProps {
  // Project
  onProjectLoaded?: (project: any) => void;

  // Automation
  automationTrackId?: string;
  automationTrackName?: string;
  automationTrackColor?: string;
  automationLanes?: AutomationLane[];
  automationTotalBeats?: number;
  automationPixelsPerBeat?: number;
  onAutomationLanesChange?: (lanes: AutomationLane[]) => void;

  // Effects
  effectsTrackId?: string;
  effectsTrackName?: string;
  effects?: EffectInstance[];
  onEffectsChange?: (effects: EffectInstance[]) => void;

  // Mixer
  mixerChannels?: MixerChannel[];
  mixerBuses?: MixBus[];
  masterVolume?: number;
  trackNames?: Map<string, string>;
  trackColors?: Map<string, string>;
  onMixerChannelsChange?: (channels: MixerChannel[]) => void;
  onMixerBusesChange?: (buses: MixBus[]) => void;
  onMasterVolumeChange?: (volume: number) => void;

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

  // Clip Editor
  clips?: AudioClip[];
  selectedClipId?: string | null;
  clipPixelsPerBeat?: number;
  clipGridSize?: number;
  clipBpm?: number;
  playheadBeat?: number;
  onClipsChange?: (clips: AudioClip[]) => void;
  onSelectClip?: (clipId: string | null) => void;

  // MIDI Editor
  midiTrackId?: string;
  midiNotes?: Note[];
  midiRootKey?: string;
  midiScaleName?: string;
  midiTotalSteps?: number;
  midiPixelsPerStep?: number;
  onMidiNotesChange?: (notes: Note[]) => void;
  onMidiKeyChange?: (key: string) => void;
  onMidiScaleChange?: (scale: string) => void;
}

export default function StudioWindowRenderer(props: StudioWindowRendererProps) {
  const { windows, closeWindow, focusWindow, minimizeWindow, isOpen, isMinimized, getZIndex, getConfig } = useWindowManager();

  const renderWindowContent = (windowId: string) => {
    switch (windowId) {
      case 'project-manager':
        return (
          <ProjectManagerPanel
            onProjectLoaded={props.onProjectLoaded}
            onClose={() => closeWindow('project-manager')}
          />
        );

      case 'undo-history':
        return (
          <div className="p-3">
            <UndoRedoControls />
          </div>
        );

      case 'automation':
        return (
          <AutomationLaneEditor
            trackId={props.automationTrackId || ''}
            trackName={props.automationTrackName || 'Track'}
            trackColor={props.automationTrackColor || '#8b5cf6'}
            lanes={props.automationLanes || []}
            totalBeats={props.automationTotalBeats || 64}
            pixelsPerBeat={props.automationPixelsPerBeat || 20}
            onLanesChange={props.onAutomationLanesChange || (() => {})}
          />
        );

      case 'effects-chain':
        return (
          <EffectsChainPanel
            trackId={props.effectsTrackId || ''}
            trackName={props.effectsTrackName || 'Track'}
            effects={props.effects || []}
            onEffectsChange={props.onEffectsChange || (() => {})}
          />
        );

      case 'mixer':
        return (
          <MixerWithBuses
            channels={props.mixerChannels || []}
            buses={props.mixerBuses || []}
            masterVolume={props.masterVolume ?? 0.85}
            trackNames={props.trackNames || new Map()}
            trackColors={props.trackColors || new Map()}
            onChannelsChange={props.onMixerChannelsChange || (() => {})}
            onBusesChange={props.onMixerBusesChange || (() => {})}
            onMasterVolumeChange={props.onMasterVolumeChange || (() => {})}
          />
        );

      case 'recording':
        return (
          <RecordingPanel
            trackId={props.recordingTrackId || ''}
            trackName={props.recordingTrackName || 'Track'}
            currentBeat={props.currentBeat || 0}
            onTakeReady={props.onTakeReady}
            onLatencyCompensationChange={props.onRecordingLatencyMeasured}
          />
        );

      case 'sample-slicer':
        return (
          <SampleSlicerPanel
            audioUrl={props.slicerAudioUrl}
            audioName={props.slicerAudioName}
            bpm={props.slicerBpm}
            onSlicesReady={props.onSlicesReady}
          />
        );

      case 'freeze-bounce':
        return (
          <FreezeBounceControls
            tracks={props.freezeTracks || []}
            bpm={props.freezeBpm || 120}
            totalBeats={props.freezeTotalBeats || 64}
            onTrackFrozen={props.onTrackFrozen}
            onTrackUnfrozen={props.onTrackUnfrozen}
            onBounceComplete={props.onBounceComplete}
          />
        );

      case 'clip-editor':
        return (
          <ClipEditorOverlay
            clips={props.clips || []}
            selectedClipId={props.selectedClipId ?? null}
            pixelsPerBeat={props.clipPixelsPerBeat || 20}
            gridSize={props.clipGridSize || 0.25}
            bpm={props.clipBpm || 120}
            playheadBeat={props.playheadBeat || 0}
            onClipsChange={props.onClipsChange || (() => {})}
            onSelectClip={props.onSelectClip || (() => {})}
          />
        );

      case 'midi-editor':
        return (
          <MidiEditorPanel
            trackId={props.midiTrackId || ''}
            notes={props.midiNotes || []}
            rootKey={props.midiRootKey || 'C'}
            scaleName={props.midiScaleName || 'major'}
            totalSteps={props.midiTotalSteps || 64}
            pixelsPerStep={props.midiPixelsPerStep || 16}
            onNotesChange={props.onMidiNotesChange || (() => {})}
            onKeyChange={props.onMidiKeyChange}
            onScaleChange={props.onMidiScaleChange}
          />
        );

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
