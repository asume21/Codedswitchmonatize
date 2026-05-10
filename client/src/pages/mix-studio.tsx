import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sliders, Volume2, Layers, Zap, ChevronRight, Sparkles, Activity, Gauge } from "lucide-react";

export default function MixStudioLanding() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur border-b border-white/10">
        <Link href="/" className="text-xl font-black tracking-tight text-cyan-400">CodedSwitch</Link>
        <div className="flex items-center gap-3">
          <Link href="/login"><Button variant="ghost" size="sm" className="text-white/70 hover:text-white">Log in</Button></Link>
          <Link href="/signup"><Button size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">Try Free</Button></Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center max-w-4xl mx-auto">
        <Badge className="mb-6 bg-violet-500/20 text-violet-400 border-violet-500/30">Online Mix Studio</Badge>
        <h1 className="text-5xl md:text-6xl font-black mb-6 leading-tight">
          Mix Tracks in Your Browser. No Install Needed.
        </h1>
        <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
          Professional multi-track mixer with EQ, compression, reverb, and AI mastering — all running in your browser. Mix hip-hop beats, stems, and samples without touching a DAW.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="bg-violet-500 hover:bg-violet-400 text-white font-black text-lg px-8">
              Open Mix Studio <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
              Log In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="pb-24 px-6 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              icon: Sliders,
              title: "Multi-Track Mixer",
              desc: "Up to 16 tracks with per-track volume, pan, mute, and solo. Drag-and-drop reordering and real-time waveform display.",
            },
            {
              icon: Zap,
              title: "Pro FX Chain",
              desc: "EQ, compressor, de-esser, reverb, limiter, and noise gate — all built in. Chain effects per track or on the master bus.",
            },
            {
              icon: Gauge,
              title: "AI Mastering Assistant",
              desc: "One-click AI mastering analysis reads your actual mix levels and suggests EQ curves, compression ratios, and limiter settings.",
            },
            {
              icon: Activity,
              title: "Real-Time Spectrum Analyzer",
              desc: "Live FFT spectrum display and reference track A/B comparison. Match your mix to any reference track by ear and eye.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">{title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-6 text-center">
        <div className="max-w-2xl mx-auto rounded-3xl border border-violet-500/20 bg-violet-500/5 p-12">
          <Volume2 className="w-10 h-10 text-violet-400 mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-4">Mix Your First Track Free</h2>
          <p className="text-white/60 mb-8">Sign up free and get access to the full mix studio — no credit card, no install.</p>
          <Link href="/signup">
            <Button size="lg" className="bg-violet-500 hover:bg-violet-400 text-white font-black px-10">
              Start Mixing Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-white/30 text-sm">
        © 2026 CodedSwitch · <Link href="/" className="hover:text-white/60">Home</Link> · <Link href="/studio" className="hover:text-white/60">Studio</Link> · <Link href="/pricing" className="hover:text-white/60">Pricing</Link>
      </footer>
    </div>
  );
}
