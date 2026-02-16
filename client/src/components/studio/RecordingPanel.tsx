import { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Circle, Square, Pause, Play, Trash2, Check, Monitor, MonitorOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getInputDevices,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  startMonitoring,
  stopMonitoring,
  setRecordingConfig,
  subscribeRecording,
  selectTake,
  deleteTake,
  measureLatency,
  type RecordingState,
  type RecordingTake,
} from '@/lib/recordingEngine';

interface RecordingPanelProps {
  trackId: string;
  trackName: string;
  currentBeat: number;
  onTakeReady?: (take: RecordingTake) => void;
}

export default function RecordingPanel({
  trackId,
  trackName,
  currentBeat,
  onTakeReady,
}: RecordingPanelProps) {
  const { toast } = useToast();
  const [state, setState] = useState<RecordingState | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [monitorVolume, setMonitorVolume] = useState(0.8);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [punchIn, setPunchIn] = useState<number | null>(null);
  const [punchOut, setPunchOut] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribeRecording(setState);
    return unsub;
  }, []);

  useEffect(() => {
    getInputDevices().then(devs => {
      setDevices(devs);
      if (devs.length > 0 && !selectedDevice) {
        setSelectedDevice(devs[0].deviceId);
      }
    });
  }, [selectedDevice]);

  const handleDeviceChange = useCallback((deviceId: string) => {
    setSelectedDevice(deviceId);
    setRecordingConfig({ inputDeviceId: deviceId });
  }, []);

  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording(trackId, currentBeat, {
        inputDeviceId: selectedDevice || undefined,
        monitorInput: isMonitoring,
        monitorVolume,
        punchInBeat: punchIn,
        punchOutBeat: punchOut,
      });
      toast({ title: 'Recording Started' });
    } catch (err) {
      toast({ title: 'Recording Failed', description: String(err), variant: 'destructive' });
    }
  }, [trackId, currentBeat, selectedDevice, isMonitoring, monitorVolume, punchIn, punchOut, toast]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
    toast({ title: 'Recording Stopped' });
    // The latest take will be available via the subscription
    if (state?.takes) {
      const latest = state.takes[state.takes.length - 1];
      if (latest) onTakeReady?.(latest);
    }
  }, [toast, state, onTakeReady]);

  const handleToggleMonitoring = useCallback(async () => {
    if (isMonitoring) {
      stopMonitoring();
      setIsMonitoring(false);
    } else {
      try {
        await startMonitoring();
        setIsMonitoring(true);
      } catch (err) {
        toast({ title: 'Monitoring Failed', description: String(err), variant: 'destructive' });
      }
    }
  }, [isMonitoring, toast]);

  const handleMeasureLatency = useCallback(async () => {
    const ms = await measureLatency();
    setLatencyMs(ms);
    setRecordingConfig({ latencyCompensationMs: ms });
    toast({ title: 'Latency Measured', description: `${ms}ms estimated round-trip` });
  }, [toast]);

  const handleSelectTake = useCallback((takeId: string) => {
    selectTake(takeId);
    const take = state?.takes.find(t => t.id === takeId);
    if (take) onTakeReady?.(take);
  }, [state, onTakeReady]);

  const handleDeleteTake = useCallback((takeId: string) => {
    deleteTake(takeId);
  }, []);

  const trackTakes = state?.takes.filter(t => t.trackId === trackId) || [];
  const isRecording = state?.isRecording ?? false;
  const isPaused = state?.isPaused ?? false;

  const formatTime = (ms: number): string => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins}:${remainSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-700 w-80">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Mic className="w-4 h-4 text-red-400" />
          Record - {trackName}
        </h3>
        {isRecording && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-mono">{formatTime(state?.elapsedMs ?? 0)}</span>
          </div>
        )}
      </div>

      {/* Input device selector */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Input Device</span>
        <Select value={selectedDevice} onValueChange={handleDeviceChange}>
          <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-600">
            <SelectValue placeholder="Select input..." />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-600">
            {devices.map(d => (
              <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                {d.label || `Input ${d.deviceId.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Monitor controls */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isMonitoring ? 'secondary' : 'outline'}
          onClick={handleToggleMonitoring}
          className="gap-1 text-xs h-7"
        >
          {isMonitoring ? <Monitor className="w-3 h-3" /> : <MonitorOff className="w-3 h-3" />}
          {isMonitoring ? 'Monitoring' : 'Monitor'}
        </Button>
        {isMonitoring && (
          <Slider
            value={[monitorVolume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v]) => { setMonitorVolume(v); setRecordingConfig({ monitorVolume: v }); }}
            className="flex-1 h-4"
          />
        )}
      </div>

      {/* Latency */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={handleMeasureLatency} className="text-xs h-6 px-2">
          Measure Latency
        </Button>
        {latencyMs > 0 && (
          <span className="text-[10px] text-zinc-500">{latencyMs}ms compensation</span>
        )}
      </div>

      {/* Punch in/out */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-[10px] text-zinc-500">Punch In (beat)</span>
          <input
            type="number"
            value={punchIn ?? ''}
            onChange={(e) => setPunchIn(e.target.value ? Number(e.target.value) : null)}
            placeholder="--"
            className="h-6 w-full text-xs bg-zinc-800 border border-zinc-600 rounded px-2 text-white"
          />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-[10px] text-zinc-500">Punch Out (beat)</span>
          <input
            type="number"
            value={punchOut ?? ''}
            onChange={(e) => setPunchOut(e.target.value ? Number(e.target.value) : null)}
            placeholder="--"
            className="h-6 w-full text-xs bg-zinc-800 border border-zinc-600 rounded px-2 text-white"
          />
        </div>
      </div>

      {/* Record controls */}
      <div className="flex items-center gap-2 justify-center">
        {!isRecording ? (
          <Button
            onClick={handleStartRecording}
            className="bg-red-600 hover:bg-red-700 text-white gap-1 px-6"
            disabled={devices.length === 0}
          >
            <Circle className="w-4 h-4 fill-current" /> Record
          </Button>
        ) : (
          <>
            {isPaused ? (
              <Button onClick={resumeRecording} variant="outline" className="gap-1">
                <Play className="w-4 h-4" /> Resume
              </Button>
            ) : (
              <Button onClick={pauseRecording} variant="outline" className="gap-1">
                <Pause className="w-4 h-4" /> Pause
              </Button>
            )}
            <Button onClick={handleStopRecording} variant="destructive" className="gap-1">
              <Square className="w-4 h-4" /> Stop
            </Button>
          </>
        )}
      </div>

      {/* Takes list */}
      {trackTakes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Takes ({trackTakes.length})
          </span>
          {trackTakes.map((take, i) => (
            <div
              key={take.id}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                take.selected ? 'bg-green-500/10 border border-green-500/30' : 'bg-zinc-800/50 hover:bg-zinc-800'
              }`}
              onClick={() => handleSelectTake(take.id)}
            >
              {take.selected && <Check className="w-3 h-3 text-green-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white">Take {i + 1}</div>
                <div className="text-[10px] text-zinc-500">
                  {formatTime(take.durationMs)} - Beat {take.startBeat.toFixed(1)}
                </div>
              </div>
              <audio src={take.audioUrl} className="hidden" />
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); handleDeleteTake(take.id); }}
                className="p-1 h-auto text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
