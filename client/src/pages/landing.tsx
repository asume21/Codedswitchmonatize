import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  Music, Zap, MessageSquare, Code, Shield, Sparkles, ChevronRight,
  CheckCircle2, Globe, Github, Twitter, Instagram, LogIn, UserPlus,
  Activity, Mic, Brain, Flame, Snowflake, Wind, Layers, Radio,
  BarChart2, Repeat, Hash, Volume2, Users, Heart, Wifi, Search,
  BookOpen, Handshake, MessageCircle, Headphones, Star, Cpu,
} from "lucide-react";

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
  ];

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      credits: "50 credits/mo",
      color: "white",
      features: [
        "50 AI credits per month",
        "Organism WOW mode (60s guest demo)",
        "Full studio access",
        "Social Hub",
        "Code Translator",
        "Vulnerability Scanner",
      ],
      cta: "Start Free",
      href: "/signup",
      highlight: false,
    },
    {
      name: "Creator",
      price: "$9.99",
      period: "per month",
      credits: "300 credits/mo",
      color: "cyan",
      features: [
        "300 AI credits per month",
        "Unlimited Organism sessions",
        "Full DAW — all features",
        "AI beat & melody generation",
        "Voice Convert",
        "Lyric Lab with AI",
        "Priority support",
      ],
      cta: "Get Creator",
      href: "/signup",
      highlight: true,
    },
    {
      name: "Pro",
      price: "$29.99",
      period: "per month",
      credits: "1,000 credits/mo",
      color: "purple",
      features: [
        "1,000 AI credits per month",
        "Everything in Creator",
        "Advanced AI models (GPT-4, Gemini)",
        "Stem separation",
        "Audio export (WAV/MP3)",
        "Analytics dashboard",
        "Early access to new features",
      ],
      cta: "Go Pro",
      href: "/signup",
      highlight: false,
    },
    {
      name: "Studio",
      price: "$79.99",
      period: "per month",
      credits: "2,500 credits/mo",
      color: "yellow",
      features: [
        "2,500 AI credits per month",
        "Everything in Pro",
        "Collaboration features",
        "Custom AI voice models",
        "API access",
        "Team seats (coming soon)",
        "Dedicated support",
      ],
      cta: "Go Studio",
      href: "/signup",
      highlight: false,
    },
  ];

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
            <a href="#what-is-it" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-cyan-400 transition-colors">Platform</a>
            <a href="#organism" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-cyan-400 transition-colors">Organism</a>
            <a href="#pricing" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-cyan-400 transition-colors">Pricing</a>
            <a href="#social" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-cyan-400 transition-colors">Community</a>
            <Link href="/organism"><span className="text-sm font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer">Try Free →</span></Link>
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
                    <LogIn className="w-4 h-4" /> Log In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-cyan-600 hover:bg-cyan-500 text-white uppercase tracking-widest font-bold text-sm gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    <UserPlus className="w-4 h-4" /> Sign Up Free
                  </Button>
                </Link>
              </div>
            )}
          </div>
          <div className="flex md:hidden items-center gap-2">
            {!isAuthenticated && (
              <Link href="/login">
                <Button size="sm" variant="ghost" className="text-white/70 hover:text-white gap-1.5 text-xs font-bold uppercase tracking-wider">
                  <LogIn className="w-4 h-4" /> Log In
                </Button>
              </Link>
            )}
            <Link href={isAuthenticated ? "/dashboard" : "/organism"}>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                {isAuthenticated ? "Dashboard" : "Try Free"}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
            <Mic className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-100">AI Music Studio · Beat Maker · Social Platform</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter uppercase mb-6 leading-[0.9]">
            Make Beats.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">With Your Voice.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/60 mb-4">
            CodedSwitch is an AI music studio where your voice, your code, and your creativity become real music — live, in the browser, no equipment needed.
          </p>
          <p className="max-w-xl mx-auto text-sm text-cyan-300/60 font-semibold mb-10 uppercase tracking-widest">
            Beat Maker · Piano Roll · AI Generation · Voice-to-Beat · Code Translator · Social Hub
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/organism">
              <Button size="lg" className="h-16 px-10 text-lg bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.4)] group font-black uppercase tracking-widest">
                <Mic className="w-5 h-5 mr-2" />
                Try it Free — 60 Seconds
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="ghost" className="h-14 px-10 text-lg border border-white/10 hover:bg-white/5 rounded-2xl text-white">
                <UserPlus className="w-5 h-5 mr-2" /> Create Free Account
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/50">
            No signup · No download · Works in your browser · Free tier always available
          </p>
        </div>

        <div className="absolute bottom-10 left-10 hidden lg:block">
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

      {/* ── WHAT IS CODEDSWITCH ── */}
      <section id="what-is-it" className="py-24 bg-black relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-white/20 text-white/60 uppercase tracking-[0.3em] font-black py-1 px-4 mb-4">What Is CodedSwitch?</Badge>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-4">
              Three Platforms. <span className="text-cyan-400">One Studio.</span>
            </h2>
            <p className="max-w-xl mx-auto text-white/40 text-lg">
              CodedSwitch connects music production, AI generation, and community into one place — built for producers, freestylers, and coders who make sound.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Radio,
                color: "cyan",
                title: "Organism AI Engine",
                subtitle: "Voice → Beat, Live",
                desc: "Say a rhythm into your mic. The Organism hears you and generates drums, bass, and melody in real time — no music knowledge needed. Your voice IS the instrument.",
                badge: "Free 60s demo",
                href: "/organism",
                cta: "Try it now →",
              },
              {
                icon: Music,
                color: "violet",
                title: "Full DAW Studio",
                subtitle: "Professional Music Production",
                desc: "Beat Maker, Piano Roll, Melody Composer, Mixer, AI generation, Lyric Lab, Voice Convert, and Stem separation — a complete music production environment in your browser.",
                badge: "Full access free",
                href: "/studio",
                cta: "Open Studio →",
              },
              {
                icon: Code,
                color: "emerald",
                title: "Code + Music",
                subtitle: "The Switch Between Worlds",
                desc: "Translate code structures into melodies. Scan your code for vulnerabilities. This is the CodedSwitch — where programming and music production meet.",
                badge: "Only on CodedSwitch",
                href: "/studio",
                cta: "Explore →",
              },
            ].map((pillar) => (
              <Link key={pillar.title} href={pillar.href}>
                <div className={`group cursor-pointer p-8 rounded-2xl bg-${pillar.color}-500/5 border border-${pillar.color}-500/20 hover:border-${pillar.color}-500/50 hover:bg-${pillar.color}-500/10 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col`}>
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-12 h-12 rounded-xl bg-${pillar.color}-500/15 border border-${pillar.color}-500/25 flex items-center justify-center`}>
                      <pillar.icon className={`w-6 h-6 text-${pillar.color}-400`} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-${pillar.color}-500/10 text-${pillar.color}-400 border border-${pillar.color}-500/20`}>
                      {pillar.badge}
                    </span>
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-[0.2em] text-${pillar.color}-400 mb-1`}>{pillar.subtitle}</div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-3">{pillar.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed flex-1">{pillar.desc}</p>
                  <div className={`mt-6 text-sm font-black uppercase tracking-widest text-${pillar.color}-400 group-hover:translate-x-2 transition-transform`}>
                    {pillar.cta}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO IS IT FOR ── */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase mb-4">
              Built For <span className="text-purple-400">You</span> — If You're One of These
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Mic,
                title: "Freestylers & Rappers",
                desc: "Speak over a live AI beat that responds to your energy, key, and rhythm in real time.",
                color: "cyan",
              },
              {
                icon: Headphones,
                title: "Bedroom Producers",
                desc: "Make professional-sounding beats with no gear — just a browser and an idea.",
                color: "violet",
              },
              {
                icon: Cpu,
                title: "Developers Who Make Music",
                desc: "Turn your code into melodies. Scan for vulnerabilities. Live at the intersection.",
                color: "emerald",
              },
              {
                icon: Heart,
                title: "Anyone Who Wants to Create",
                desc: "No music theory required. Say 'boom boom clap' and the AI builds the rest.",
                color: "pink",
              },
            ].map((audience) => (
              <div key={audience.title} className={`p-6 rounded-2xl bg-${audience.color}-500/5 border border-${audience.color}-500/15 hover:border-${audience.color}-500/30 transition-all`}>
                <div className={`w-10 h-10 rounded-xl bg-${audience.color}-500/10 flex items-center justify-center mb-4`}>
                  <audience.icon className={`w-5 h-5 text-${audience.color}-400`} />
                </div>
                <h3 className="font-black uppercase tracking-tight text-base mb-2">{audience.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{audience.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ORGANISM DEEP DIVE ── */}
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
            <div className="relative aspect-square lg:aspect-auto lg:h-[560px] rounded-3xl overflow-hidden border border-cyan-500/20 bg-slate-900">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <div className="absolute w-48 h-48 rounded-full border border-cyan-500/30 animate-[ping_3s_ease-in-out_infinite]" />
                  <div className="absolute w-36 h-36 rounded-full border border-cyan-500/40 animate-[ping_2.2s_ease-in-out_infinite_0.5s]" />
                  <div className="absolute w-24 h-24 rounded-full border-2 border-cyan-500/60 animate-[ping_1.5s_ease-in-out_infinite_1s]" />
                  <div className="w-16 h-16 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center">
                    <Mic className="w-8 h-8 text-cyan-400 animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  {[
                    { label: "Drums",   color: "cyan",    active: true },
                    { label: "Bass",    color: "purple",  active: true },
                    { label: "Melody",  color: "emerald", active: true },
                    { label: "Synth Pads", color: "yellow",  active: false },
                  ].map((layer) => (
                    <div key={layer.label} className={`flex items-center gap-2 p-2 rounded-lg bg-${layer.color}-500/10 border border-${layer.color}-500/20`}>
                      <div className={`w-2 h-2 rounded-full bg-${layer.color}-400 ${layer.active ? 'animate-pulse' : 'opacity-30'}`} />
                      <span className={`text-xs font-bold uppercase tracking-widest text-${layer.color}-400`}>{layer.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute top-6 left-6 p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl font-mono text-[10px] space-y-1.5">
                <div className="flex justify-between gap-6"><span className="text-cyan-400">STATE:</span><span className="text-white">FLOW</span></div>
                <div className="flex justify-between gap-6"><span className="text-cyan-400">BPM:</span><span className="text-white">93</span></div>
                <div className="flex justify-between gap-6"><span className="text-cyan-400">KEY:</span><span className="text-white">A minor</span></div>
                <div className="flex justify-between gap-6"><span className="text-cyan-400">MODE:</span><span className="text-white">SMOKE</span></div>
              </div>
            </div>

            <div className="space-y-10">
              {[
                { icon: Mic,      color: "cyan",    title: "Hears You",                desc: "The Organism analyzes your microphone in real time — pitch, energy, rhythm, and presence. Every frame of audio shapes what the music does next." },
                { icon: Brain,    color: "purple",  title: "Locks to Your Key",         desc: "Scale Snap Engine detects the musical key you're singing or rapping in and locks every generated note to it — so it always harmonizes with your voice." },
                { icon: Activity, color: "emerald", title: "Builds the Beat Around You", desc: "Drums, bass, melody, and texture are generated live from a physics engine that converts your voice's energy into musical parameters. No loops. No presets." },
                { icon: Zap,      color: "yellow",  title: "Arranges Itself",            desc: "A 28-bar song cycle (intro → verse → build → drop → breakdown → outro) plays out automatically as you perform — giving your freestyle a real song structure." },
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
              <Link href="/organism">
                <Button size="lg" className="h-14 px-8 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] font-black uppercase tracking-widest group">
                  Try the Organism Free
                  <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PHYSICS MODES ── */}
      <section id="modes" className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <Badge variant="outline" className="border-purple-500/50 text-purple-400 uppercase tracking-[0.3em] font-black py-1 px-4">5 Physics Modes</Badge>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
              Pick Your <span className="text-purple-400">Vibe</span>
            </h2>
            <p className="max-w-xl mx-auto text-lg text-white/40">
              Each mode is a complete sonic world — different scales, drum kits, bass tones, and textures.
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

      {/* ── STUDIO OVERVIEW ── */}
      <section id="features" className="py-32 relative bg-black">
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
                icon: Music, color: "cyan", title: "Holographic Studio",
                desc: "Multi-track Beat Maker, Piano Roll, Melody Composer, and Mixer in one workspace.",
                bullets: ["Live BPM control", "Per-track volume & pan", "Stem generation", "Audio export"],
              },
              {
                icon: Brain, color: "purple", title: "Astutely AI Brain",
                desc: "Our AI assistant generates beats, melodies, and controls the DAW through natural language.",
                bullets: ["Beat pattern generation", "Melody composition", "Voice DAW control", "Grok, GPT-4, Gemini"],
              },
              {
                icon: Code, color: "emerald", title: "Code to Music + Security",
                desc: "Translate code structures into musical compositions. Scan code for vulnerabilities.",
                bullets: ["Code → melody", "Vulnerability scanner", "OWASP analysis", "Real-time audit"],
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

      {/* ── SOCIAL HUB ── */}
      <section id="social" className="py-32 relative overflow-hidden">
        <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="border-pink-500/50 text-pink-400 uppercase tracking-[0.3em] font-black py-1.5 px-6">Community Platform</Badge>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-cyan-400 to-purple-500">Social Hub</span>
            </h2>
            <p className="max-w-2xl mx-auto text-xl text-white/50">
              Share your beats, discover other producers, collaborate on tracks, and grow your audience — all inside CodedSwitch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[
              { icon: Globe,       color: "cyan",    title: "Activity Feed",        desc: "Share beats, melodies, and projects. Like, comment, and reshare what other producers are building." },
              { icon: MessageSquare, color: "pink",  title: "In-App Chat",          desc: "Direct message any producer. Share audio clips, project invites, and collaborate in real time." },
              { icon: Handshake,  color: "emerald",  title: "Collaborations",       desc: "Share projects with other producers. Set permissions, track contributions, build together." },
              { icon: Search,     color: "purple",   title: "Discover Producers",   desc: "Find new talent. Follow producers whose style inspires you. Build your network." },
              { icon: Wifi,       color: "blue",     title: "Social Connections",   desc: "Link your Twitter, Instagram, YouTube. Share your creations across all platforms with one click." },
              { icon: BarChart2,  color: "yellow",   title: "Analytics",            desc: "Track your reach — followers, engagement, views, likes. See what resonates." },
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

          <div className="text-center">
            <Link href="/social-hub">
              <Button size="lg" className="h-16 px-12 text-lg bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-500 text-white rounded-2xl shadow-[0_0_40px_rgba(236,72,153,0.3)] group font-black uppercase tracking-widest">
                <Users className="w-6 h-6 mr-3" /> Enter the Social Hub
                <ChevronRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-32 bg-black relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20 space-y-4">
            <Badge variant="outline" className="border-white/20 text-white/60 uppercase tracking-[0.3em] font-black py-1 px-4">Pricing</Badge>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
              Simple. <span className="text-cyan-400">Transparent.</span> Yours.
            </h2>
            <p className="max-w-xl mx-auto text-white/40 text-lg">
              Start free. Upgrade when you're ready. Buy extra credits any time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
                  plan.highlight
                    ? `border-${plan.color}-500/60 bg-${plan.color}-500/10 shadow-[0_0_40px_rgba(6,182,212,0.2)]`
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-cyan-500 text-black text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <div className={`text-[10px] font-black uppercase tracking-[0.25em] text-${plan.color === 'white' ? 'white/50' : plan.color + '-400'} mb-3`}>
                  {plan.name}
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black">{plan.price}</span>
                  {plan.price !== "$0" && <span className="text-white/40 text-sm mb-1">/{plan.period.split(" ")[0]}</span>}
                </div>
                <div className="text-xs text-white/30 font-bold uppercase tracking-widest mb-6">{plan.credits}</div>
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 text-${plan.color === 'white' ? 'emerald' : plan.color}-400`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <Button
                    className={`w-full font-black uppercase tracking-widest ${
                      plan.highlight
                        ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                        : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {/* Credit top-ups */}
          <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-white/[0.02] p-8">
            <h3 className="text-lg font-black uppercase tracking-widest text-center mb-6">Need More Credits? Buy Any Time.</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { credits: "100", price: "$4.99" },
                { credits: "500", price: "$19.99", note: "Save 20%" },
                { credits: "1,000", price: "$34.99", note: "Save 30%" },
                { credits: "5,000", price: "$149.99", note: "Save 40%" },
              ].map((pkg) => (
                <div key={pkg.credits} className="text-center p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-cyan-500/30 transition-all">
                  <div className="text-xl font-black">{pkg.credits}</div>
                  <div className="text-xs text-white/40 mb-1">credits</div>
                  <div className="text-sm font-black text-cyan-400">{pkg.price}</div>
                  {pkg.note && <div className="text-[10px] text-emerald-400 font-bold mt-1">{pkg.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto rounded-[40px] bg-gradient-to-br from-cyan-600/20 via-blue-600/10 to-purple-600/20 border border-white/10 p-12 md:p-20 relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />
            <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase leading-none">
                Start Making Music <span className="text-cyan-400">Right Now</span>
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto">
                No signup required for the first 60 seconds. Just click, speak, and hear the Organism build your beat.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Link href="/organism">
                  <Button size="lg" className="h-16 px-12 text-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.5)] font-black uppercase tracking-widest group">
                    <Mic className="w-5 h-5 mr-3" /> Try the Organism Free
                    <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="lg" variant="ghost" className="h-16 px-10 text-lg border border-white/10 hover:bg-white/5 rounded-2xl text-white">
                    <UserPlus className="w-5 h-5 mr-2" /> Sign Up Free
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-white/30 uppercase tracking-[0.15em] font-bold">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> No account needed to start</span>
                <span className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-cyan-400" /> Runs in your browser</span>
                <span className="flex items-center gap-2"><Star className="w-3.5 h-3.5 text-yellow-400" /> Free tier forever</span>
              </div>
            </div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-cyan-500/20 rounded-full blur-[80px]" />
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px]" />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
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
                The AI music studio where your voice, code, and creativity become real music. Make beats. Switch worlds.
              </p>
              <div className="flex gap-4">
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-cyan-400" asChild><a href="#"><Twitter className="w-5 h-5" /></a></Button>
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-purple-400" asChild><a href="#"><Instagram className="w-5 h-5" /></a></Button>
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-white" asChild><a href="#"><Github className="w-5 h-5" /></a></Button>
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-[#5865F2]" asChild>
                  <a href="https://discord.gg/AWcVpBVf" target="_blank" rel="noopener noreferrer"><MessageCircle className="w-5 h-5" /></a>
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">Platform</h4>
              <ul className="space-y-4 text-sm text-white/40 font-bold tracking-tight">
                <li><Link href="/organism" className="hover:text-cyan-400 transition-colors">Organism AI</Link></li>
                <li><Link href="/studio" className="hover:text-cyan-400 transition-colors">Launch Studio</Link></li>
                <li><Link href="/social-hub" className="hover:text-cyan-400 transition-colors">Social Hub</Link></li>
                <li><Link href="/vulnerability-scanner" className="hover:text-cyan-400 transition-colors">Code Scanner</Link></li>
                <li><a href="#pricing" className="hover:text-cyan-400 transition-colors">Pricing</a></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">Company</h4>
              <ul className="space-y-4 text-sm text-white/40 font-bold tracking-tight">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">About Us</a></li>
                <li><Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</Link></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-12 border-t border-white/5 text-[10px] uppercase tracking-[0.3em] font-black text-white/20">
            <p>© 2026 CodedSwitch. Built for the next generation of producers.</p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Global</span>
              <span className="flex items-center gap-2 text-cyan-500/50"><Activity className="w-3 h-3" /> Organism: Online</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
