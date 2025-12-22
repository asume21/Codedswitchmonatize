import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, Zap } from "lucide-react";
import { beatAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DrumType, useAudio } from "@/hooks/use-audio";
import {
  SequencerState,
  Track,
  Clip,
  Step,
  TrackId,
  createDefaultState,
  createEmptyClip,
  DEFAULT_TRACKS,
} from "@/lib/sequencer";

const CELL_PX = 22;

type Props = {
  initial?: SequencerState;
};

export default function Sequencer({ initial }: Props) {
  const [state, setState] = useState<SequencerState>(
    () => initial ?? createDefaultState(4, 16)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLength, setSelectedLength] = useState<number>(8); // 4/8/16
  const gridRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const { playDrum, initialize } = useAudio();

  const totalSteps = state.bars * state.stepsPerBar;

  const barIndices = useMemo(() => Array.from({ length: state.bars }, (_, i) => i), [state.bars]);
  const stepIndices = useMemo(
    () => Array.from({ length: totalSteps }, (_, i) => i),
    [totalSteps]
  );

  const mapTrackIdToDrumType = (trackId: TrackId): DrumType | null => {
    switch (trackId) {
      case "kick":
        return "kick";
      case "snare":
        return "snare";
      case "hhc":
        return "hihat";
      case "hho":
        return "openhat";
      case "crash":
        return "crash";
      case "clap":
        return "clap";
      case "tom":
        return "tom";
      case "perc":
        return "perc";
      default:
        return null;
    }
  };

  const stopPlayback = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  };

  const startPlayback = async () => {
    await initialize();
    stopPlayback();
    setIsPlaying(true);

    const stepsPerBar = Math.max(1, state.stepsPerBar);
    const stepMs = (60000 / Math.max(1, state.bpm)) * (4 / stepsPerBar);
    const total = state.bars * stepsPerBar;

    let stepIndex = 0;
    intervalRef.current = setInterval(() => {
      const current = stepIndex;
      stepIndex = (stepIndex + 1) % total;

      state.tracks.forEach((track) => {
        if ((track as any).muted) return;
        const drumType = mapTrackIdToDrumType(track.id);
        if (!drumType) return;

        track.clips.forEach((clip) => {
          const localStep = current - clip.start;
          if (localStep < 0 || localStep >= clip.length) return;
          const stepData = clip.steps[localStep];
          if (!stepData?.active) return;
          playDrum(drumType, stepData.velocity ?? 1);
        });
      });
    }, stepMs);
  };

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        stopPlayback();
      } else {
        await startPlayback();
      }
    } catch (error) {
      console.error("Audio error:", error);
      toast({
        title: "Audio Error",
        description: "Failed to initialize audio. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStop = () => {
    stopPlayback();
  };

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // Apply a simple AI-generated pattern to the sequencer tracks
  function applyAIPatternToSequencer(pattern: any) {
    const totalSteps = state.bars * state.stepsPerBar;

    const kick = createEmptyClip(0, totalSteps, "AI Kick");
    const snare = createEmptyClip(0, totalSteps, "AI Snare");
    const hat = createEmptyClip(0, totalSteps, "AI Hi-hat");

    // Convert pattern to steps
    if (pattern.kick) {
      for (let i = 0; i < totalSteps && i < pattern.kick.length; i++) {
        if (pattern.kick[i]) {
          kick.steps[i] = { active: true, velocity: 1 } as Step;
        }
      }
    }

    if (pattern.snare) {
      for (let i = 0; i < totalSteps && i < pattern.snare.length; i++) {
        if (pattern.snare[i]) {
          snare.steps[i] = { active: true, velocity: 1 } as Step;
        }
      }
    }

    if (pattern.hihat) {
      for (let i = 0; i < totalSteps && i < pattern.hihat.length; i++) {
        if (pattern.hihat[i]) {
          hat.steps[i] = { active: true, velocity: 0.6 } as Step;
        }
      }
    }

    setState((s) => {
      const tracks = s.tracks.map((t) => {
        if (t.id === "kick") return { ...t, clips: [kick] } as Track;
        if (t.id === "snare") return { ...t, clips: [snare] } as Track;
        if (t.id === "hhc") return { ...t, clips: [hat] } as Track;
        return { ...t, clips: [] } as Track;
      });
      return { ...s, tracks };
    });
  }

  const aiGenerate = useMutation({
    mutationFn: async () => {
      // Minimal defaults; can be expanded with UI controls later
      return await beatAPI.generate({
        genre: "Hip-Hop",
        bpm: state.bpm,
        duration: state.bars,
        aiProvider: "grok",
      });
    },
    onSuccess: (data) => {
      applyAIPatternToSequencer(data.pattern || data);
      toast({ title: "AI pattern applied", description: data.description || "Sequencer filled from AI." });
    },
    onError: (err: any) => {
      toast({ title: "AI generate failed", description: err?.message || "Unknown error", variant: "destructive" });
    },
  });

  const handleAIGenerate = () => aiGenerate.mutate();

  const addClipAt = (trackIndex: number, stepIndex: number) => {
    const start = Math.max(0, Math.min(stepIndex, totalSteps - 1));
    const length = Math.min(selectedLength, totalSteps - start);
    const newClip = createEmptyClip(start, length, String(length));

    setState((s) => {
      const tracks = s.tracks.map((t, i) =>
        i === trackIndex ? { ...t, clips: [...t.clips, newClip] } : t
      );
      return { ...s, tracks };
    });
  };

  const removeClip = (trackIndex: number, clipId: string) => {
    setState((s) => {
      const tracks = s.tracks.map((t, i) =>
        i === trackIndex ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t
      );
      return { ...s, tracks };
    });
  };

  const toggleStepInClip = (
    trackIndex: number,
    clipId: string,
    localStep: number
  ) => {
    setState((s) => {
      const tracks = s.tracks.map((t, i) => {
        if (i !== trackIndex) return t;
        const clips = t.clips.map((c) => {
          if (c.id !== clipId) return c;
          const steps = c.steps.slice();
          const prev = steps[localStep];
          steps[localStep] = { active: !prev?.active, velocity: prev?.velocity ?? 1 } as Step;
          return { ...c, steps };
        });
        return { ...t, clips };
      });
      return { ...s, tracks };
    });
  };

  const setBpm = (v: number) => {
    setState((s) => ({ ...s, bpm: v }));
  };

  const gridWidth = totalSteps * CELL_PX;

  return (
    <Card className="bg-background border border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Sequencer</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlay}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={handleStop}>
              <Square className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleAIGenerate} disabled={aiGenerate.isPending}>
              <Zap className="h-4 w-4 mr-1" />
              {aiGenerate.isPending ? "Generating..." : "AI Generate"}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium">BPM: {state.bpm}</label>
            <Slider value={[state.bpm]} onValueChange={(v) => setBpm(v[0])} min={60} max={200} step={1} />
          </div>
          <div>
            <label className="text-xs font-medium">Bars: {state.bars}</label>
            <div className="text-xs text-muted-foreground">Fixed 16th grid · {totalSteps} steps</div>
          </div>
          <div>
            <label className="text-xs font-medium">Clip Length</label>
            <div className="flex gap-2 mt-2">
              {[4, 8, 16].map((len) => (
                <Button
                  key={len}
                  size="sm"
                  variant={selectedLength === len ? "default" : "outline"}
                  onClick={() => setSelectedLength(len)}
                >
                  {len}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          {/* Timeline header */}
          <div className="sticky top-0 z-10 bg-background" style={{ width: gridWidth }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${totalSteps}, ${CELL_PX}px)` }}>
              {stepIndices.map((i) => (
                <div
                  key={i}
                  className={`h-6 text-[10px] flex items-center justify-center border-b border-border ${
                    i % state.stepsPerBar === 0 ? "border-l-2 border-l-pink-400" : "border-l border-border/30"
                  }`}
                >
                  {i % state.stepsPerBar === 0 ? i / state.stepsPerBar + 1 : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Tracks */}
          <div ref={gridRef} className="space-y-2">
            {state.tracks.map((track, tIdx) => (
              <div key={track.id} className="flex">
                {/* Track header */}
                <div className="w-36 shrink-0 pr-2 flex items-center justify-between">
                  <div className="text-xs font-medium truncate">{track.name}</div>
                  <div className="flex gap-1">
                    {/* mute/solo placeholders for future */}
                  </div>
                </div>

                {/* Track grid */}
                <div
                  className="relative grow"
                  style={{ width: gridWidth }}
                >
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `repeat(${totalSteps}, ${CELL_PX}px)` }}
                  >
                    {stepIndices.map((i) => (
                      <div
                        key={i}
                        className={`h-8 border-b border-border/40 ${
                          i % state.stepsPerBar === 0 ? "border-l-2 border-l-pink-400" : "border-l border-border/30"
                        } hover:bg-white/5 cursor-pointer`}
                        onClick={() => addClipAt(tIdx, i)}
                        title="Click to add clip here"
                      />
                    ))}
                  </div>

                  {/* Clips */}
                  {track.clips.map((clip) => (
                    <ClipView
                      key={clip.id}
                      clip={clip}
                      totalSteps={totalSteps}
                      stepsPerBar={state.stepsPerBar}
                      onRemove={() => removeClip(tIdx, clip.id)}
                      onToggleStep={(localIndex) => toggleStepInClip(tIdx, clip.id, localIndex)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClipView({
  clip,
  totalSteps,
  stepsPerBar,
  onRemove,
  onToggleStep,
}: {
  clip: Clip;
  totalSteps: number;
  stepsPerBar: number;
  onRemove: () => void;
  onToggleStep: (localIndex: number) => void;
}) {
  const widthPx = clip.length * CELL_PX;
  const leftPx = clip.start * CELL_PX;

  const localIndices = useMemo(
    () => Array.from({ length: clip.length }, (_, i) => i),
    [clip.length]
  );

  return (
    <div
      className="absolute top-0 h-8 rounded-sm overflow-hidden border border-cyan-400/60 bg-cyan-400/10"
      style={{ left: leftPx, width: widthPx }}
    >
      {/* header */}
      <div className="h-4 text-[10px] px-1 flex items-center justify-between bg-cyan-400/20 select-none">
        <span className="font-semibold">{clip.name ?? clip.length}</span>
        <button className="opacity-70 hover:opacity-100" onClick={onRemove} title="Delete clip">
          ×
        </button>
      </div>
      {/* inner steps */}
      <div
        className="grid h-4"
        style={{ gridTemplateColumns: `repeat(${clip.length}, ${CELL_PX}px)` }}
      >
        {localIndices.map((i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStep(i);
            }}
            className={`h-4 border-t border-border/40 ${
              (clip.start + i) % stepsPerBar === 0
                ? "border-l-2 border-l-pink-400"
                : "border-l border-border/30"
            } ${clip.steps[i]?.active ? "bg-cyan-400" : "bg-transparent"}`}
            title={`Step ${i + 1}`}
          >
          </button>
        ))}
      </div>
    </div>
  );
}