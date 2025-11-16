import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Music, Zap, MessageSquare, Drum, Upload, Shield, Send, Construction } from "lucide-react";

// UNDER CONSTRUCTION MODE - Set to false to show full landing page
const UNDER_CONSTRUCTION = true;

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
                Expected launch: <span className="text-purple-400 font-semibold">Coming Soon</span>
              </p>
            </div>
            
            <div className="pt-6 border-t border-gray-700">
              <p className="text-sm text-gray-500 mb-4">
                Already have an account? Access the studio:
              </p>
              <Link href="/studio">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <Zap className="w-4 h-4 mr-2" />
                  Go to Studio
                </Button>
              </Link>
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
      icon: Code,
      title: "Code Translation",
      description: "Translate code between 14+ programming languages with AI assistance"
    },
    {
      icon: Music,
      title: "Professional Music Studio",
      description: "Create music with multi-instrument orchestral compositions and MIDI support"
    },
    {
      icon: Upload,
      title: "Song Analysis",
      description: "Upload songs for AI-powered analysis and intelligent music insights"
    },
    {
      icon: Drum,
      title: "Beat Studio",
      description: "Professional drum synthesis with real-time pattern editing"
    },
    {
      icon: Zap,
      title: "Code to Music",
      description: "Revolutionary bidirectional translation between code and musical compositions"
    },
    {
      icon: Shield,
      title: "Security Scanner",
      description: "AI-powered code vulnerability detection and security analysis"
    },
    {
      icon: MessageSquare,
      title: "AI Assistant",
      description: "24/7 intelligent help with multiple AI providers (Grok, Gemini, OpenAI)"
    }
  ];

  return (
    <div className="min-h-screen min-w-[1400px] bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto px-4 py-16 w-full">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="h-16 w-16 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Music className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            CodedSwitch
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            The world's first AI-powered bidirectional translation platform that bridges code development with music creation
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
            <Link href="/subscribe">
              <Button size="lg" variant="ghost" className="text-lg px-8">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>

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
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Workflow?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Experience the future of creative development with AI-powered tools that bridge the gap between code and music.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="text-lg px-8">
              Start Creating Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
