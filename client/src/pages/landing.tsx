import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Music, Zap, MessageSquare, Drum, Upload, Shield, Send, Construction, Play, Sparkles, Wand2, Radio, Mic2, Piano, Layout, Cpu, Activity, Database, ChevronRight, CheckCircle2, Globe, Github, Twitter, Instagram } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// UNDER CONSTRUCTION MODE - Set to false to show full landing page
const UNDER_CONSTRUCTION = false;

export default function Landing() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const submitWaitlist = async () => {
    setStatus(null);
    const trimmed = email.trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!valid) {
      setStatus("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, name: name.trim() || undefined }),
      });
      const data = await res.json().catch((error: unknown) => {
        console.error('Failed to parse response:', error);
        return {};
      });
      if (!res.ok) {
        setStatus(data?.message || "Something went wrong. Please try again.");
      } else {
        setStatus("You're on the list! We'll be in touch soon.");
        setEmail("");
        setName("");
      }
    } catch (e) {
      setStatus("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    {
      icon: Layout,
      title: "Holographic Studio",
      description: "A state-of-the-art multi-track DAW with a sleek Cyberpunk HUD. High-performance audio engine designed for the modern producer.",
      image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&q=80&w=800",
      color: "cyan"
    },
    {
      icon: Cpu,
      title: "Astutely AI Brain",
      description: "Our integrated AI assistant doesn't just chat—it generates beats, creates melodies, and controls your DAW in real-time.",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
      color: "purple"
    },
    {
      icon: Code,
      title: "Code to Music",
      description: "Translate complex code structures into musical compositions. The ultimate bridge between software engineering and music production.",
      image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800",
      color: "emerald"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      {/* Dynamic Header */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/10 py-3' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">CodedSwitch</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-cyan-400 transition-colors">Features</a>
            <a href="#ai" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-purple-400 transition-colors">AI Engine</a>
            <a href="#waitlist" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-emerald-400 transition-colors">Waitlist</a>
            <Link href="/auth">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 uppercase tracking-widest font-bold">
                Login
              </Button>
            </Link>
            <Link href="/studio">
              <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 uppercase tracking-widest font-bold">
                Launch DAW
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section with Video Background */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-0">
          {/* Hero Video Placeholder */}
          <div className="absolute inset-0 bg-black/60 z-10" />
          <video 
            autoPlay 
            muted 
            loop 
            playsInline 
            className="w-full h-full object-cover"
            poster="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1920"
          >
            {/* Replace with actual high-quality production video URL */}
            <source src="https://assets.mixkit.co/videos/preview/mixkit-sound-waves-of-a-music-player-4446-large.mp4" type="video/mp4" />
          </video>
          
          {/* Animated Glows */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
        </div>

        <div className="container mx-auto px-6 relative z-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-100">The Future of Production is Here</span>
          </div>
          
          <h1 className="text-6xl md:text-9xl font-black tracking-tighter uppercase mb-6 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">Without Limits</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/60 mb-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
            The world's first AI-integrated holographic DAW. Translate code to music, generate studio-quality beats, and mix with the power of Astutely.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
            <Link href="/studio">
              <Button size="lg" className="h-16 px-10 text-lg bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.4)] group">
                Enter the Studio
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="ghost" className="h-16 px-10 text-lg border border-white/10 hover:bg-white/5 rounded-2xl text-white">
                Explore Features
              </Button>
            </a>
          </div>
        </div>

        {/* HUD Elements Overlay */}
        <div className="absolute bottom-10 left-10 hidden lg:block animate-in fade-in slide-in-from-left-8 duration-1000 delay-700">
          <div className="p-4 bg-black/40 border border-cyan-500/20 rounded-xl backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400">Engine Online</span>
            </div>
            <div className="h-12 w-48 flex items-end gap-1">
              {[40, 70, 30, 90, 50, 80, 40, 60, 20, 75, 45, 85].map((h, i) => (
                <div key={i} className="flex-1 bg-cyan-500/40 rounded-t-sm animate-bounce" style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcases */}
      <section id="features" className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="flex flex-col gap-32">
            {features.map((feature, i) => (
              <div key={i} className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-16 items-center`}>
                <div className="flex-1 space-y-8">
                  <div className={`w-16 h-16 rounded-2xl bg-${feature.color}-500/10 flex items-center justify-center border border-${feature.color}-500/20`}>
                    <feature.icon className={`w-8 h-8 text-${feature.color}-400`} />
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-none">
                    {feature.title}
                  </h2>
                  <p className="text-xl text-white/50 leading-relaxed">
                    {feature.description}
                  </p>
                  {feature.title === "Astutely AI Brain" ? (
                    <div className="space-y-6">
                      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                        <p className="text-purple-300 font-bold mb-2">Real-time Neural DAW Control</p>
                        <p className="text-sm text-white/40">Command your studio with natural language. From tempo shifts to complex routing, Astutely executes your intent instantly.</p>
                      </div>
                      <ul className="space-y-4">
                        {['Professional Grade Output', 'Real-time Processing', 'Seamless Integration'].map((item, j) => (
                          <li key={j} className="flex items-center gap-3 text-white/80">
                            <CheckCircle2 className="w-5 h-5 text-purple-400" />
                            <span className="font-bold tracking-tight">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <ul className="space-y-4">
                      {['Professional Grade Output', 'Real-time Processing', 'Seamless Integration'].map((item, j) => (
                        <li key={j} className="flex items-center gap-3 text-white/80">
                          <CheckCircle2 className={`w-5 h-5 text-${feature.color}-400`} />
                          <span className="font-bold tracking-tight">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex-1 relative group">
                  <div className={`absolute -inset-1 bg-gradient-to-r from-${feature.color}-500 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500`} />
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video">
                    <img 
                      src={feature.image} 
                      alt={feature.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white uppercase tracking-widest text-[10px]">Active Module</Badge>
                        <div className="flex gap-1">
                          <div className={`w-2 h-2 rounded-full bg-${feature.color}-400 animate-pulse`} />
                          <div className={`w-2 h-2 rounded-full bg-${feature.color}-400 animate-pulse delay-75`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Astutely AI Engine Deep Dive */}
      <section id="ai" className="py-32 relative bg-black">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20 space-y-4">
            <Badge variant="outline" className="border-purple-500/50 text-purple-400 uppercase tracking-[0.3em] font-black py-1 px-4">The Central Brain</Badge>
            <h2 className="text-5xl md:text-8xl font-black tracking-tighter uppercase">Power by <span className="text-purple-500">Astutely</span></h2>
            <p className="max-w-2xl mx-auto text-xl text-white/40">
              Not just an assistant. A complete production ecosystem that understands your musical intent.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative aspect-square lg:aspect-auto lg:h-[600px] rounded-3xl overflow-hidden border border-purple-500/20 bg-slate-900 group">
              {/* AI Visualizer Placeholder Video */}
              <div className="absolute inset-0 bg-purple-950/20 z-10" />
              <img 
                src="https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&q=80&w=1000" 
                className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-80 transition duration-1000" 
                alt="AI Hub"
              />
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="w-32 h-32 rounded-full border-4 border-purple-500 animate-[spin_10s_linear_infinite] flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-2 border-cyan-400 animate-[spin_5s_linear_infinite_reverse] flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-white animate-pulse" />
                  </div>
                </div>
              </div>
              
              {/* HUD Readout */}
              <div className="absolute top-8 left-8 z-30 p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl font-mono text-[10px] space-y-2">
                <div className="flex justify-between gap-8"><span className="text-purple-400">ANALYSIS:</span> <span className="text-white">ACTIVE</span></div>
                <div className="flex justify-between gap-8"><span className="text-purple-400">MODEL:</span> <span className="text-white">ASTUTELY v2.5</span></div>
                <div className="flex justify-between gap-8"><span className="text-purple-400">LATENCY:</span> <span className="text-white">0.002ms</span></div>
              </div>
            </div>

            <div className="space-y-12">
              {[
                { title: "Smart Generation", desc: "Instantly create drum patterns, basslines, and synth melodies that match your project's key and tempo.", icon: Zap },
                { title: "Conversational DAW", desc: "Control your DAW with natural language commands. 'Make it more aggressive', 'Set tempo to 140', 'Add a lofi reverb'.", icon: MessageSquare },
                { title: "Live Sync", desc: "Everything generated is perfectly synced to your project's grid and database for zero-latency creation.", icon: Activity }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 group hover:translate-x-2 transition-transform duration-300">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold uppercase tracking-tight">{item.title}</h3>
                    <p className="text-white/40 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto rounded-[40px] bg-gradient-to-br from-cyan-600/20 via-blue-600/10 to-purple-600/20 border border-white/10 p-12 md:p-20 relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />
            
            <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase leading-none">
                Join the <span className="text-cyan-400">Vanguard</span>
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto">
                Be the first to experience the revolution. Gain early access to the studio and exclusive AI models.
              </p>

              <div className="max-w-md mx-auto space-y-4">
                <div className="relative group">
                  <Input 
                    type="email" 
                    placeholder="Enter your email" 
                    className="h-16 rounded-2xl bg-black/40 border-white/10 px-6 text-lg focus:border-cyan-500 focus:ring-0 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Button 
                    className="absolute right-2 top-2 bottom-2 bg-white text-black hover:bg-cyan-400 hover:text-black rounded-xl px-6 font-black uppercase tracking-widest text-xs"
                    onClick={submitWaitlist}
                    disabled={submitting}
                  >
                    {submitting ? '...' : 'Join Now'}
                  </Button>
                </div>
                {status && (
                  <p className={`text-sm font-bold uppercase tracking-widest ${status.includes('on the list') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {status}
                  </p>
                )}
              </div>
            </div>

            {/* Background elements */}
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
                Redefining the boundaries of music production through artificial intelligence and code.
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
                <li><Link href="/studio" className="hover:text-cyan-400 transition-colors">Launch DAW</Link></li>
                <li><a href="#features" className="hover:text-cyan-400 transition-colors">Features</a></li>
                <li><a href="#ai" className="hover:text-cyan-400 transition-colors">AI Hub</a></li>
                <li><Link href="/social-hub" className="hover:text-cyan-400 transition-colors">Social Lab</Link></li>
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
            <p>© 2025 CodedSwitch. Built for the next generation.</p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Global Network</span>
              <span className="flex items-center gap-2 text-cyan-500/50"><Activity className="w-3 h-3" /> System Status: Optimal</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
