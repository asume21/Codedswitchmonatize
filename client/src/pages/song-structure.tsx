import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Music2, Repeat, Shuffle, ChevronRight, BookOpen, BarChart2, Wand2 } from "lucide-react";

export default function SongStructureLanding() {
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
        <Badge className="mb-6 bg-orange-500/20 text-orange-400 border-orange-500/30">Song Structure Builder</Badge>
        <h1 className="text-5xl md:text-6xl font-black mb-6 leading-tight">
          Build Better Song Structures with AI
        </h1>
        <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
          Lay out your intro, verse, pre-chorus, chorus, bridge, and outro on a timeline. Let AI suggest section arrangements, transitions, and energy curves that keep listeners hooked.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-400 text-white font-black text-lg px-8">
              Build Your Song Structure <ChevronRight className="ml-2 w-5 h-5" />
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
              icon: Layers,
              title: "Drag-and-Drop Arrangement",
              desc: "Arrange sections on a visual timeline. Intro, verse, pre-chorus, chorus, bridge, outro — drag to reorder and resize by bar count.",
            },
            {
              icon: Wand2,
              title: "AI Section Suggestions",
              desc: "AI analyzes your genre and mood to suggest an arrangement that follows proven song structure templates — from classic pop to modern hip-hop.",
            },
            {
              icon: BarChart2,
              title: "Energy Curve Mapping",
              desc: "See how energy builds and drops across your song. Balance tension and release to keep listeners engaged from start to finish.",
            },
            {
              icon: Repeat,
              title: "Section Looping & Preview",
              desc: "Loop any section in isolation to perfect it before placing it in the full arrangement. Preview the full song flow at any time.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">{title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-6 text-center">
        <div className="max-w-2xl mx-auto rounded-3xl border border-orange-500/20 bg-orange-500/5 p-12">
          <Music2 className="w-10 h-10 text-orange-400 mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-4">Structure Your Next Hit</h2>
          <p className="text-white/60 mb-8">Free to try. No music theory degree required — just your ideas.</p>
          <Link href="/signup">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-400 text-white font-black px-10">
              Get Started Free
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
