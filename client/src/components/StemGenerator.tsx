import React, { useEffect, useMemo, useState } from "react";
import { useStemGeneration } from "@/contexts/StemGenerationContext";
import { Loader2, Play, Download, Plus } from "lucide-react";

interface StemCardProps {
  name: string;
  url: string;
  duration?: number;
}

function StemCard({ name, url, duration }: StemCardProps) {
  const filename = useMemo(() => url.split("/").pop() || name, [url, name]);
  return (
    <div className="p-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-white">{name}</div>
        <div className="text-xs text-gray-400">{filename} {duration ? `• ${duration.toFixed(1)}s` : ""}</div>
      </div>
      <audio controls className="w-40" src={url} />
    </div>
  );
}

export default function StemGenerator() {
  const { generateStems, fetchJob, lastJob, isSubmitting, addStemsToSession } = useStemGeneration();
  const [prompt, setPrompt] = useState("");
  const [bpm, setBpm] = useState<number | undefined>(120);
  const [key, setKey] = useState<string>("");
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (polling && lastJob?.jobId && lastJob.status !== "completed" && lastJob.status !== "failed") {
      interval = setInterval(() => fetchJob(lastJob.jobId), 2500);
    }
    return () => interval && clearInterval(interval);
  }, [polling, lastJob?.jobId, lastJob?.status, fetchJob]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    const jobId = await generateStems({ prompt: prompt.trim(), bpm, key: key || undefined });
    setPolling(true);
    await fetchJob(jobId);
  };

  const stems = lastJob?.stems || [];

  return (
    <div className="space-y-4 text-white">
      <div className="space-y-2">
        <label className="text-sm text-gray-300">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-sm"
          rows={3}
          placeholder="e.g. upbeat indie rock with driving drums and jangly guitars"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="stemgen-bpm" className="text-sm text-gray-300">BPM</label>
          <input
            id="stemgen-bpm"
            name="stemgen-bpm"
            autoComplete="off"
            type="number"
            value={bpm ?? ""}
            onChange={(e) => setBpm(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-lg bg-white/5 border border-white/10 p-2 text-sm"
            placeholder="120"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="stemgen-key" className="text-sm text-gray-300">Key</label>
          <input
            id="stemgen-key"
            name="stemgen-key"
            autoComplete="off"
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 p-2 text-sm"
            placeholder="C minor"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Generate Stems
        </button>
        {stems.length > 0 && (
          <button
            onClick={() => addStemsToSession(stems)}
            className="px-4 py-2 rounded-lg bg-cyan-500/80 hover:bg-cyan-500 text-white font-semibold flex items-center justify-center gap-2"
            title="Add all stems to session"
          >
            <Plus className="w-4 h-4" /> Add All
          </button>
        )}
      </div>

      {lastJob?.status && (
        <div className="text-xs text-gray-300">Status: {lastJob.status}</div>
      )}
      {lastJob?.error && (
        <div className="text-xs text-red-400">Error: {lastJob.error}</div>
      )}

      {stems.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Stems</div>
          {stems.map((stem) => (
            <StemCard key={stem.url} name={stem.name} url={stem.url} duration={stem.duration} />
          ))}
        </div>
      )}
    </div>
  );
}
