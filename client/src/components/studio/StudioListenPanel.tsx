import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface PerceptionResult {
  bpm: number | null;
  rmsDb: number;
  peakDb: number;
  dynamicRange: number;
  clipping: { percent: number; count: number };
  spectralCentroidHz: number | null;
  bands: { sub: number; bass: number; lowMid: number; mid: number; high: number };
  description: string | null;
  descriptionGated: boolean;
  durationSec: number;
}

type CaptureState = 'idle' | 'requesting' | 'capturing' | 'analyzing' | 'done' | 'error';

function BandBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-right text-cyan-400/60 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-black/60 rounded-full overflow-hidden border border-cyan-500/20">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-cyan-400/60">{pct}%</span>
    </div>
  );
}

export function StudioListenPanel() {
  const [open, setOpen] = useState(false);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [result, setResult] = useState<PerceptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function runCapture() {
    setError(null);
    setResult(null);
    setCaptureState('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false } as any,
        video: true,
      } as any);
      stream.getVideoTracks().forEach(t => t.stop());
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('no-audio');
      }
      streamRef.current = stream;
    } catch (e: any) {
      setCaptureState('error');
      if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
        setError('Share cancelled. Click Listen again, pick this tab, and check "Share tab audio".');
      } else if (e.message === 'no-audio') {
        setError('No audio track detected. Make sure to pick a browser tab and enable "Share tab audio".');
      } else {
        setError('Could not capture tab audio: ' + (e.message ?? 'unknown error'));
      }
      return;
    }

    setCaptureState('capturing');
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start(100);

    await new Promise<void>(resolve => {
      setTimeout(() => {
        recorder.stop();
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }, 5000);
      recorder.onstop = () => resolve();
    });

    setCaptureState('analyzing');
    const blob = new Blob(chunks, { type: mimeType });
    const fd = new FormData();
    fd.append('audio', blob, 'capture.webm');

    try {
      const res = await fetch('/api/demo/perceive', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Server error ${res.status}`);
      }
      const data: PerceptionResult = await res.json();
      setResult(data);
      setCaptureState('done');
    } catch (e: any) {
      setCaptureState('error');
      setError(e.message ?? 'Analysis failed.');
    }
  }

  const clippingColor = result
    ? result.clipping.percent > 1 ? 'text-red-400' : result.clipping.percent > 0.1 ? 'text-yellow-400' : 'text-emerald-400'
    : '';

  return (
    <>
      {/* Trigger button — sits in the top bar */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(o => !o)}
        className={`astutely-button gap-1 text-xs ${open ? 'bg-cyan-500/20 text-cyan-300' : ''}`}
        title="AI Listen — hear what Claude thinks of your mix"
      >
        👂 <span className="hidden sm:inline">Listen</span>
      </Button>

      {/* Floating panel */}
      {open && (
        <div className="absolute top-16 right-2 w-80 z-[9999] astutely-panel bg-black/95 border border-cyan-500/40 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.2)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/30">
            <div>
              <span className="text-sm font-bold text-cyan-100">👂 AI Perception</span>
              <span className="ml-2 text-xs text-cyan-400/60">WebEar</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-cyan-400/60 hover:text-cyan-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Status / instructions */}
            {captureState === 'idle' && (
              <p className="text-xs text-cyan-400/70">
                Hit <strong className="text-cyan-300">Listen</strong> below — Chrome will ask you to share a tab.
                Pick this tab and enable <em>Share tab audio</em>.
              </p>
            )}
            {captureState === 'requesting' && (
              <p className="text-xs text-cyan-300 animate-pulse">
                🎧 Pick this browser tab and enable "Share tab audio"…
              </p>
            )}
            {captureState === 'capturing' && (
              <p className="text-xs text-cyan-300 animate-pulse">
                👂 Listening for 5 seconds…
              </p>
            )}
            {captureState === 'analyzing' && (
              <p className="text-xs text-cyan-300 animate-pulse">
                🧠 Analyzing your mix…
              </p>
            )}
            {captureState === 'error' && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            {/* Results */}
            {result && captureState === 'done' && (
              <div className="space-y-3">
                {/* Top metrics row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'BPM', value: result.bpm ?? '—', accent: 'text-cyan-300' },
                    { label: 'RMS', value: `${result.rmsDb === -Infinity ? '-∞' : result.rmsDb.toFixed(1)} dBFS`, accent: '' },
                    { label: 'Clip', value: `${result.clipping.percent.toFixed(2)}%`, accent: clippingColor },
                  ].map(m => (
                    <div key={m.label} className="bg-black/60 border border-cyan-500/20 rounded-lg p-2 text-center">
                      <div className="text-xs text-cyan-400/50">{m.label}</div>
                      <div className={`text-sm font-bold ${m.accent || 'text-white'}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Band bars */}
                <div className="space-y-1.5">
                  <BandBar label="Sub"     value={result.bands.sub} />
                  <BandBar label="Bass"    value={result.bands.bass} />
                  <BandBar label="Lo-Mid"  value={result.bands.lowMid} />
                  <BandBar label="Mid"     value={result.bands.mid} />
                  <BandBar label="High"    value={result.bands.high} />
                </div>

                {/* AI description */}
                {result.description && (
                  <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
                    <p className="text-xs text-cyan-400 font-semibold mb-1">Claude hears…</p>
                    <p className="text-xs text-cyan-100/80 leading-relaxed">{result.description}</p>
                  </div>
                )}

                <p className="text-xs text-cyan-400/30 text-right">{result.durationSec}s · WebEar</p>
              </div>
            )}

            {/* Action button */}
            <Button
              size="sm"
              onClick={runCapture}
              disabled={captureState === 'requesting' || captureState === 'capturing' || captureState === 'analyzing'}
              className={`w-full astutely-button text-xs ${
                captureState === 'idle' || captureState === 'done' || captureState === 'error'
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  : 'bg-black/40 text-cyan-400/40 cursor-not-allowed'
              }`}
            >
              {captureState === 'idle'       ? '👂 Start Listening'   :
               captureState === 'requesting' ? 'Waiting for share…'  :
               captureState === 'capturing'  ? 'Capturing 5s…'       :
               captureState === 'analyzing'  ? 'Analyzing…'          :
               captureState === 'done'       ? '👂 Listen Again'      :
                                              '↩ Retry'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
