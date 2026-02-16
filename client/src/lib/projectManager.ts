/**
 * Project Manager — Save/Load/Auto-save for full DAW project state.
 * Persists tracks, notes, clips, mixer settings, automation, tempo, key.
 * Uses the existing /api/projects endpoints + localStorage for offline draft.
 */

import { apiRequest } from '@/lib/queryClient';
import { eventBus } from '@/lib/eventBus';
import type { Project, Track, Effect } from '../../../shared/studioTypes';

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
  createdAt: string;
  updatedAt: string;
  version: number;
}

const LOCAL_DRAFT_KEY = 'codedswitch_project_draft';
const AUTO_SAVE_INTERVAL_MS = 30_000; // 30 seconds

let currentProject: ProjectState | null = null;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
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

export function createNewProjectState(name: string): ProjectState {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    bpm: 120,
    timeSignature: [4, 4],
    key: 'C',
    swing: 10,
    tracks: [],
    audioClips: [],
    automationLanes: [],
    mixerChannels: [],
    mixBuses: [
      {
        id: 'reverb-bus',
        name: 'Reverb',
        type: 'aux',
        volume: 0.7,
        pan: 0,
        muted: false,
        effects: [{ id: 'bus-reverb', type: 'reverb', parameters: { decay: 2.5, mix: 0.6, preDelay: 20 }, enabled: true }],
        inputTrackIds: [],
      },
      {
        id: 'delay-bus',
        name: 'Delay',
        type: 'aux',
        volume: 0.5,
        pan: 0,
        muted: false,
        effects: [{ id: 'bus-delay', type: 'delay', parameters: { time: 375, feedback: 0.35, mix: 0.5 }, enabled: true }],
        inputTrackIds: [],
      },
    ],
    masterBus: createDefaultMasterBus(),
    createdAt: now,
    updatedAt: now,
    version: 1,
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

/**
 * Save project to server (and local draft as backup).
 */
export async function saveProject(project?: ProjectState): Promise<void> {
  const p = project || currentProject;
  if (!p) throw new Error('No project to save');

  p.updatedAt = new Date().toISOString();
  p.version += 1;

  // Save to localStorage as backup
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(p));
  } catch {
    console.warn('Could not save local draft');
  }

  // Save to server
  const res = await apiRequest('PUT', `/api/projects/${p.id}`, {
    name: p.name,
    data: p,
  });

  if (!res.ok) {
    // Try creating if it doesn't exist
    const createRes = await apiRequest('POST', '/api/projects', {
      name: p.name,
      data: p,
    });
    if (!createRes.ok) {
      throw new Error('Failed to save project');
    }
  }

  isDirty = false;
  eventBus.emit('session:updated' as any, { sessionId: p.id, data: p });
}

/**
 * Load project from server by ID.
 */
export async function loadProject(projectId: string): Promise<ProjectState> {
  const res = await apiRequest('GET', `/api/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to load project');
  const data = await res.json();

  const project = (data.data || data) as ProjectState;
  // Ensure all required fields exist (migration safety)
  if (!project.audioClips) project.audioClips = [];
  if (!project.automationLanes) project.automationLanes = [];
  if (!project.mixerChannels) project.mixerChannels = [];
  if (!project.mixBuses) project.mixBuses = [];
  if (!project.masterBus) project.masterBus = createDefaultMasterBus();
  if (!project.version) project.version = 1;

  currentProject = project;
  isDirty = false;
  return project;
}

/**
 * Load the local draft (for recovery after crash/close).
 */
export function loadLocalDraft(): ProjectState | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectState;
  } catch {
    return null;
  }
}

export function clearLocalDraft() {
  localStorage.removeItem(LOCAL_DRAFT_KEY);
}

/**
 * List all user projects from server.
 */
export async function listProjects(): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
  const res = await apiRequest('GET', '/api/projects');
  if (!res.ok) return [];
  return res.json();
}

/**
 * Delete a project from server.
 */
export async function deleteProject(projectId: string): Promise<void> {
  await apiRequest('DELETE', `/api/projects/${projectId}`);
  if (currentProject?.id === projectId) {
    currentProject = null;
    isDirty = false;
  }
}

/**
 * Start auto-save timer. Saves every 30s if dirty.
 */
export function startAutoSave() {
  stopAutoSave();
  autoSaveTimer = setInterval(async () => {
    if (isDirty && currentProject) {
      try {
        await saveProject();
        console.log('[AutoSave] Project saved');
      } catch (err) {
        console.warn('[AutoSave] Failed:', err);
        // Still save locally
        try {
          localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(currentProject));
        } catch { /* ignore */ }
      }
    }
  }, AUTO_SAVE_INTERVAL_MS);
}

export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/**
 * Export project as JSON file for download.
 */
export function exportProjectFile(project?: ProjectState): void {
  const p = project || currentProject;
  if (!p) return;
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.cswproj`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import project from a .cswproj JSON file.
 */
export async function importProjectFile(file: File): Promise<ProjectState> {
  const text = await file.text();
  const project = JSON.parse(text) as ProjectState;
  // Assign new ID to avoid collisions
  project.id = crypto.randomUUID();
  project.updatedAt = new Date().toISOString();
  if (!project.audioClips) project.audioClips = [];
  if (!project.automationLanes) project.automationLanes = [];
  if (!project.mixerChannels) project.mixerChannels = [];
  if (!project.mixBuses) project.mixBuses = [];
  if (!project.masterBus) project.masterBus = createDefaultMasterBus();
  currentProject = project;
  isDirty = true;
  return project;
}
