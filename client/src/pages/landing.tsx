import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Music, Zap, MessageSquare, Drum, Upload, Shield, Send } from "lucide-react";
import { FEATURES } from "@/config/features";
import HeroV2 from "@/components/v2/layout/Hero";

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
    <div className="min-h-screen min-w-[1400px]" style={{ background: 'var(--bg-base)' }}>
      {/* TEMPORARY: Force V2 Hero to test */}
      <HeroV2 />
      
      <div className="container mx-auto px-4 py-16 w-full">

        {/* Features Grid - V2 Style */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="glass transition-all duration-300 hover:scale-105 rounded-xl p-6"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                backdropFilter: 'var(--glass-blur)'
              }}
            >
              <div className="mb-4">
                <div 
                  className="inline-flex p-3 rounded-lg mb-4"
                  style={{
                    background: 'var(--gradient-card)',
                    boxShadow: '0 0 20px rgba(123, 97, 255, 0.2)'
                  }}
                >
                  <feature.icon 
                    className="h-6 w-6" 
                    style={{ color: 'var(--accent-primary)' }}
                  />
                </div>
                <h3 
                  className="text-lg font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {feature.title}
                </h3>
              </div>
              <p 
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Waitlist Section - V2 Style */}
        <div 
          className="glass text-center rounded-2xl p-12 mb-12"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'var(--glass-blur)'
          }}
        >
          <h2 
            className="text-3xl font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Join the Waitlist
          </h2>
          <p 
            className="mb-6 max-w-xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
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
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)'
                }}
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
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            <Button 
              onClick={submitWaitlist} 
              disabled={submitting} 
              className="min-w-36"
              style={{
                background: 'var(--accent-primary)',
                color: 'var(--text-primary)'
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Joining..." : "Join Waitlist"}
            </Button>
          </div>
          {status && (
            <p 
              className="mt-3 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {status}
            </p>
          )}
        </div>

        {/* CTA Section - V2 Style */}
        <div 
          className="glass text-center rounded-2xl p-12"
          style={{
            background: 'var(--gradient-card)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'var(--glass-blur)',
            boxShadow: '0 0 40px rgba(123, 97, 255, 0.2)'
          }}
        >
          <h2 
            className="text-3xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Ready to Transform Your Workflow?
          </h2>
          <p 
            className="mb-6 max-w-xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            Experience the future of creative development with AI-powered tools that bridge the gap between code and music.
          </p>
          <Link href="/dashboard">
            <Button 
              size="lg" 
              className="text-lg px-8"
              style={{
                background: 'var(--gradient-hero)',
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-glow-primary)'
              }}
            >
              Start Creating Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
