import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  Music, Zap, MessageSquare, Code, Shield, Sparkles, ChevronRight,
  CheckCircle2, Globe, Github, Twitter, Instagram, LogIn, UserPlus,
  Activity, Mic, Brain, Flame, Snowflake, Wind, Layers, Radio,
  BarChart2, Repeat, Hash, Volume2, Users, Heart, Wifi, Search,
  BookOpen, Handshake,
} from "lucide-react";

// UNDER CONSTRUCTION MODE - Set to false to show full landing page
const UNDER_CONSTRUCTION = false;

export default function Landing() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const submitWaitlist = async () => {
    setStatus(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.message || "Something went wrong. Please try again.");
      } else {
        setStatus("You're on the list! We'll be in touch soon.");
        setEmail("");
      }
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const modes = [
    { name: "Heat",   color: "orange", icon: Flame,     desc: "Minor pentatonic. Aggressive kick, choppy hi-hats, distorted bass." },
    { name: "Ice",    color: "cyan",   icon: Snowflake,  desc: "Major pentatonic. Sparse, clean hits. Space and clarity." },
    { name: "Smoke",  color: "violet", icon: Wind,       desc: "Blues scale. Laid-back pocket. Warm sub-bass and brushed snares." },
    { name: "Gravel", color: "yellow", icon: Layers,     desc: "Dorian mode. Mid-tempo grit. Syncopated 16ths and punchy kicks." },
    { name: "Glow",   color: "emerald",icon: Sparkles,   desc: "Natural major. Melodic and uplifting. Bright chord stabs and pad washes." },
  ]

  const freestyleFeatures = [
    { icon: Hash,     title: "Count-In Start",        desc: "Count '1-2-3-4' and the beat drops exactly on 1. No click track. No manual sync." },
    { icon: Repeat,   title: "Call & Response",        desc: "When you pause, the melody answers. Your silence becomes part of the composition." },
    { icon: Zap,      title: "Drop Detector",          desc: "Detects energy spikes in your delivery and triggers arrangement drops in real time." },
    { icon: BarChart2, title: "Freestyle Report Card", desc: "After each session, get a breakdown of your rhythmic consistency and flow depth score." },
    { icon: Volume2,  title: "Cadence Lock",           desc: "Locks the melody rhythm to your speech cadence so your bars always land on beat." },
    { icon: MessageSquare, title: "Voice Commands",    desc: "Say 'drop it', 'heat mode', or 'slow down' — the studio responds to your words." },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/10 py-3' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">CodedSwitch</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#organism" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-cyan-400 transition-colors">Organism</a>
            <a href="#features" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-purple-400 transition-colors">Features</a>
            <a href="#modes" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-emerald-400 transition-colors">Modes</a>
            <a href="#social" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-pink-400 transition-colors">Social</a>
            <a href="#waitlist" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-yellow-400 transition-colors">Waitlist</a>
            <Link href="/studio">
              <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 uppercase tracking-widest font-bold">
                Launch Studio
              </Button>
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="outline" className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 uppercase tracking-widest font-bold">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login">
                  <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 uppercase tracking-widest font-bold text-sm gap-2">
                    <LogIn className="w-4 h-4" />
                    Log In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-cyan-600 hover:bg-cyan-500 text-white uppercase tracking-widest font-bold text-sm gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    <UserPlus className="w-4 h-4" />
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            {!isAuthenticated && (
              <Link href="/login">
                <Button size="sm" variant="ghost" className="text-white/70 hover:text-white gap-1.5 text-xs font-bold uppercase tracking-wider">
                  <LogIn className="w-4 h-4" />
                  Log In
                </Button>
              </Link>
            )}
            <Link href={isAuthenticated ? "/dashboard" : "/signup"}>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                {isAuthenticated ? "Dashboard" : "Sign Up"}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/60 z-10" />
          <video
            autoPlay muted loop playsInline
            className="w-full h-full object-cover"
            poster="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1920"
          >
            <source src="https://assets.mixkit.co/videos/preview/mixkit-sound-waves-of-a-music-player-4446-large.mp4" type="video/mp4" />
          </video>
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
        </div>

        <div className="container mx-auto px-6 relative z-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Mic className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-100">The AI That Plays With You — Live</span>
          </div>

          <h1 className="text-6xl md:text-9xl font-black tracking-tighter uppercase mb-6 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Your Voice.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">Your Beat.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/60 mb-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
            CodedSwitch's AI Organism listens to you and builds a full live beat — drums, bass, melody, texture — in real time, tuned to your voice's key and energy.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
            <Link href="/organism">
              <Button size="lg" className="h-16 px-10 text-lg bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.4)] group">
                Try the Organism Free
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/social-hub">
              <Button size="lg" variant="ghost" className="h-16 px-10 text-lg border border-white/10 hover:bg-white/5 rounded-2xl text-white">
                See what people are making →
              </Button>
            </Link>
          </div>
        </div>

        {/* HUD */}
        <div className="absolute bottom-10 left-10 hidden lg:block animate-in fade-in slide-in-from-left-8 duration-1000 delay-700">
          <div className="p-4 bg-black/40 border border-cyan-500/20 rounded-xl backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400">Organism Online</span>
            </div>
            <div className="h-12 w-48 flex items-end gap-1">
              {[40, 70, 30, 90, 50, 80, 40, 60, 20, 75, 45, 85].map((h, i) => (
                <div key={i} className="flex-1 bg-cyan-500/40 rounded-t-sm animate-bounce" style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Organism Deep Dive */}
      <section id="organism" className="py-32 relative bg-black">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20 space-y-4">
            <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 uppercase tracking-[0.3em] font-black py-1 px-4">The AI Music Agent</Badge>
            <h2 className="text-5xl md:text-8xl font-black tracking-tighter uppercase">
              Meet the <span className="text-cyan-400">Organism</span>
            </h2>
            <p className="max-w-2xl mx-auto text-xl text-white/40">
              Not a beat generator. Not a loop player. A living music system that breathes with you.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
            {/* Visual */}
            <div className="relative aspect-square lg:aspect-auto lg:h-[560px] rounded-3xl overflow-hidden border border-cyan-500/20 bg-slate-900">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
                {/* Pulsing rings */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <div className="absolute w-48 h-48 rounded-full border border-cyan-500/30 animate-[ping_3s_ease-in-out_infinite]" />
                  <div className="absolute w-36 h-36 rounded-full border border-cyan-500/40 animate-[ping_2.2s_ease-in-out_infinite_0.5s]" />
                  <div className="absolute w-24 h-24 rounded-full border-2 border-cyan-500/60 animate-[ping_1.5s_ease-in-out_infinite_1s]" />
                  <div className="w-16 h-16 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center">
                    <Mic className="w-8 h-8 text-cyan-400 animate-pulse" />
                  </div>
                </div>
                {/* Layer labels */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  {[
                    { label: "Drums", color: "cyan",   active: true  },
                    { label: "Bass",  color: "purple", active: true  },
                    { label: "Melody", color: "emerald", active: true },
                    { label: "Texture", color: "yellow", active: false },
                  ].map((layer) => (
                    <div key={layer.label} className={`flex items-center gap-2 p-2 rounded-lg bg-${layer.color}-500/10 border border-${layer.color}-500/20`}>
                      <div className={`w-2 h-2 rounded-full bg-${layer.color}-400 ${layer.active ? 'animate-pulse' : 'opacity-30'}`} />
                      <span className={`text-xs font-bold uppercase tracking-widest text-${layer.color}-400`}>{layer.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* HUD readout */}
              <div className="absolute top-6 left-6 p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl font-mono text-[10px] space-y-1.5">
                <div className="flex justify-between gap-6"><span className="text-cyan-400">STATE:</span><span className="text-white">FLOW</span></div>
                <div className="flex justify-between gap-6"><span className="text-cyan-400">BPM:</span><span className="text-white">93</span></div>
                <div className="flex justify-between gap-6"><span className="text-cyan-400">KEY:</span><span className="text-white">A minor</span></div>
                <div className="flex justify-between gap-6"><span className="text-cyan-400">MODE:</span><span className="text-white">SMOKE</span></div>
              </div>
            </div>

            {/* Copy */}
            <div className="space-y-10">
              {[
                {
                  icon: Mic,
                  color: "cyan",
                  title: "Hears You",
                  desc: "The Organism analyses your microphone in real time — pitch, energy, rhythm, and presence. Every frame of audio shapes what the music does next.",
                },
                {
                  icon: Brain,
                  color: "purple",
                  title: "Understands Your Key",
                  desc: "Scale Snap Engine detects the musical key you're singing or rapping in. The melody generator locks to your key so every note it plays harmonises with your voice — automatically.",
                },
                {
                  icon: Activity,
                  color: "emerald",
                  title: "Builds the Beat Around You",
                  desc: "Drums, bass, melody, and texture are generated live from a physics engine that converts your voice's energy into musical parameters. No loops. No presets. It's all generated on the fly.",
                },
                {
                  icon: Zap,
                  color: "yellow",
                  title: "Arranges Itself",
                  desc: "A 28-bar arrangement cycle (intro → verse → build → drop → breakdown → drop 2 → outro) plays out automatically as you perform, giving your freestyle a real song structure.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-6 group hover:translate-x-2 transition-transform duration-300">
                  <div className={`w-12 h-12 rounded-xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`w-6 h-6 text-${item.color}-400`} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold uppercase tracking-tight">{item.title}</h3>
                    <p className="text-white/40 leading-relaxed text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Physics Modes */}
      <section id="modes" className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <Badge variant="outline" className="border-purple-500/50 text-purple-400 uppercase tracking-[0.3em] font-black py-1 px-4">5 Physics Modes</Badge>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
              Pick Your <span className="text-purple-400">Vibe</span>
            </h2>
            <p className="max-w-xl mx-auto text-lg text-white/40">
              Each mode is a complete sonic world — different scales, drum kits, bass tones, and textures that the Organism uses to colour everything it plays.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {modes.map((mode) => (
              <div key={mode.name} className={`group relative p-6 rounded-2xl bg-${mode.color}-500/5 border border-${mode.color}-500/20 hover:bg-${mode.color}-500/10 transition-all duration-300 hover:-translate-y-1`}>
                <div className={`w-10 h-10 rounded-xl bg-${mode.color}-500/10 flex items-center justify-center mb-4`}>
                  <mode.icon className={`w-5 h-5 text-${mode.color}-400`} />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-widest text-${mode.color}-400 mb-2`}>{mode.name}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{mode.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Freestyle Features */}
      <section id="features" className="py-32 relative bg-black">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20 space-y-4">
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 uppercase tracking-[0.3em] font-black py-1 px-4">Freestyle Engine</Badge>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
              Built for <span className="text-emerald-400">Performance</span>
            </h2>
            <p className="max-w-xl mx-auto text-lg text-white/40">
              Six systems designed specifically for freestylers, singers, and live performers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {freestyleFeatures.map((feat) => (
              <div key={feat.title} className="p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <feat.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold uppercase tracking-tight mb-2">{feat.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Studio Features Row */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <Badge variant="outline" className="border-blue-500/50 text-blue-400 uppercase tracking-[0.3em] font-black py-1 px-4">Full DAW</Badge>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
              Everything a <span className="text-blue-400">Producer</span> Needs
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Music,
                color: "cyan",
                title: "Holographic Studio",
                desc: "Multi-track Beat Maker, Piano Roll, Melody Composer, and Mixer in one workspace. Professional audio engine with Tone.js at the core.",
                bullets: ["Live BPM control", "Per-track volume & pan", "Stem generation", "Audio export"],
              },
              {
                icon: Brain,
                color: "purple",
                title: "Astutely AI Brain",
                desc: "Our AI assistant generates beats and melodies and controls the DAW in real time through natural language commands.",
                bullets: ["Beat pattern generation", "Melody composition", "Voice DAW control", "Multi-model AI (Grok, GPT, Gemini)"],
              },
              {
                icon: Code,
                color: "emerald",
                title: "Code to Music + Security",
                desc: "Translate code structures into musical compositions. Scan code for vulnerabilities. The bridge between software engineering and sound.",
                bullets: ["Code → melody", "Vulnerability scanner", "OWASP analysis", "Real-time audit reports"],
              },
            ].map((card) => (
              <div key={card.title} className={`p-8 rounded-2xl bg-${card.color}-500/5 border border-${card.color}-500/20 hover:border-${card.color}-500/40 transition-all duration-300`}>
                <div className={`w-12 h-12 rounded-2xl bg-${card.color}-500/10 flex items-center justify-center mb-6`}>
                  <card.icon className={`w-6 h-6 text-${card.color}-400`} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-3">{card.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed mb-6">{card.desc}</p>
                <ul className="space-y-2">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-white/60">
                      <CheckCircle2 className={`w-4 h-4 text-${card.color}-400 flex-shrink-0`} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL HUB — THE COMMUNITY ═══ */}
      <section id="social" className="py-32 relative bg-black overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pink-500/5 to-transparent" />
        <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20 space-y-6">
            <Badge variant="outline" className="border-pink-500/50 text-pink-400 uppercase tracking-[0.3em] font-black py-1.5 px-6 text-sm">Community Platform</Badge>
            <h2 className="text-5xl md:text-8xl font-black tracking-tighter uppercase leading-none">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-cyan-400 to-purple-500">Social Hub</span>
            </h2>
            <p className="max-w-2xl mx-auto text-xl text-white/50">
              More than a studio. It's a community. Connect with producers worldwide, share your beats, chat in real time, collaborate on projects, and grow your audience — all inside CodedSwitch.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {[
              {
                icon: Globe,
                color: "cyan",
                title: "Activity Feed",
                desc: "Share beats, melodies, projects, and status updates. See what other producers are creating. Like, comment, and reshare.",
              },
              {
                icon: MessageSquare,
                color: "pink",
                title: "In-App Chat",
                desc: "Direct message any producer on the platform. Share audio clips, project invites, and collaborate in real time.",
              },
              {
                icon: Wifi,
                color: "blue",
                title: "Social Connections",
                desc: "Link your Twitter, Instagram, YouTube, and Facebook. Share your creations across all platforms with one click.",
              },
              {
                icon: Handshake,
                color: "emerald",
                title: "Collaborations",
                desc: "Share projects with other producers. Set permissions, track contributions, and build together.",
              },
              {
                icon: Search,
                color: "purple",
                title: "Discover Producers",
                desc: "Find new talent. Follow producers whose style inspires you. Build your network and grow together.",
              },
              {
                icon: BarChart2,
                color: "yellow",
                title: "Analytics Dashboard",
                desc: "Track your reach — followers, engagement, views, likes. See which creations resonate and double down.",
              },
            ].map((card) => (
              <div key={card.title} className={`group p-7 rounded-2xl bg-${card.color}-500/5 border border-${card.color}-500/15 hover:border-${card.color}-500/40 hover:bg-${card.color}-500/10 transition-all duration-300 hover:-translate-y-1`}>
                <div className={`w-12 h-12 rounded-2xl bg-${card.color}-500/10 border border-${card.color}-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <card.icon className={`w-6 h-6 text-${card.color}-400`} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-2">{card.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Blog callout */}
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-8 mb-16 flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-8 h-8 text-yellow-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-black uppercase tracking-tight mb-1">Integrated Blog</h3>
              <p className="text-white/40 text-sm">Tutorials, production tips, artist spotlights, and platform updates — all accessible right inside the Social Hub. Stay informed without leaving the studio.</p>
            </div>
            <Link href="/blog">
              <Button variant="outline" className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 uppercase tracking-widest font-bold whitespace-nowrap">
                Read the Blog
              </Button>
            </Link>
          </div>

          {/* Big CTA */}
          <div className="text-center">
            <Link href="/social-hub">
              <Button size="lg" className="h-16 px-12 text-lg bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-500 text-white rounded-2xl shadow-[0_0_40px_rgba(236,72,153,0.3)] group font-black uppercase tracking-widest">
                <Users className="w-6 h-6 mr-3" />
                Enter the Social Hub
                <ChevronRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-white/30 font-bold uppercase tracking-widest">Free for all CodedSwitch members</p>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto rounded-[40px] bg-gradient-to-br from-cyan-600/20 via-blue-600/10 to-purple-600/20 border border-white/10 p-12 md:p-20 relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

            <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase leading-none">
                Join the <span className="text-cyan-400">Vanguard</span>
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto">
                Be the first to perform with the Organism. Early access + exclusive AI models for waitlist members.
              </p>

              <div className="max-w-md mx-auto">
                <div className="relative group">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="h-16 rounded-2xl bg-black/40 border-white/10 px-6 text-lg focus:border-cyan-500 focus:ring-0 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitWaitlist()}
                  />
                  <Button
                    className="absolute right-2 top-2 bottom-2 bg-white text-black hover:bg-cyan-400 hover:text-black rounded-xl px-6 font-black uppercase tracking-widest text-xs"
                    onClick={submitWaitlist}
                    disabled={submitting}
                  >
                    {submitting ? "..." : "Join Now"}
                  </Button>
                </div>
                {status && (
                  <p className={`mt-3 text-sm font-bold uppercase tracking-widest ${status.includes("on the list") ? "text-emerald-400" : "text-red-400"}`}>
                    {status}
                  </p>
                )}
              </div>
            </div>

            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-cyan-500/20 rounded-full blur-[80px]" />
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px]" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-1 md:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black tracking-tighter uppercase italic">CodedSwitch</span>
              </div>
              <p className="text-white/40 max-w-sm">
                The AI that plays with you. A voice-reactive music studio that builds a live beat around your performance in real time.
              </p>
              <div className="flex gap-4">
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-cyan-400"><Twitter className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-purple-400"><Instagram className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-white"><Github className="w-5 h-5" /></Button>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">Platform</h4>
              <ul className="space-y-4 text-sm text-white/40 font-bold tracking-tight">
                <li><Link href="/studio" className="hover:text-cyan-400 transition-colors">Launch Studio</Link></li>
                <li><a href="#organism" className="hover:text-cyan-400 transition-colors">The Organism</a></li>
                <li><a href="#modes" className="hover:text-cyan-400 transition-colors">Physics Modes</a></li>
                <li><Link href="/social-hub" className="hover:text-cyan-400 transition-colors">Social Hub</Link></li>
                <li><Link href="/vulnerability-scanner" className="hover:text-cyan-400 transition-colors">Code Scanner</Link></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">Company</h4>
              <ul className="space-y-4 text-sm text-white/40 font-bold tracking-tight">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-12 border-t border-white/5 text-[10px] uppercase tracking-[0.3em] font-black text-white/20">
            <p>© 2026 CodedSwitch. Built for the next generation.</p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Global Network</span>
              <span className="flex items-center gap-2 text-cyan-500/50"><Activity className="w-3 h-3" /> Organism: Online</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
