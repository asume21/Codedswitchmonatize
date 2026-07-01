import { useState, useRef } from 'react';

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

const SENSORS = [
  { name: 'WebEar', emoji: '👂', status: 'Live', desc: 'Hears your music — BPM, loudness, groove, instruments, mix coaching.' },
  { name: 'WebEye', emoji: '👁️', status: 'Live', desc: 'Sees your screen — UI layout, canvas animations, visual bugs.' },
  { name: 'WebSense', emoji: '🫀', status: 'Live', desc: 'Feels performance — frame rate, memory, audio latency, layout shifts.' },
  { name: 'WebNerve', emoji: '⚡', status: 'Live', desc: 'Measures network — API latencies, connection quality, storage.' },
  { name: 'WebShield', emoji: '🛡️', status: 'Live', desc: 'Audits security — cookies, CSP headers, storage exposure, framing.' },
  { name: 'WebLog', emoji: '📋', status: 'Live', desc: 'Reads the console — errors, exceptions, app state snapshots.' },
];

function BandBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-right text-zinc-400 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-zinc-400">{pct}%</span>
    </div>
  );
}

function MetricCard({ label, value, unit, accent }: { label: string; value: string | number; unit?: string; accent?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? 'text-white'}`}>
        {value}
        {unit && <span className="text-sm font-normal text-zinc-400 ml-1">{unit}</span>}
      </span>
    </div>
  );
}

export default function DemoPage() {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [result, setResult] = useState<PerceptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureSeconds, setCaptureSeconds] = useState(5);
  const streamRef = useRef<MediaStream | null>(null);

  async function runPerception() {
    setError(null);
    setResult(null);

    // Step 1: Ask user to share tab audio.
    // Chrome requires video:true in getDisplayMedia — we request it then immediately
    // stop the video tracks so only audio is captured.
    setCaptureState('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false } as any,
        video: true,
      } as any);
      // Drop video tracks — we only want audio
      stream.getVideoTracks().forEach(t => t.stop());
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('No audio track. Make sure to pick a browser tab (not a window or screen) and check "Share tab audio".');
      }
      streamRef.current = stream;
    } catch (e: any) {
      setCaptureState('error');
      setError(
        e.name === 'NotAllowedError' || e.name === 'AbortError'
          ? 'Share was cancelled. Click Perceive again and pick a browser tab, then confirm sharing.'
          : e.message ?? 'Could not capture tab audio.'
      );
      return;
    }

    // Step 2: Record for captureSeconds
    setCaptureState('capturing');
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start(100);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        recorder.stop();
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }, captureSeconds * 1000);
      recorder.onstop = () => resolve();
    });

    // Step 3: Analyze
    setCaptureState('analyzing');
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const fd = new FormData();
    fd.append('audio', blob, 'capture.webm');

    try {
      const res = await fetch('/api/demo/perceive', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: PerceptionResult = await res.json();
      setResult(data);
      setCaptureState('done');
    } catch (e: any) {
      setCaptureState('error');
      setError(`Analysis failed: ${e.message}`);
    }
  }

  const clippingColor = result
    ? result.clipping.percent > 1 ? 'text-red-400' : result.clipping.percent > 0.1 ? 'text-yellow-400' : 'text-emerald-400'
    : 'text-white';

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          AI Perception Platform — Live
        </div>
        <h1 className="text-5xl font-black tracking-tight mb-4">
          Your AI can think.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Now let it hear, see & feel.
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
          AI models are brains in a jar. CodedSwitch's AI Perception Platform gives any AI model
          direct real-time senses — through the browser, via MCP.
        </p>
      </div>

      {/* Live Demo */}
      <div className="max-w-3xl mx-auto px-6 mb-16">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">

          {/* Demo header */}
          <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">👂 WebEar — Live Audio Perception</h2>
              <p className="text-zinc-400 text-sm mt-0.5">
                Play any music in your browser, then click Perceive. Claude will hear it.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <select
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                value={captureSeconds}
                onChange={e => setCaptureSeconds(Number(e.target.value))}
              >
                <option value={3}>3s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={15}>15s</option>
              </select>
            </div>
          </div>

          {/* Demo body */}
          <div className="p-6">

            {/* Instructions */}
            {captureState === 'idle' && (
              <ol className="text-zinc-400 text-sm space-y-1 mb-6 list-decimal list-inside">
                <li>Open CodedSwitch Studio (or any music) in another tab and start it playing.</li>
                <li>Come back here and click <strong className="text-white">Perceive</strong>.</li>
                <li>When Chrome asks, pick <em>Share tab audio</em> for the tab playing music.</li>
                <li>Watch Claude describe what it hears in real-time.</li>
              </ol>
            )}

            {/* Capture state messages */}
            {captureState === 'requesting' && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🎧</div>
                <p className="text-zinc-300 font-semibold">Choose a tab to share</p>
                <p className="text-zinc-500 text-sm mt-1">Pick the tab playing your music, then click Share.</p>
              </div>
            )}
            {captureState === 'capturing' && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3 animate-bounce">👂</div>
                <p className="text-zinc-300 font-semibold">Claude is listening…</p>
                <p className="text-zinc-500 text-sm mt-1">Capturing {captureSeconds} seconds of audio.</p>
              </div>
            )}
            {captureState === 'analyzing' && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🧠</div>
                <p className="text-zinc-300 font-semibold">Analyzing…</p>
                <p className="text-zinc-500 text-sm mt-1">Running signal analysis + AI description.</p>
              </div>
            )}
            {captureState === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Results */}
            {result && captureState === 'done' && (
              <div className="space-y-6">

                {/* Key metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard
                    label="BPM"
                    value={result.bpm ?? '—'}
                    accent="text-emerald-400"
                  />
                  <MetricCard
                    label="Loudness"
                    value={result.rmsDb === -Infinity ? '-∞' : result.rmsDb.toFixed(1)}
                    unit="dBFS"
                  />
                  <MetricCard
                    label="Peak"
                    value={result.peakDb.toFixed(1)}
                    unit="dBFS"
                    accent={result.peakDb > 0 ? 'text-red-400' : 'text-white'}
                  />
                  <MetricCard
                    label="Clipping"
                    value={result.clipping.percent.toFixed(2)}
                    unit="%"
                    accent={clippingColor}
                  />
                </div>

                {/* Frequency bands */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Frequency Bands</p>
                  <BandBar label="Sub" value={result.bands.sub} />
                  <BandBar label="Bass" value={result.bands.bass} />
                  <BandBar label="Low Mid" value={result.bands.lowMid} />
                  <BandBar label="Mid" value={result.bands.mid} />
                  <BandBar label="High" value={result.bands.high} />
                </div>

                {/* AI description */}
                {result.description && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">🤖 Claude hears…</p>
                    <p className="text-zinc-300 text-sm leading-relaxed">{result.description}</p>
                  </div>
                )}
                {result.descriptionGated && (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">🤖 AI Description locked</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Sign up free to hear what Claude says about your music.</p>
                    </div>
                    <a
                      href="/signup"
                      className="shrink-0 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg transition-colors"
                    >
                      Sign up free →
                    </a>
                  </div>
                )}

                <p className="text-xs text-zinc-600 text-right">{result.durationSec}s captured · WebEar v1</p>
              </div>
            )}

            {/* CTA button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={runPerception}
                disabled={captureState === 'requesting' || captureState === 'capturing' || captureState === 'analyzing'}
                className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
                  captureState === 'idle' || captureState === 'done' || captureState === 'error'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {captureState === 'idle' ? '👂 Perceive' :
                 captureState === 'requesting' ? 'Waiting for share…' :
                 captureState === 'capturing' ? `Capturing ${captureSeconds}s…` :
                 captureState === 'analyzing' ? 'Analyzing…' :
                 captureState === 'done' ? '👂 Perceive Again' :
                 '↩ Try Again'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sensor grid */}
      <div className="max-w-4xl mx-auto px-6 mb-16">
        <h2 className="text-2xl font-bold text-center mb-2">The Full Sensory Stack</h2>
        <p className="text-zinc-400 text-center text-sm mb-8">
          Six senses. One MCP connection. Any AI agent.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SENSORS.map(s => (
            <div key={s.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{s.emoji}</span>
                <span className="font-bold">{s.name}</span>
                <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{s.status}</span>
              </div>
              <p className="text-zinc-400 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* MCP connect block */}
      <div className="max-w-2xl mx-auto px-6 mb-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Connect any AI in 30 seconds</h2>
        <p className="text-zinc-400 text-sm mb-6">Add this to your Claude Code / Claude Desktop MCP config:</p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-left text-sm font-mono text-zinc-300 overflow-x-auto">
          <pre>{`{
  "mcpServers": {
    "webear": {
      "url": "${window.location.origin}/api/webear/mcp/sse",
      "headers": {
        "Authorization": "Bearer wbr_YOUR_API_KEY"
      }
    }
  }
}`}</pre>
        </div>
        <div className="mt-6 flex justify-center gap-4">
          <a
            href="/studio"
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition-colors"
          >
            Open Studio →
          </a>
          <a
            href="/docs/ai-perception"
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Read Docs
          </a>
        </div>
      </div>

    </div>
  );
}
