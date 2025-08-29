import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Code,
  Music,
  Zap,
  MessageSquare,
  Drum,
  Upload,
  Shield,
} from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: Code,
      title: "Code Translation",
      description:
        "Translate code between 14+ programming languages with AI assistance",
    },
    {
      icon: Music,
      title: "Professional Music Studio",
      description:
        "Create music with multi-instrument orchestral compositions and MIDI support",
    },
    {
      icon: Upload,
      title: "Song Analysis",
      description:
        "Upload songs for AI-powered analysis and intelligent music insights",
    },
    {
      icon: Drum,
      title: "Beat Studio",
      description: "Professional drum synthesis with real-time pattern editing",
    },
    {
      icon: Zap,
      title: "Code to Music",
      description:
        "Revolutionary bidirectional translation between code and musical compositions",
    },
    {
      icon: Shield,
      title: "Security Scanner",
      description:
        "AI-powered code vulnerability detection and security analysis",
    },
    {
      icon: MessageSquare,
      title: "AI Assistant",
      description:
        "24/7 intelligent help with multiple AI providers (Grok, Gemini, OpenAI)",
    },
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
            The world's first AI-powered bidirectional translation platform that
            bridges code development with music creation
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

        {/* CTA Section */}
        <div className="text-center bg-card rounded-2xl p-12 border">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Experience the future of creative development with AI-powered tools
            that bridge the gap between code and music.
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
