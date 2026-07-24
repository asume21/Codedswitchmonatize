// Public, no-login Codebeat hook — the top-of-funnel launch page.
// Paste code → see it become a real song structure instantly → sign up to hear
// it and make your own. Deliberately self-contained: no studio/Organism/TrackStore
// providers, so it loads fast and can't break the way the in-studio version can.
import { useState } from 'react';
import { Link } from 'wouter';
import type { ArrangementPlan } from '../../../shared/arrangement';
import type { CodeFingerprint } from '../../../shared/types/codeFingerprint';

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust'];
const GENRES = ['hiphop', 'lofi', 'trap', 'edm', 'rock', 'rnb', 'jazz', 'pop'];

const EXAMPLE = `function render(entities) {
  for (const e of entities) {
    if (e.visible) draw(e);
    else cull(e);
  }
}
function draw(e) { return e.sprite; }
function cull(e) { return null; }`;

const SECTION_LABEL: Record<string, string> = {
  intro: 'Intro', verse: 'Verse', build: 'Build',
  drop: 'Drop', breakdown: 'Break', drop2: 'Drop 2', outro: 'Outro',
};

export default function CodebeatLanding() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [genre, setGenre] = useState('hiphop');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ArrangementPlan | null>(null);
  const [fp, setFp] = useState<CodeFingerprint | null>(null);

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/code-to-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code || EXAMPLE, language, genre }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.error || 'Something went wrong');
      setPlan(data.plan); setFp(data.fingerprint);
    } catch (e: any) {
      setError(e?.message || 'Could not reach the beat engine. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100 antialiased">
      {/* Nav */}
      <header className="flex items-center justify-between px-5 py-4 max-w-6xl mx-auto">
        <div className="font-mono font-bold tracking-tight text-cyan-300">&gt;_ CodedSwitch</div>
        <Link href="/signup">
          <a className="text-sm rounded-lg border border-cyan-500/40 px-4 py-1.5 text-cyan-200 hover:bg-cyan-500/10 transition">Sign up free</a>
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-5 pt-10 pb-6 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/80 mb-3">Codebeat</div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05] text-balance">
          Turn your <span className="text-cyan-300">code</span> into a <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">beat</span>.
        </h1>
        <p className="mt-4 text-slate-400 max-w-xl mx-auto">
          Paste any function. Your code's real structure — loops, branches, names — becomes a song: key, tempo, a drop with a hook. No signup to try.
        </p>
      </section>

      {/* The tool */}
      <section className="max-w-5xl mx-auto px-5 pb-20 grid gap-5 lg:grid-cols-2">
        {/* Input */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            className="w-full min-h-[240px] rounded-xl bg-black/40 border border-white/10 p-4 font-mono text-sm text-cyan-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-y"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm">
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm">
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <button onClick={generate} disabled={busy}
              className="ml-auto rounded-lg bg-cyan-500 px-5 py-2 text-sm font-bold text-black hover:bg-cyan-400 disabled:opacity-60 transition">
              {busy ? 'Composing…' : '✦ Make my beat'}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        </div>

        {/* Output */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 min-h-[320px] flex flex-col">
          {!plan && (
            <div className="flex-1 grid place-items-center text-center text-slate-500 text-sm px-6">
              Your code's musical shape appears here — hit <span className="text-cyan-300 font-semibold">&nbsp;Make my beat</span>.
            </div>
          )}
          {plan && fp && (
            <>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <Badge>{plan.key}</Badge>
                <Badge>{plan.bpm} BPM</Badge>
                <Badge>{plan.subGenre}</Badge>
                <Badge>{fp.mood}</Badge>
                <Badge>complexity {fp.complexity}/10</Badge>
              </div>
              <div className="mt-4 space-y-1.5">
                {plan.sections.map((s, i) => (
                  <div key={i}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <span className={`text-xs font-black uppercase tracking-wider w-16 ${s.name === 'drop' ? 'text-emerald-300' : 'text-cyan-300/80'}`}>
                      {SECTION_LABEL[s.name] ?? s.name}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500/70 to-emerald-400/70"
                        style={{ width: `${Math.round(s.energy * 100)}%` }} />
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums w-14 text-right">{s.bars} bars</span>
                    {s.score?.melody?.length ? <span className="text-emerald-300 text-xs" title="hook from your code's names">♪ hook</span> : null}
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-5">
                <Link href="/signup">
                  <a className="block w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-black font-black text-center py-3 hover:brightness-110 transition">
                    🎧 Hear it play — sign up free
                  </a>
                </Link>
                <p className="mt-2 text-center text-[11px] text-slate-500">Free account: hear the band play it, make unlimited beats, save & share.</p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-1 text-cyan-200">{children}</span>;
}
