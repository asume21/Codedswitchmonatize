import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Piano, Layers, Music, Mic2, ChevronRight, Cpu, Grid, Play } from "lucide-react";

export default function DawLayoutLanding() {
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
        <Badge className="mb-6 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Online DAW</Badge>
        <h1 className="text-5xl md:text-6xl font-black mb-6 leading-tight">
          A Full DAW Layout That Runs in Your Browser
        </h1>
        <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
          Beat maker, piano roll, mixer, arrangement view, and AI assistant — all in one unified workspace. Professional music production without the $600 software.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-lg px-8">
              Open the DAW <ChevronRight className="ml-2 w-5 h-5" />
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
              icon: Grid,
              title: "Beat Maker + Sequencer",
              desc: "16-step drum sequencer with samples, per-step velocity, swing, and pattern chaining. Build beats visually or let the AI generate them.",
            },
            {
              icon: Piano,
              title: "Piano Roll Editor",
              desc: "MIDI piano roll with quantize, velocity editing, chord suggestions, and MIDI controller support. Compose melodies and harmonies note by note.",
            },
            {
              icon: Layers,
              title: "Arrangement View",
              desc: "Timeline-based arrangement editor to build full song structures — intro, verse, chorus, bridge, outro — and export as a single stereo file.",
            },
            {
              icon: Cpu,
              title: "AI-Powered Composition",
              desc: "The Organism AI agent generates drums, bass, chords, and melody in real time, adapting to your genre, mood, and BPM preferences.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">{title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-6 text-center">
        <div className="max-w-2xl mx-auto rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-12">
          <Play className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-4">Make Your First Beat Free</h2>
          <p className="text-white/60 mb-8">Full DAW access on the free plan. No software download. Works on any modern browser.</p>
          <Link href="/signup">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-10">
              Start for Free
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
