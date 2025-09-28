import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Music, Zap, MessageSquare, Drum, Upload, Shield, Send } from "lucide-react";

export default function Landing() {
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
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link href="/music-studio">
              <Button variant="outline" size="lg" className="text-lg px-8">
                Try Music Studio
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
