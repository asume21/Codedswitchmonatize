import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  Ear, Terminal, Key, Copy, CheckCircle2, ExternalLink,
  Waves, Eye, Activity, Wifi, Shield, ScrollText, ArrowLeft,
} from "lucide-react";

/**
 * Public developer landing page (/developers).
 *
 * This is the funnel entry point for developers arriving from the `webear`
 * npm package. It is intentionally UNAUTHENTICATED — a cold visitor can read
 * what WebEar is and how to get a key without being bounced to /login.
 *
 * The actual key-generation UI lives at /developer (auth-only). This page is
 * marketing + a CTA into that page — NOT a second key generator, so it does
 * not create a "double" of the key UI.
 */
export default function DevelopersPage() {
  const { isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const mcpConfig = `{
  "mcpServers": {
    "webear": {
      "url": "https://www.codedswitch.com/api/webear/mcp/sse",
      "headers": {
        "Authorization": "Bearer wbr_YOUR_API_KEY"
      }
    }
  }
}`;

  const copyConfig = () => {
    navigator.clipboard.writeText(mcpConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const senses = [
    { icon: Waves, label: "WebEar", desc: "Audio — mix, rhythm, clipping" },
    { icon: Eye, label: "WebEye", desc: "Visuals — canvas, layout, UI" },
    { icon: Activity, label: "WebSense", desc: "Performance — FPS, memory" },
    { icon: Wifi, label: "WebNerve", desc: "Network — API latency" },
    { icon: Shield, label: "WebShield", desc: "Security — cookies, CSP" },
    { icon: ScrollText, label: "WebLog", desc: "Console — errors, warnings" },
  ];

  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      {/* Top bar */}
      <div className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/50 hover:text-cyan-400 transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> CodedSwitch
            </span>
          </Link>
          <a
            href="https://www.npmjs.com/package/webear"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors"
          >
            npm docs <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Ear className="w-3.5 h-3.5" /> WebEar · Developer API
          </span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter italic leading-[0.95] mb-6">
          Give your AI<br />
          <span className="text-cyan-400">real senses.</span>
        </h1>
        <p className="text-lg text-white/50 max-w-2xl leading-relaxed mb-10">
          <code className="text-cyan-300 bg-cyan-500/10 px-1.5 rounded">webear</code> is an
          MCP server + browser SDK that lets your AI coding assistant hear, see, and
          feel any live web app — audio, visuals, performance, network, and console —
          captured straight from the browser and analyzed in real time.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          {isAuthenticated ? (
            <Link href="/developer">
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-white uppercase tracking-widest font-bold gap-2 h-12 px-6 shadow-[0_0_25px_rgba(6,182,212,0.35)]">
                <Key className="w-4 h-4" /> Get your API key →
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/signup">
                <Button className="bg-cyan-600 hover:bg-cyan-500 text-white uppercase tracking-widest font-bold gap-2 h-12 px-6 shadow-[0_0_25px_rgba(6,182,212,0.35)]">
                  <Key className="w-4 h-4" /> Sign up free — get your key
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 uppercase tracking-widest font-bold h-12 px-5">
                  Log in
                </Button>
              </Link>
            </>
          )}
        </div>
        <p className="text-xs text-white/30 mt-4 uppercase tracking-widest font-bold">
          Free tier · 50 analyses/day · No credit card
        </p>
      </section>

      {/* Quick start */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-white/5">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-2">Quick Start</div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-8">Three steps to hearing audio</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-3">Step 1 · Install</div>
            <code className="block text-sm font-mono text-white/80 bg-black/40 rounded-lg px-3 py-2">npm install webear</code>
            <p className="text-xs text-white/40 mt-3 leading-relaxed">Add the SDK to the web app you want your AI to hear.</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-cyan-500/20">
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-3">Step 2 · Get your key</div>
            <p className="text-sm text-white/70 leading-relaxed">
              {isAuthenticated ? (
                <>Open the <Link href="/developer"><span className="text-cyan-400 font-bold underline cursor-pointer">Developer API</span></Link> page and click <span className="text-white font-semibold">Generate API Key</span>.</>
              ) : (
                <><Link href="/signup"><span className="text-cyan-400 font-bold underline cursor-pointer">Sign up</span></Link>, then open <span className="text-white font-semibold">Developer API</span> and click <span className="text-white font-semibold">Generate API Key</span>.</>
              )}
            </p>
            <p className="text-xs text-white/40 mt-3 leading-relaxed">Keys start with <code className="text-cyan-300">wbr_</code>. That's your <code className="text-white/60">CODEDSWITCH_API_KEY</code>.</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-3">Step 3 · Connect your IDE</div>
            <p className="text-sm text-white/70 leading-relaxed">Add the MCP server to Claude Code, Cursor, or Windsurf — no local server needed.</p>
            <p className="text-xs text-white/40 mt-3 leading-relaxed">Config below. Runs on the hosted relay.</p>
          </div>
        </div>

        {/* MCP config block */}
        <div className="mt-6 relative">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
            <Terminal className="w-3.5 h-3.5" /> .mcp.json
          </div>
          <pre className="bg-black/50 border border-white/10 rounded-2xl p-5 text-xs font-mono text-white/80 overflow-x-auto">{mcpConfig}</pre>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyConfig}
            className="absolute top-9 right-3 h-8 gap-1.5 text-white/50 hover:text-white hover:bg-white/10 text-xs"
          >
            {copied ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </Button>
        </div>

        <div className="mt-6 flex items-start gap-2 p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-sm text-emerald-300/90">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Then ask your AI: <em className="text-emerald-200">"Capture 3 seconds of audio and tell me why the bass sounds muddy."</em></span>
        </div>
      </section>

      {/* Six senses */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-white/5">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-2">Web Perception</div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-2">One key, six senses</h2>
        <p className="text-sm text-white/40 mb-8 max-w-2xl">WebEar started as audio. The same API key unlocks the full sensory suite.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {senses.map((s) => (
            <div key={s.label} className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <s.icon className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-wide">{s.label}</div>
                <div className="text-xs text-white/40 leading-snug mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-white/5">
        <div className="rounded-3xl bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border border-cyan-500/20 p-10 text-center">
          <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-4">Give your AI ears.</h2>
          <p className="text-white/50 mb-8 max-w-xl mx-auto">Generate a free API key and your coding assistant can hear your app in the next five minutes.</p>
          {isAuthenticated ? (
            <Link href="/developer">
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-white uppercase tracking-widest font-bold gap-2 h-12 px-8 shadow-[0_0_25px_rgba(6,182,212,0.35)]">
                <Key className="w-4 h-4" /> Get your API key →
              </Button>
            </Link>
          ) : (
            <Link href="/signup">
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-white uppercase tracking-widest font-bold gap-2 h-12 px-8 shadow-[0_0_25px_rgba(6,182,212,0.35)]">
                <Key className="w-4 h-4" /> Sign up free — get your key
              </Button>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
