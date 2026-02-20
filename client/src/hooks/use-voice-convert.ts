import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface VoiceConvertJobSummary {
  id: string;
  status: string;
  executionMode: string;
  stemMode: number;
  provider: string;
  remixUrl: string | null;
  error: string | null;
  createdAt: string | null;
  completedAt: string | null;
}

export interface VoiceConvertJobDetail extends VoiceConvertJobSummary {
  pitchCorrect: boolean;
  vocalStemUrl: string | null;
  instrumentalStemUrl: string | null;
  drumsStemUrl: string | null;
  bassStemUrl: string | null;
  otherStemUrl: string | null;
  convertedVocalUrl: string | null;
  correctedVocalUrl: string | null;
  failedStage: string | null;
  startedAt: string | null;
}

export interface SubmitJobParams {
  voiceId: string;
  sourceUrl: string;
  sourceFileName?: string;
  stemMode: 2 | 4;
  provider: "elevenlabs" | "rvc";
  pitchCorrect: boolean;
  executionMode: "cloud" | "byo_keys";
}

export interface CostCheckResult {
  success: boolean;
  creditsCost: number;
  currentBalance?: number;
  canProceed: boolean;
  deficit?: number;
  message?: string;
}

export interface StoredApiKey {
  service: string;
  keyHint: string | null;
  isValid: boolean | null;
  lastUsedAt: string | null;
  createdAt: string | null;
}

export function useSubmitJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: SubmitJobParams) => {
      const res = await apiRequest("POST", "/api/voice-convert/jobs", params);
      return res.json() as Promise<{ success: boolean; jobId: string; status: string; message?: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-convert/jobs"] });
    },
  });
}

export function useCostCheck() {
  return useMutation({
    mutationFn: async (params: { stemMode: 2 | 4; executionMode: "cloud" | "byo_keys" }) => {
      const res = await apiRequest("POST", "/api/voice-convert/cost-check", params);
      return res.json() as Promise<CostCheckResult>;
    },
  });
}

export function useJobList(limit = 20) {
  return useQuery<{ success: boolean; jobs: VoiceConvertJobSummary[] }>({
    queryKey: ["/api/voice-convert/jobs", `?limit=${limit}`],
    refetchInterval: 10000,
  });
}

export function useJobDetail(jobId: string | null) {
  return useQuery<{ success: boolean; job: VoiceConvertJobDetail }>({
    queryKey: ["/api/voice-convert/jobs", jobId ? `/${jobId}` : ""],
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      const status = data.job?.status;
      if (status === "done" || status === "failed") return false;
      return 3000;
    },
  });
}

export function useJobSSE(jobId: string | null) {
  const [status, setStatus] = useState<string | null>(null);
  const [remixUrl, setRemixUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const token = localStorage.getItem("authToken");
    const url = `/api/voice-convert/jobs/${jobId}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) setStatus(data.status);
        if (data.remixUrl) setRemixUrl(data.remixUrl);
        if (data.error) setError(data.error);
        if (data.status === "done" || data.status === "failed") {
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [jobId]);

  return { status, remixUrl, error };
}

export function useApiKeys() {
  return useQuery<{ success: boolean; keys: StoredApiKey[] }>({
    queryKey: ["/api/voice-convert/api-keys"],
  });
}

export function useStoreApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { service: string; apiKey: string }) => {
      const res = await apiRequest("POST", "/api/voice-convert/api-keys", params);
      return res.json() as Promise<{ success: boolean; message: string; keyHint: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-convert/api-keys"] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (service: string) => {
      const res = await apiRequest("DELETE", `/api/voice-convert/api-keys/${service}`);
      return res.json() as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-convert/api-keys"] });
    },
  });
}

export interface ServiceStatus {
  available: boolean;
  type: "cloud" | "local";
  label: string;
  url?: string;
  gpu?: boolean;
}

export interface ServicesHealthResult {
  success: boolean;
  services: {
    replicate: ServiceStatus;
    elevenlabs: ServiceStatus;
    rvc: ServiceStatus;
    audioAnalysis: ServiceStatus;
  };
  capabilities: {
    cloudPipeline: boolean;
    localRvcPipeline: boolean;
    pitchCorrection: boolean;
  };
}

export function useServicesHealth() {
  return useQuery<ServicesHealthResult>({
    queryKey: ["/api/voice-convert/services-health"],
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
