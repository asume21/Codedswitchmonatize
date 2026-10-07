/**
 * Project Manager — Save/Load/Auto-save for full DAW project state.
 * Persists tracks, notes, clips, mixer settings, automation, tempo, key.
 * Uses the existing /api/projects endpoints + localStorage for offline draft.
 */

import { apiRequest } from '@/lib/queryClient';
import { eventBus } from '@/lib/eventBus';
import type { Project, Track, Effect } from '../../../shared/studioTypes';
import type { ArrangementClip } from '@/types/studioTracks';
import type { SectionMarker } from '@/stores/useStudioStore';

export interface AutomationPoint {
  time: number;    // in beats
  value: number;   // 0-1 normalized
  curve: 'linear' | 'exponential' | 'step';
}

export interface AutomationLane {
  id: string;
  trackId: string;
  parameter: string; // 'volume' | 'pan' | 'mute' | effect param like 'reverb.mix'
  points: AutomationPoint[];
  enabled: boolean;
}

export interface AudioClip {
  id: string;
  trackId: string;
  name: string;
  audioUrl: string;
  startBeat: number;
  endBeat: number;
  offsetBeat: number;   // trim start within the source audio
  fadeInBeats: number;
  fadeOutBeats: number;
  gain: number;         // clip gain, 0-2 (1 = unity)
  loop: boolean;
  loopEndBeat: number;
  source: 'recording' | 'ai' | 'imported' | 'bounced';
}

/** Convert an AudioClip (flat, audio-only) to an ArrangementClip (unified timeline type). */
export function audioClipToArrangement(clip: AudioClip): ArrangementClip {
  return {
    id: clip.id,
    startBeat: clip.startBeat,
    endBeat: clip.endBeat,
    offsetBeat: clip.offsetBeat,
    fadeInBeats: clip.fadeInBeats,
    fadeOutBeats: clip.fadeOutBeats,
    gain: clip.gain,
    loop: clip.loop,
    loopEndBeat: clip.loopEndBeat,
    type: 'audio',
    audioUrl: clip.audioUrl,
    source: clip.source,
    name: clip.name,
  };
}

/** Convert an ArrangementClip back to an AudioClip (for legacy code paths). */
export function arrangementToAudioClip(clip: ArrangementClip, trackId: string): AudioClip {
  return {
    id: clip.id,
    trackId,
    name: clip.name,
    audioUrl: clip.audioUrl ?? '',
    startBeat: clip.startBeat,
    endBeat: clip.endBeat,
    offsetBeat: clip.offsetBeat,
    fadeInBeats: clip.fadeInBeats,
    fadeOutBeats: clip.fadeOutBeats,
    gain: clip.gain,
    loop: clip.loop,
    loopEndBeat: clip.loopEndBeat,
    source: clip.source ?? 'imported',
  };
}

export interface MixerChannel {
  trackId: string;
  volume: number;       // 0-1
  pan: number;          // -1 to 1
  muted: boolean;
  soloed: boolean;
  sends: SendConfig[];
  effects: Effect[];
  inputSource?: string; // for recording: device input ID
}

export interface SendConfig {
  busId: string;
  amount: number;       // 0-1
  preFader: boolean;
}

export interface MixBus {
  id: string;
  name: string;
  type: 'aux' | 'group' | 'master';
  volume: number;
  pan: number;
  muted: boolean;
  effects: Effect[];
  inputTrackIds: string[];  // for group buses
}

export interface ProjectState {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  key: string;
  swing: number;
  tracks: Track[];
  audioClips: AudioClip[];
  automationLanes: AutomationLane[];
  mixerChannels: MixerChannel[];
  mixBuses: MixBus[];
  masterBus: MixBus;
  sectionMarkers: SectionMarker[];
  songEndBeat: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}


let currentProject: ProjectState | null = null;
let isDirty = false;

export function createDefaultMasterBus(): MixBus {
  return {
    id: 'master',
    name: 'Master',
    type: 'master',
    volume: 0.85,
    pan: 0,
    muted: false,
    effects: [
      { id: 'master-eq', type: 'eq', parameters: { low: 0, mid: 0, high: 0 }, enabled: true },
      { id: 'master-comp', type: 'compressor', parameters: { threshold: -12, ratio: 3, attack: 10, release: 100 }, enabled: true },
      { id: 'master-limiter', type: 'limiter', parameters: { threshold: -1, ceiling: -0.3 }, enabled: true },
    ],
    inputTrackIds: [],
  };
}

export function getCurrentProject(): ProjectState | null {
  return currentProject;
}

export function setCurrentProject(project: ProjectState) {
  currentProject = project;
  isDirty = false;
  eventBus.emit('session:loaded' as any, { sessionId: project.id });
}

export function markDirty() {
  isDirty = true;
}

export function getIsDirty(): boolean {
  return isDirty;
}

// ── Account-backed projects (/api/projects) ─────────────────────────────────
// The studio's full snapshot (UnifiedStudioWorkspace.buildProjectData) is stored
// opaquely in `data`. This is the ONE client for the projects API — File → Save,
// File → Open, the Project Manager window and studio autosave all use it.

export interface CloudProjectSummary {
  id: string;
  name: string;
  updatedAt: string | null;
}

export interface CloudProject extends CloudProjectSummary {
  data: unknown;
}

async function readJson(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

export async function listProjects(): Promise<CloudProjectSummary[]> {
  const body = await readJson(await apiRequest('GET', '/api/projects'));
  return body.projects ?? [];
}

export async function loadProject(projectId: string): Promise<CloudProject> {
  const body = await readJson(await apiRequest('GET', `/api/projects/${projectId}`));
  const { id, name, updatedAt, data } = body.project;
  return { id, name, updatedAt: updatedAt ?? null, data };
}

/** Create (no id) or update (id) a project. Returns the server's id. */
export async function saveProjectToCloud(project: {
  id?: string | null;
  name: string;
  data: unknown;
}): Promise<CloudProjectSummary> {
  const payload = { name: project.name, data: project.data };
  const res = project.id
    ? await apiRequest('PUT', `/api/projects/${project.id}`, payload)
    : await apiRequest('POST', '/api/projects', payload);
  const body = await readJson(res);
  const { id, name, updatedAt } = body.project;
  return { id, name, updatedAt: updatedAt ?? null };
}

export async function deleteProject(projectId: string): Promise<void> {
  await readJson(await apiRequest('DELETE', `/api/projects/${projectId}`));
}
