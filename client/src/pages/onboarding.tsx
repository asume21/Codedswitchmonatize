import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  Music, Mic2, Code, Zap, Headphones,
  ArrowRight, ArrowLeft, Check, Sparkles,
} from "lucide-react";

const GENRES = [
  { id: "hip-hop", label: "Hip-Hop / Rap", icon: Mic2 },
  { id: "electronic", label: "Electronic / EDM", icon: Zap },
  { id: "pop", label: "Pop", icon: Music },
  { id: "rock", label: "Rock / Alternative", icon: Headphones },
  { id: "rnb", label: "R&B / Soul", icon: Sparkles },
  { id: "lo-fi", label: "Lo-Fi / Chill", icon: Headphones },
  { id: "classical", label: "Classical / Orchestral", icon: Music },
  { id: "other", label: "Other / Experimental", icon: Code },
];

const GOALS = [
  { id: "beats", label: "Make beats & instrumentals" },
  { id: "songs", label: "Write & produce full songs" },
  { id: "ai-generate", label: "Use AI to generate music" },
  { id: "mix-master", label: "Mix & master tracks" },
  { id: "collaborate", label: "Collaborate with other artists" },
  { id: "learn", label: "Learn music production" },
];

const EXPERIENCE = [
  { id: "beginner", label: "Beginner", desc: "New to music production" },
  { id: "intermediate", label: "Intermediate", desc: "Some DAW experience" },
  { id: "advanced", label: "Advanced", desc: "Experienced producer" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [experience, setExperience] = useState<string>("");
  const [, setLocation] = useLocation();

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    try {
      await apiRequest("POST", "/api/auth/onboarding", {
        genres: selectedGenres,
        goals: selectedGoals,
        experience,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
      setLocation("/studio");
    } catch {
      // Still navigate even if save fails — onboarding is non-blocking
      setLocation("/studio");
    }
  };

  const canProceed = [
    selectedGenres.length > 0,
    selectedGoals.length > 0,
    experience !== "",
  ];

  const steps = [
    // Step 1: Genre
    <div key="genre" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">What music do you make?</h2>
        <p className="text-cyan-200/60">Pick one or more genres. This helps us personalize your experience.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {GENRES.map((g) => {
          const selected = selectedGenres.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggleGenre(g.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                selected
                  ? "border-cyan-400 bg-cyan-500/15 shadow-[0_0_16px_rgba(6,182,212,0.25)]"
                  : "border-zinc-700 bg-zinc-900/50 hover:border-cyan-500/40"
              }`}
            >
              <g.icon className={`w-6 h-6 ${selected ? "text-cyan-300" : "text-zinc-400"}`} />
              <span className={`text-sm font-medium ${selected ? "text-white" : "text-zinc-300"}`}>
                {g.label}
              </span>
              {selected && <Check className="w-4 h-4 text-cyan-400" />}
            </button>
          );
        })}
      </div>
    </div>,

    // Step 2: Goals
    <div key="goals" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">What are your goals?</h2>
        <p className="text-cyan-200/60">Select what you want to do with CodedSwitch.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GOALS.map((g) => {
          const selected = selectedGoals.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggleGoal(g.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                selected
                  ? "border-cyan-400 bg-cyan-500/15 shadow-[0_0_16px_rgba(6,182,212,0.25)]"
                  : "border-zinc-700 bg-zinc-900/50 hover:border-cyan-500/40"
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selected ? "border-cyan-400 bg-cyan-500/30" : "border-zinc-500"
              }`}>
                {selected && <Check className="w-3 h-3 text-cyan-300" />}
              </div>
              <span className={`text-sm font-medium ${selected ? "text-white" : "text-zinc-300"}`}>
                {g.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>,

    // Step 3: Experience
    <div key="experience" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Your experience level?</h2>
        <p className="text-cyan-200/60">We'll tailor the interface to match your skill level.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {EXPERIENCE.map((e) => {
          const selected = experience === e.id;
          return (
            <button
              key={e.id}
              onClick={() => setExperience(e.id)}
              className={`flex flex-col items-center gap-2 p-6 rounded-xl border transition-all ${
                selected
                  ? "border-cyan-400 bg-cyan-500/15 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  : "border-zinc-700 bg-zinc-900/50 hover:border-cyan-500/40"
              }`}
            >
              <span className={`text-lg font-bold ${selected ? "text-cyan-300" : "text-zinc-200"}`}>
                {e.label}
              </span>
              <span className={`text-xs ${selected ? "text-cyan-200/70" : "text-zinc-500"}`}>
                {e.desc}
              </span>
              {selected && <Check className="w-5 h-5 text-cyan-400 mt-1" />}
            </button>
          );
        })}
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 astutely-app">
      {/* Progress bar */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-cyan-400/70 uppercase tracking-wider font-bold">
            Step {step + 1} of 3
          </span>
          <button
            onClick={() => { setLocation("/studio"); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip for now
          </button>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Welcome header on first step */}
      {step === 0 && (
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black brand-name mb-2">
            Welcome to CodedSwitch!
          </h1>
          <p className="text-zinc-400">Let's set up your studio in 30 seconds.</p>
        </div>
      )}

      {/* Step content */}
      <div className="w-full max-w-2xl">
        {steps[step]}
      </div>

      {/* Navigation */}
      <div className="w-full max-w-2xl flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        {step < 2 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed[step]}
            className="gap-2 bg-cyan-600/30 border-cyan-500/40 hover:bg-cyan-500/40"
          >
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={!canProceed[step]}
            className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
          >
            Launch Studio <Sparkles className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
