import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Music, Zap, MessageSquare, Drum, Upload, Shield, Send, Construction, Play, Sparkles, Wand2, Radio, Mic2, Piano } from "lucide-react";

// UNDER CONSTRUCTION MODE - Set to false to show full landing page
const UNDER_CONSTRUCTION = false;

export default function Landing() {
  // If under construction, show maintenance page
  if (UNDER_CONSTRUCTION) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full bg-slate-900/80 backdrop-blur border-purple-500/20">
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="flex justify-center">
              <div className="relative">
                <Construction className="w-24 h-24 text-yellow-500 animate-bounce" />
                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              CodedSwitch
            </CardTitle>
            <CardDescription className="text-xl text-gray-300">
              🚧 Under Construction 🚧
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="space-y-4">
              <p className="text-lg text-gray-300">
                We're building something amazing! Our platform is currently undergoing major upgrades to bring you the best music creation experience.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-purple-500/20">
                  <Music className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">AI Music Generation</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg border border-purple-500/20">
                  <Code className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Code to Music</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg border border-purple-500/20">
                  <Drum className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Professional Studio</p>
                </div>
              </div>
              <p className="text-gray-400">
                <span className="text-purple-400 font-semibold">Now Available</span> - Start creating music today
              </p>
            </div>
            
            <div className="pt-6 border-t border-gray-700">
              <p className="text-sm text-gray-500 mb-4">
                Want to follow our progress?
              </p>
              <a 
                href="https://github.com/asume21/Codedswitchmonatize" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <Code className="w-4 h-4 mr-2" />
                  View Updates on GitHub
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // FULL LANDING PAGE (when UNDER_CONSTRUCTION = false)
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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
      icon: Music,
      title: "Professional Piano Roll",
      description: "Advanced multi-track piano roll with pixel-perfect alignment, resizable notes, and 100+ instruments"
    },
    {
      icon: Zap,
      title: "AI Music Generation",
      description: "Generate full songs, beats, and melodies with Suno and MusicGen AI models"
    },
    {
      icon: MessageSquare,
      title: "AI Lyrics Generator",
      description: "Create professional lyrics with Grok AI - genre-specific, rhyme schemes, and emotional depth"
    },
    {
      icon: Code,
      title: "Code to Music",
      description: "Revolutionary translation between code and musical compositions - turn your code into sound"
    },
    {
      icon: Drum,
      title: "Multi-Track Studio",
      description: "Professional beat maker, melody composer, and drum patterns with real-time playback"
    },
    {
      icon: Upload,
      title: "Song Analyzer",
      description: "Upload and analyze songs with AI-powered insights, quality scoring, and recommendations"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Hero Section - Full Screen */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse top-20 left-20"></div>
          <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse bottom-20 right-20 animation-delay-2000"></div>
          <div className="absolute w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animation-delay-4000"></div>
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="text-center mb-16">
            {/* Logo/Icon */}
            <div className="relative inline-block mb-8">
              <div className="h-24 w-24 mx-auto rounded-3xl bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 flex items-center justify-center shadow-2xl">
                <Music className="h-12 w-12 text-white" />
              </div>
              <div className="absolute inset-0 bg-purple-500/30 rounded-3xl blur-xl animate-pulse"></div>
            </div>

            {/* Main Headline */}
            <h1 className="text-7xl md:text-8xl font-black mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-fade-in">
              CodedSwitch
            </h1>
            
            {/* Tagline */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
              <p className="text-3xl font-bold text-white">
                AI-Powered Music Production Suite
              </p>
              <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
            </div>

            {/* Description */}
            <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Create professional music with <span className="text-purple-400 font-semibold">AI generation</span>, 
              advanced <span className="text-pink-400 font-semibold">piano roll</span>, 
              multi-track <span className="text-blue-400 font-semibold">studio</span>, and 
              revolutionary <span className="text-green-400 font-semibold">code-to-music</span> translation
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
              <Link href="/studio">
                <Button size="lg" className="text-lg px-10 py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-2xl hover:shadow-purple-500/50 transition-all">
                  <Play className="w-5 h-5 mr-2" />
                  Launch Studio
                </Button>
              </Link>
              <Link href="/studio">
                <Button size="lg" variant="outline" className="text-lg px-10 py-6 border-2 border-purple-500 text-white hover:bg-purple-500/20 shadow-xl">
                  <Wand2 className="w-5 h-5 mr-2" />
                  Start Creating
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-400 mb-2">100+</div>
                <div className="text-sm text-gray-400">Instruments</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-pink-400 mb-2">AI</div>
                <div className="text-sm text-gray-400">Powered</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-400 mb-2">∞</div>
                <div className="text-sm text-gray-400">Possibilities</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="transition-transform hover:scale-105">
              <CardHeader>
                <feature.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Waitlist Section */}
        <div className="text-center bg-card rounded-2xl p-12 border mb-12">
          <h2 className="text-3xl font-bold mb-2">Join the Waitlist</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Be the first to get access, product updates, and early adopter perks.
          </p>
          <div className="mx-auto max-w-xl flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1">
              <Label htmlFor="waitlist-email" className="sr-only">Email</Label>
              <Input
                id="waitlist-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="waitlist-name" className="sr-only">Name (optional)</Label>
              <Input
                id="waitlist-name"
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <Button onClick={submitWaitlist} disabled={submitting} className="min-w-36">
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Joining..." : "Join Waitlist"}
            </Button>
          </div>
          {status && (
            <p className="mt-3 text-sm text-muted-foreground">{status}</p>
          )}
        </div>

        {/* CTA Section */}
        <div className="text-center bg-card rounded-2xl p-12 border">
          <h2 className="text-3xl font-bold mb-4">Ready to Create Music?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Launch the studio and start creating professional music with AI-powered tools, advanced piano roll, and multi-track production.
          </p>
          <Link href="/studio">
            <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Play className="w-5 h-5 mr-2" />
              Launch Studio Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
