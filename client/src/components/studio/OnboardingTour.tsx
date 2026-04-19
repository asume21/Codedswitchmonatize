import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Drum,
  Piano,
  Sliders,
  Sparkles,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

const STORAGE_KEY = "studio:onboarding:v1:completed";

interface Slide {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    icon: <Sparkles className="h-10 w-10 text-cyan-400" />,
    title: "Welcome to CodedSwitch Studio",
    body: (
      <>
        <p>
          A full music studio with an AI collaborator living inside it.
          The workflow is four moves:{" "}
          <strong className="text-cyan-300">
            beat → melody → arrangement → export
          </strong>
          .
        </p>
        <p className="text-gray-400 mt-3 text-sm">
          This walkthrough takes about 60 seconds. Skip anytime — you can
          always find it again from the help menu.
        </p>
      </>
    ),
  },
  {
    icon: <Drum className="h-10 w-10 text-orange-400" />,
    title: "1. Start a beat",
    body: (
      <>
        <p>
          Open the <strong className="text-orange-300">Beat Lab</strong> tab
          (or press <Kbd>1</Kbd>). Pick a kit, click pads on the grid, or ask
          the AI to generate a pattern in the style you want.
        </p>
        <p className="text-gray-400 mt-3 text-sm">
          Every beat sets the tempo and feel for the whole track.
        </p>
      </>
    ),
  },
  {
    icon: <Piano className="h-10 w-10 text-violet-400" />,
    title: "2. Layer melody & bass",
    body: (
      <>
        <p>
          Switch to <strong className="text-violet-300">Piano Roll</strong>{" "}
          (<Kbd>2</Kbd>). Draw notes by clicking, or press{" "}
          <Kbd>O</Kbd> to wake the Organism — our AI collaborator that
          freestyles melody over your beat in real time.
        </p>
        <p className="text-gray-400 mt-3 text-sm">
          The Organism has five moods (Heat, Ice, Smoke, Gravel, Glow) —
          pick one that matches the vibe.
        </p>
      </>
    ),
  },
  {
    icon: <Sliders className="h-10 w-10 text-emerald-400" />,
    title: "3. Arrange & export",
    body: (
      <>
        <p>
          Jump to <strong className="text-emerald-300">Arrangement</strong>{" "}
          (<Kbd>4</Kbd>) to lay out sections, then{" "}
          <strong className="text-cyan-300">Mixer</strong> (<Kbd>3</Kbd>) to
          balance levels. Export as WAV or share directly to the Social Hub.
        </p>
        <p className="text-gray-400 mt-3 text-sm">
          Press <Kbd>?</Kbd> any time for the full shortcuts cheatsheet.
          You're ready — let's make something.
        </p>
      </>
    ),
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.pathname.startsWith("/studio")) return;
    const completed = localStorage.getItem(STORAGE_KEY) === "true";
    if (!completed) setOpen(true);
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const isFirst = step === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish()}>
      <DialogContent className="max-w-lg bg-gray-900 border-gray-700 text-gray-100">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {slide.icon}
            <DialogTitle className="text-xl font-bold">
              {slide.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="text-gray-200 leading-relaxed mt-2 min-h-[120px]">
          {slide.body}
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-cyan-400" : "w-1.5 bg-gray-600"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={finish}
              className="text-gray-400 hover:text-gray-200"
            >
              Skip
            </Button>
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                className="border-gray-600"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              {isLast ? (
                "Let's make a beat"
              ) : (
                <>
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-200 text-xs font-mono">
      {children}
    </kbd>
  );
}

export default OnboardingTour;
