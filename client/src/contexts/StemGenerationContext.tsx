import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTrackStore } from "@/contexts/TrackStoreContext";
import type { TrackClip } from "@/types/studioTracks";

interface StemInfo {
  name: string;
  url: string;
  duration?: number;
}

interface StemJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  stems?: StemInfo[];
  error?: string;
}

interface StemGenerationContextValue {
  isSubmitting: boolean;
  lastJob?: StemJobStatus;
  generateStems: (params: { prompt: string; bpm?: number; key?: string }) => Promise<string>;
  fetchJob: (jobId: string) => Promise<StemJobStatus>;
  addStemsToSession: (stems: StemInfo[]) => void;
}

const StemGenerationContext = createContext<StemGenerationContextValue | undefined>(undefined);

export function StemGenerationProvider({ children }: { children: React.ReactNode }) {
  const trackStore = useTrackStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastJob, setLastJob] = useState<StemJobStatus | undefined>(undefined);

  const generateStems = useCallback(async ({ prompt, bpm, key }: { prompt: string; bpm?: number; key?: string }) => {
    setIsSubmitting(true);
    try {
      const resp = await fetch("/api/stem-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, bpm, key }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.jobId) {
        throw new Error(data?.error || "Failed to start stem generation");
      }
      const job: StemJobStatus = { jobId: data.jobId, status: "pending" };
      setLastJob(job);
      return data.jobId as string;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const fetchJob = useCallback(async (jobId: string): Promise<StemJobStatus> => {
    const resp = await fetch(`/api/stem-generation/${encodeURIComponent(jobId)}`);
    const data = await resp.json();
    const status: StemJobStatus = {
      jobId,
      status: data?.status || (resp.ok ? "completed" : "failed"),
      stems: Array.isArray(data?.stems)
        ? data.stems.map((s: { name?: string; url?: string; audioUrl?: string; duration?: number }) => ({
            name: s?.name || "stem",
            url: s?.url || s?.audioUrl || "",
            duration: s?.duration,
          }))
        : undefined,
      error: data?.error,
    };
    setLastJob(status);
    return status;
  }, []);

  const addStemsToSession = useCallback((stems: StemInfo[]) => {
    stems.filter(s => s.url).forEach((stem) => {
      const clip: TrackClip = {
        id: `stem-${stem.name}-${Date.now()}`,
        name: stem.name,
        kind: "audio",
        lengthBars: 16,
        startBar: 0,
        payload: {
          type: "audio",
          audioUrl: stem.url,
          duration: stem.duration,
          bpm: 120,
          source: "musicgen-stem",
          volume: 0.9,
          pan: 0,
          color: "#22d3ee",
        },
      };
      trackStore.addTrack(clip);
      trackStore.saveTrackToServer(clip);
    });
  }, [trackStore]);

  const value = useMemo<StemGenerationContextValue>(() => ({
    isSubmitting,
    lastJob,
    generateStems,
    fetchJob,
    addStemsToSession,
  }), [isSubmitting, lastJob, generateStems, fetchJob, addStemsToSession]);

  return (
    <StemGenerationContext.Provider value={value}>
      {children}
    </StemGenerationContext.Provider>
  );
}

export function useStemGeneration() {
  const ctx = useContext(StemGenerationContext);
  if (!ctx) throw new Error("useStemGeneration must be used within StemGenerationProvider");
  return ctx;
}
