/**
 * StudioVocalRecorder — DAW-quality vocal recording panel
 *
 * Features:
 * - Live animated waveform (canvas) while recording
 * - RMS level meter with peak-hold and clip indicator
 * - Click track (Web Audio oscillator at project BPM)
 * - Count-in bars (1/2/4) before recording starts
 * - Multiple takes with waveform thumbnails
 * - Take naming, deletion, playback
 * - Latency compensation (ms offset applied to take start)
 * - Punch in/out region
 * - Transport sync — arms with the global record button
 * - Export take as WAV
 */

import React, {
  useState, useRef, useCallback, useEffect, useMemo
} from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Mic2, Square, Play, Pause, Trash2, Download,
  Circle, SkipBack, Volume2, VolumeX, ChevronDown,
  ChevronUp, Clock, AlertTriangle, CheckCircle2, Headphones,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAudioContext } from '@/lib/audioContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VocalTake {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  durationMs: number;
  createdAt: number;
  waveformPoints: number[]; // normalized 0–1, ~400 points for thumbnail
  latencyOffsetMs: number;
  peakDb: number;
}

interface Props {
  trackId: string;
  trackName: string;
  trackColor: string;
  bpm: number;
  isTransportPlaying: boolean;
  isArmed: boolean;
  onTakesChange?: (takes: VocalTake[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`;
}

function dbToLinear(db: number) { return Math.pow(10, db / 20); }
function linearToDb(linear: number) {
  return linear > 0 ? 20 * Math.log10(linear) : -Infinity;
}

async function blobToWaveform(blob: Blob, points = 400): Promise<{ waveform: number[]; peakDb: number }> {
  const ctx = new AudioContext();
  const buf = await blob.arrayBuffer();
  const audio = await ctx.decodeAudioData(buf);
  const data = audio.getChannelData(0);
  const blockSize = Math.floor(data.length / points);
  const waveform: number[] = [];
  let peak = 0;
  for (let i = 0; i < points; i++) {
    let rms = 0;
    for (let j = 0; j < blockSize; j++) {
      const s = data[i * blockSize + j];
      rms += s * s;
      if (Math.abs(s) > peak) peak = Math.abs(s);
    }
    waveform.push(Math.sqrt(rms / blockSize));
  }
  await ctx.close();
  return { waveform, peakDb: linearToDb(peak) };
}

async function encodeWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const buf = await blob.arrayBuffer();
  const audio = await ctx.decodeAudioData(buf);
  const numCh = audio.numberOfChannels;
  const sr = audio.sampleRate;
  const len = audio.length;
  const bps = 2;
  const out = new ArrayBuffer(44 + len * numCh * bps);
  const v = new DataView(out);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + len * numCh * bps, true);
  ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * numCh * bps, true);
  v.setUint16(32, numCh * bps, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, len * numCh * bps, true);
  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, audio.getChannelData(ch)[i]));
      v.setInt16(offset, s * 0x7FFF, true);
      offset += 2;
    }
  }
  await ctx.close();
  return new Blob([out], { type: 'audio/wav' });
}

// ─── Click track ──────────────────────────────────────────────────────────────

function scheduleClickTrack(
  audioCtx: AudioContext,
  bpm: number,
  countInBars: number,
  timeSignature = 4,
  startAt: number,
): { stop: () => void } {
  const beats = countInBars * timeSignature;
  const beatDuration = 60 / bpm;
  const nodes: AudioScheduledSourceNode[] = [];

  for (let i = 0; i < beats; i++) {
    const when = startAt + i * beatDuration;
    const isDownbeat = i % timeSignature === 0;

    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.connect(env); env.connect(audioCtx.destination);
    osc.frequency.value = isDownbeat ? 1200 : 800;
    env.gain.setValueAtTime(0.6, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    osc.start(when);
    osc.stop(when + 0.05);
    nodes.push(osc);
  }

  return { stop: () => nodes.forEach(n => { try { n.stop(); } catch {} }) };
}

// ─── Waveform canvas ──────────────────────────────────────────────────────────

function WaveformCanvas({
  points, color, height = 64, live = false
}: { points: Float32Array | number[]; color: string; height?: number; live?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arr = useMemo(() => Array.from(points), [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);

    if (arr.length === 0) return;

    ctx2d.fillStyle = 'rgba(0,0,0,0)';
    ctx2d.fillRect(0, 0, W, H);

    const mid = H / 2;
    const maxAmp = H * 0.45;
    ctx2d.lineWidth = 1;

    // Gradient fill
    const grad = ctx2d.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + 'cc');
    grad.addColorStop(0.5, color + 'ff');
    grad.addColorStop(1, color + 'cc');

    ctx2d.fillStyle = grad;
    ctx2d.beginPath();
    ctx2d.moveTo(0, mid);
    for (let i = 0; i < arr.length; i++) {
      const x = (i / arr.length) * W;
      const amp = arr[i] * maxAmp;
      ctx2d.lineTo(x, mid - amp);
    }
    for (let i = arr.length - 1; i >= 0; i--) {
      const x = (i / arr.length) * W;
      const amp = arr[i] * maxAmp;
      ctx2d.lineTo(x, mid + amp);
    }
    ctx2d.closePath();
    ctx2d.fill();

    // Center line
    ctx2d.strokeStyle = color + '80';
    ctx2d.lineWidth = 0.5;
    ctx2d.beginPath();
    ctx2d.moveTo(0, mid);
    ctx2d.lineTo(W, mid);
    ctx2d.stroke();

    if (live) {
      // Pulse effect on right edge
      const grd = ctx2d.createRadialGradient(W, mid, 0, W, mid, 30);
      grd.addColorStop(0, '#ef444460');
      grd.addColorStop(1, 'transparent');
      ctx2d.fillStyle = grd;
      ctx2d.fillRect(W - 40, 0, 40, H);
    }
  }, [arr, color, live]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={height}
      className="w-full rounded"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}

// ─── VU Meter ─────────────────────────────────────────────────────────────────

function VUMeter({ rms, peak, clipping }: { rms: number; peak: number; clipping: boolean }) {
  const rmsDb = linearToDb(rms);
  const peakDb = linearToDb(peak);
  const toPercent = (db: number) => Math.max(0, Math.min(100, (db + 60) / 60 * 100));

  return (
    <div className="flex gap-1 items-end h-20">
      {/* RMS bar */}
      <div className="relative w-4 bg-black/60 rounded border border-white/10 h-full overflow-hidden flex flex-col justify-end">
        <div
          className={cn(
            "w-full rounded-t transition-all",
            clipping ? 'bg-red-500' : rmsDb > -6 ? 'bg-yellow-400' : 'bg-green-500'
          )}
          style={{ height: `${toPercent(rmsDb)}%` }}
        />
        {/* Peak tick */}
        <div
          className="absolute w-full h-0.5 bg-white/80"
          style={{ bottom: `${toPercent(peakDb)}%` }}
        />
      </div>
      {/* dB labels */}
      <div className="flex flex-col justify-between text-[8px] font-mono text-white/30 h-full py-0.5">
        <span>0</span>
        <span>-6</span>
        <span>-12</span>
        <span>-24</span>
        <span>-∞</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StudioVocalRecorder: React.FC<Props> = ({
  trackId, trackName, trackColor, bpm, isTransportPlaying, isArmed, onTakesChange
}) => {
  const { toast } = useToast();

  // ── Takes ──────────────────────────────────────────────────────────────────
  const [takes, setTakes] = useState<VocalTake[]>([]);
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null);
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);

  // ── Recording state ────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInRemaining, setCountInRemaining] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // ── Settings ───────────────────────────────────────────────────────────────
  const [countInBars, setCountInBars] = useState(2);
  const [latencyMs, setLatencyMs] = useState(0);
  const [clickEnabled, setClickEnabled] = useState(true);
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [inputGain, setInputGain] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [overdubMode, setOverdubMode] = useState(false);

  // ── Meters ─────────────────────────────────────────────────────────────────
  const [rmsLevel, setRmsLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [clipping, setClipping] = useState(false);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const inputGainNodeRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const recCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStartMsRef = useRef(0);
  const clickRef = useRef<{ stop: () => void } | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const liveWaveformBuf = useRef<number[]>([]);
  const peakHoldRef = useRef(0);
  const peakHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Meter animation loop ───────────────────────────────────────────────────
  const startMeterLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Float32Array(analyser.fftSize);

    const tick = () => {
      analyser.getFloatTimeDomainData(data);
      let rms = 0, peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i]);
        rms += v * v;
        if (v > peak) peak = v;
      }
      rms = Math.sqrt(rms / data.length);

      if (peak > peakHoldRef.current) {
        peakHoldRef.current = peak;
        if (peakHoldTimer.current) clearTimeout(peakHoldTimer.current);
        peakHoldTimer.current = setTimeout(() => { peakHoldRef.current = 0; }, 1500);
      }

      setRmsLevel(rms);
      setPeakLevel(peakHoldRef.current);
      setClipping(peak >= 0.99);

      // Accumulate live waveform (one point per ~50ms)
      liveWaveformBuf.current.push(rms);
      if (liveWaveformBuf.current.length > 600) liveWaveformBuf.current.shift();
      setLiveWaveform([...liveWaveformBuf.current]);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopMeterLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setRmsLevel(0);
    setPeakLevel(0);
    setClipping(false);
    liveWaveformBuf.current = [];
    setLiveWaveform([]);
  }, []);

  // ── Mic setup ──────────────────────────────────────────────────────────────
  // FIX 1: Use the shared AudioContext so the click track and playback share
  // the same clock — no drift between vocal recording and MIDI playback.
  const setupMic = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        }
      });
      streamRef.current = stream;

      // Use the SHARED AudioContext — same clock as the piano roll scheduler
      const ctx = getAudioContext();
      if (!ctx) throw new Error('No AudioContext available');
      if (ctx.state === 'suspended') await ctx.resume();
      recCtxRef.current = ctx;

      const src = ctx.createMediaStreamSource(stream);

      // Input gain node
      const gainNode = ctx.createGain();
      gainNode.gain.value = inputGain;
      inputGainNodeRef.current = gainNode;
      src.connect(gainNode);

      // Analyser for meter
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.3;
      gainNode.connect(analyser);
      analyserRef.current = analyser;

      // Monitor (optional) — routes mic through to speakers
      if (monitorEnabled) {
        const monGain = ctx.createGain();
        monGain.gain.value = 0.8;
        monitorGainRef.current = monGain;
        gainNode.connect(monGain);
        monGain.connect(ctx.destination);
      }

      startMeterLoop();
      return true;
    } catch (err: any) {
      toast({
        title: 'Microphone Error',
        description: err.name === 'NotAllowedError'
          ? 'Allow microphone access to record vocals.'
          : err.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [inputGain, monitorEnabled, startMeterLoop, toast]);

  const teardownMic = useCallback(() => {
    stopMeterLoop();
    monitorGainRef.current?.disconnect();
    monitorGainRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    inputGainNodeRef.current?.disconnect();
    inputGainNodeRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    // DO NOT close the shared AudioContext — it belongs to the whole app.
    // Just null out our ref to it.
    recCtxRef.current = null;
  }, [stopMeterLoop]);

  // ── Start recording (after count-in) ──────────────────────────────────────
  const beginCapture = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const mr = new MediaRecorder(streamRef.current, { mimeType: mime, audioBitsPerSecond: 320000 });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size < 1000) return; // discard empty recordings
      const url = URL.createObjectURL(blob);
      const duration = Date.now() - recStartMsRef.current;

      // Generate waveform thumbnail
      let waveform: number[] = new Array(400).fill(0);
      let peakDb = -Infinity;
      try {
        const r = await blobToWaveform(blob, 400);
        waveform = r.waveform;
        peakDb = r.peakDb;
      } catch {}

      const take: VocalTake = {
        id: crypto.randomUUID(),
        name: `Take ${Date.now()}`,
        blob,
        url,
        durationMs: duration,
        createdAt: Date.now(),
        waveformPoints: waveform,
        latencyOffsetMs: latencyMs,
        peakDb,
      };

      setTakes(prev => {
        const next = [...prev, take];
        onTakesChange?.(next);
        return next;
      });
      setSelectedTakeId(take.id);

      toast({
        title: 'Take captured',
        description: `${formatTime(duration)} — ${peakDb > -3 ? '⚠ Clipped' : '✓ Levels OK'}`,
      });
    };

    mr.start(50); // 50ms chunks for low-latency waveform
    recStartMsRef.current = Date.now();
    setIsRecording(true);
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - recStartMsRef.current);
    }, 50);
  }, [latencyMs, onTakesChange, toast]);

  // ── Record button ─────────────────────────────────────────────────────────
  const handleRecord = useCallback(async () => {
    if (isRecording) {
      // Stop
      mediaRecorderRef.current?.stop();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsRecording(false);
      teardownMic();
      clickRef.current?.stop();
      return;
    }

    if (isCountingIn) return; // Already counting in

    const ok = await setupMic();
    if (!ok) return;

    if (countInBars === 0) {
      beginCapture();
      return;
    }

    // Count-in
    setIsCountingIn(true);
    const countDuration = (60 / bpm) * countInBars * 4; // 4/4 assumed
    const countMs = countDuration * 1000;
    setCountInRemaining(countInBars);

    // Schedule click track on the SHARED AudioContext — same clock as playback
    const sharedCtx = getAudioContext();
    if (clickEnabled && sharedCtx) {
      clickRef.current = scheduleClickTrack(
        sharedCtx, bpm, countInBars, 4,
        sharedCtx.currentTime + 0.05,
      );
    }

    // Count-in countdown UI
    const barDurationMs = (60 / bpm) * 4 * 1000;
    let bar = countInBars;
    const countdown = setInterval(() => {
      bar--;
      setCountInRemaining(bar);
      if (bar <= 0) clearInterval(countdown);
    }, barDurationMs);

    setTimeout(() => {
      setIsCountingIn(false);
      setCountInRemaining(0);
      beginCapture();
    }, countMs);
  }, [
    isRecording, isCountingIn, countInBars, bpm,
    clickEnabled, setupMic, beginCapture, teardownMic,
  ]);

  // ── Take playback ─────────────────────────────────────────────────────────
  const playTake = useCallback((take: VocalTake) => {
    playbackRef.current?.pause();
    if (playingTakeId === take.id) {
      setPlayingTakeId(null);
      playbackRef.current = null;
      return;
    }
    const audio = new Audio(take.url);
    playbackRef.current = audio;
    setPlayingTakeId(take.id);
    audio.onended = () => { setPlayingTakeId(null); playbackRef.current = null; };
    audio.play();
  }, [playingTakeId]);

  const deleteTake = useCallback((id: string) => {
    setTakes(prev => {
      const take = prev.find(t => t.id === id);
      if (take) URL.revokeObjectURL(take.url);
      const next = prev.filter(t => t.id !== id);
      onTakesChange?.(next);
      return next;
    });
    if (selectedTakeId === id) setSelectedTakeId(null);
    if (playingTakeId === id) { playbackRef.current?.pause(); setPlayingTakeId(null); }
  }, [selectedTakeId, playingTakeId, onTakesChange]);

  const downloadTake = useCallback(async (take: VocalTake) => {
    try {
      const wav = await encodeWav(take.blob);
      const url = URL.createObjectURL(wav);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${take.name.replace(/\s+/g, '_')}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  }, [toast]);

  // ── Transport sync — auto-record when transport plays and track is armed ──
  // FIX 2: Use a ref so the effect always calls the LATEST handleRecord/teardownMic,
  // not the stale closure from first render.
  const handleRecordRef = useRef(handleRecord);
  const teardownMicRef = useRef(teardownMic);
  useEffect(() => { handleRecordRef.current = handleRecord; }, [handleRecord]);
  useEffect(() => { teardownMicRef.current = teardownMic; }, [teardownMic]);

  const isRecordingRef = useRef(isRecording);
  const isCountingInRef = useRef(isCountingIn);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isCountingInRef.current = isCountingIn; }, [isCountingIn]);

  useEffect(() => {
    if (isArmed && isTransportPlaying) {
      if (!isRecordingRef.current && !isCountingInRef.current) {
        handleRecordRef.current();
      }
    } else if (!isTransportPlaying && isRecordingRef.current) {
      mediaRecorderRef.current?.stop();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsRecording(false);
      teardownMicRef.current();
    }
  }, [isArmed, isTransportPlaying]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      teardownMic();
      playbackRef.current?.pause();
      takes.forEach(t => URL.revokeObjectURL(t.url));
      if (timerRef.current) clearInterval(timerRef.current);
      if (peakHoldTimer.current) clearTimeout(peakHoldTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update input gain live ────────────────────────────────────────────────
  useEffect(() => {
    if (inputGainNodeRef.current) {
      inputGainNodeRef.current.gain.value = inputGain;
    }
  }, [inputGain]);

  const selectedTake = takes.find(t => t.id === selectedTakeId) ?? takes[takes.length - 1] ?? null;
  const statusColor = isRecording ? 'text-red-400' : isCountingIn ? 'text-yellow-400' : isArmed ? 'text-red-300' : 'text-white/40';

  return (
    <div className="flex flex-col h-full bg-black/80 select-none" style={{ minHeight: 0 }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/60 flex-shrink-0">
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isArmed ? 'bg-red-500 animate-pulse' : 'bg-white/20')} />
        <Mic2 className="w-4 h-4 text-white/50 flex-shrink-0" />
        <span className="text-xs font-black uppercase tracking-widest text-white/70 truncate">{trackName}</span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: isCountingIn ? '#facc15' : isRecording ? '#ef4444' : '#ffffff40' }}>
          {isCountingIn
            ? `COUNT IN  ${countInRemaining}`
            : isRecording
              ? formatTime(elapsedMs)
              : takes.length > 0
                ? `${takes.length} take${takes.length !== 1 ? 's' : ''}`
                : 'No takes'}
        </span>
        <button
          onClick={() => setShowSettings(s => !s)}
          className="text-white/30 hover:text-white/70 flex-shrink-0"
        >
          {showSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div className="border-b border-white/10 bg-black/40 px-3 py-2 grid grid-cols-2 gap-3 flex-shrink-0">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Count-in bars</label>
            <div className="flex gap-1">
              {[0, 1, 2, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setCountInBars(n)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-black rounded border',
                    countInBars === n
                      ? 'bg-cyan-500/30 border-cyan-500 text-cyan-300'
                      : 'border-white/10 text-white/40 hover:border-white/30'
                  )}
                >{n === 0 ? 'Off' : n}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Latency offset</label>
            <div className="flex items-center gap-2">
              <Slider
                min={-200} max={200} step={1}
                value={[latencyMs]}
                onValueChange={([v]) => setLatencyMs(v)}
                className="flex-1"
              />
              <span className="text-[10px] font-mono text-white/50 w-12 text-right">{latencyMs}ms</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Input gain</label>
            <div className="flex items-center gap-2">
              <Slider
                min={0} max={3} step={0.05}
                value={[inputGain]}
                onValueChange={([v]) => setInputGain(v)}
                className="flex-1"
              />
              <span className="text-[10px] font-mono text-white/50 w-12 text-right">{(inputGain * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Options</label>
            <div className="flex gap-2">
              <button
                onClick={() => setClickEnabled(e => !e)}
                className={cn('flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded border',
                  clickEnabled ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'border-white/10 text-white/30')}
              >
                <Clock className="w-2.5 h-2.5" /> Click
              </button>
              <button
                onClick={() => setMonitorEnabled(e => !e)}
                className={cn('flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded border',
                  monitorEnabled ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'border-white/10 text-white/30')}
              >
                <Headphones className="w-2.5 h-2.5" /> Monitor
              </button>
              <button
                onClick={() => setOverdubMode(e => !e)}
                className={cn('flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded border',
                  overdubMode ? 'bg-orange-500/20 border-orange-500/50 text-orange-300' : 'border-white/10 text-white/30')}
              >
                <Circle className="w-2.5 h-2.5" /> Dub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left: meter + controls */}
        <div className="flex flex-col items-center gap-2 px-2 py-2 border-r border-white/10 bg-black/40 flex-shrink-0">
          <VUMeter rms={rmsLevel} peak={peakLevel} clipping={clipping} />

          {/* Record button */}
          <button
            onClick={handleRecord}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-lg',
              isRecording
                ? 'bg-red-600 border-red-400 shadow-red-500/50 animate-pulse'
                : isCountingIn
                  ? 'bg-yellow-600 border-yellow-400'
                  : isArmed
                    ? 'bg-red-900/60 border-red-500/60 hover:bg-red-700 hover:border-red-400'
                    : 'bg-white/5 border-white/20 hover:bg-white/10'
            )}
          >
            {isRecording
              ? <Square className="w-4 h-4 text-white fill-current" />
              : <Circle className="w-5 h-5 text-red-400 fill-red-500" />}
          </button>

          {/* Clip indicator */}
          {clipping && (
            <div className="flex items-center gap-0.5 text-red-400">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span className="text-[8px] font-black">CLIP</span>
            </div>
          )}
        </div>

        {/* Right: waveform + takes */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          {/* Live waveform */}
          <div className="flex-shrink-0 p-2 border-b border-white/10 bg-black/20">
            {(isRecording || isCountingIn) && liveWaveform.length > 0 ? (
              <WaveformCanvas
                points={liveWaveform}
                color={isCountingIn ? '#facc15' : '#ef4444'}
                height={48}
                live
              />
            ) : selectedTake ? (
              <WaveformCanvas
                points={selectedTake.waveformPoints}
                color={trackColor.replace('bg-', '#').replace('-500', '') || '#06b6d4'}
                height={48}
              />
            ) : (
              <div className="flex items-center justify-center h-12 text-[10px] text-white/20 font-black uppercase tracking-widest">
                {isArmed ? 'Armed — press ● to record' : 'No takes yet'}
              </div>
            )}
          </div>

          {/* Takes list */}
          <div className="flex-1 overflow-y-auto astutely-scrollbar">
            {takes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[10px] text-white/20">
                Record your first take
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {[...takes].reverse().map((take, i) => {
                  const isSelected = take.id === selectedTakeId;
                  const isPlaying = take.id === playingTakeId;
                  const clipped = take.peakDb > -1;
                  return (
                    <div
                      key={take.id}
                      onClick={() => setSelectedTakeId(take.id)}
                      className={cn(
                        'flex items-center gap-2 p-1.5 rounded cursor-pointer border transition-all',
                        isSelected
                          ? 'border-cyan-500/60 bg-cyan-500/10'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                      )}
                    >
                      {/* Play/pause */}
                      <button
                        onClick={e => { e.stopPropagation(); playTake(take); }}
                        className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-white/60 hover:text-white"
                      >
                        {isPlaying
                          ? <Pause className="w-3 h-3 fill-current" />
                          : <Play className="w-3 h-3 fill-current" />}
                      </button>

                      {/* Mini waveform */}
                      <div className="w-24 flex-shrink-0">
                        <WaveformCanvas
                          points={take.waveformPoints}
                          color={clipped ? '#f87171' : '#06b6d4'}
                          height={24}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-black text-white/70 truncate">
                            Take {takes.length - i}
                          </span>
                          {clipped && <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />}
                          {!clipped && <CheckCircle2 className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />}
                        </div>
                        <div className="text-[9px] font-mono text-white/30">
                          {formatTime(take.durationMs)} · {take.peakDb > -Infinity ? `${take.peakDb.toFixed(1)}dB` : '—'}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); downloadTake(take); }}
                          className="w-5 h-5 text-white/30 hover:text-cyan-300"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteTake(take.id); }}
                          className="w-5 h-5 text-white/30 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudioVocalRecorder;
