/**
 * useStudioStore — Single source of truth for the entire studio.
 *
 * Phase 1: BPM, key, time signature, transport state.
 * Phase 2: Tracks, patterns, generated content.
 * Phase 3: Server sync, persistence.
 *
 * Every feature (Organism, Beat Maker, Piano Roll, Mixer, Astutely)
 * reads from and writes to this store. No more scattered useState copies.
 */
import { create } from 'zustand'
import { subscribeWithSelector, persist } from 'zustand/middleware'

// ── Types ──────────────────────────────────────────────────────────

export interface TimeSignature {
  numerator: number
  denominator: number
}

export type MusicalKey =
  | 'C' | 'C#' | 'D' | 'Eb' | 'E' | 'F'
  | 'F#' | 'G' | 'Ab' | 'A' | 'Bb' | 'B'

export type KeyMode = 'major' | 'minor'

export interface LoopRegion {
  enabled: boolean
  start: number
  end: number
}

// ── Generated content types (Phase 2) ─────────────────────────────

export interface StudioNote {
  id: string
  note: string           // e.g. 'C', 'F#'
  octave: number
  step: number           // step position in pattern (16th note grid)
  velocity: number       // 0–127
  length: number         // in steps
  drumType?: 'kick' | 'snare' | 'hihat' | 'perc'
}

export type GeneratorType = 'drum' | 'bass' | 'melody' | 'texture' | 'chord'

export interface OrganismSnapshot {
  id: string
  timestamp: number
  bpm: number
  key: MusicalKey
  keyMode: KeyMode
  source: 'organism' | 'astutely'
  tracks: Record<GeneratorType, StudioNote[]>
}

export interface StudioState {
  // ── Musical globals ──
  bpm: number
  key: MusicalKey
  keyMode: KeyMode
  timeSignature: TimeSignature

  // ── Transport ──
  isPlaying: boolean
  position: number          // beats
  loop: LoopRegion

  // ── Key detection (from Organism / ScaleSnapEngine) ──
  detectedKey: MusicalKey | null
  detectedKeyMode: KeyMode | null
  detectedKeyConfidence: number

  // ── Generated content (Phase 2) ──
  organismSnapshots: OrganismSnapshot[]     // history of generated content
  activeSnapshotId: string | null           // which snapshot is loaded into the workspace

  // ── Actions: Musical globals ──
  setBpm: (bpm: number) => void
  setKey: (key: MusicalKey, mode?: KeyMode) => void
  setTimeSignature: (ts: Partial<TimeSignature>) => void

  // ── Actions: Transport ──
  play: () => void
  pause: () => void
  stop: () => void
  seek: (position: number) => void
  setLoop: (config: Partial<LoopRegion>) => void
  clearLoop: () => void
  toggleRecordArm: (armed?: boolean) => void
  isRecordArmed: boolean

  // ── Actions: Key detection (called by Organism bridge) ──
  setDetectedKey: (key: MusicalKey, mode: KeyMode, confidence: number) => void
  acceptDetectedKey: () => void   // promote detected key to active key

  // ── Actions: Generated content (Phase 2) ──
  pushOrganismSnapshot: (snapshot: OrganismSnapshot) => void
  setActiveSnapshot: (id: string | null) => void
  getActiveSnapshot: () => OrganismSnapshot | null
  clearSnapshots: () => void
}

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_LOOP: LoopRegion = {
  enabled: false,
  start: 0,
  end: 8,
}

const MAX_SNAPSHOTS = 20

// ── Store ──────────────────────────────────────────────────────────

const PERSIST_STORAGE_KEY = 'codedswitch_studio_store'

export const useStudioStore = create<StudioState>()(
  persist(
  subscribeWithSelector((set, get) => ({
    // Musical globals
    bpm: 120,
    key: 'C',
    keyMode: 'major',
    timeSignature: { numerator: 4, denominator: 4 },

    // Transport
    isPlaying: false,
    isRecordArmed: false,
    position: 0,
    loop: { ...DEFAULT_LOOP },

    // Key detection
    detectedKey: null,
    detectedKeyMode: null,
    detectedKeyConfidence: 0,

    // Generated content (Phase 2)
    organismSnapshots: [],
    activeSnapshotId: null,

    // ── Musical global actions ──

    setBpm: (bpm: number) => {
      const clamped = Math.max(20, Math.min(300, bpm))
      set({ bpm: clamped })
    },

    setKey: (key: MusicalKey, mode?: KeyMode) => {
      set({ key, ...(mode !== undefined ? { keyMode: mode } : {}) })
    },

    setTimeSignature: (ts: Partial<TimeSignature>) => {
      set((state) => ({
        timeSignature: {
          numerator:
            ts.numerator && ts.numerator > 0
              ? ts.numerator
              : state.timeSignature.numerator,
          denominator:
            ts.denominator && ts.denominator > 0
              ? ts.denominator
              : state.timeSignature.denominator,
        },
      }))
    },

    // ── Transport actions ──

    play: () => {
      if (!get().isPlaying) set({ isPlaying: true })
    },

    pause: () => {
      set({ isPlaying: false })
    },

    stop: () => {
      const { loop } = get()
      set({
        isPlaying: false,
        position: loop.enabled ? loop.start : 0,
      })
    },

    seek: (position: number) => {
      set({ position: Math.max(0, position) })
    },

    setLoop: (config: Partial<LoopRegion>) => {
      set((state) => ({
        loop: {
          enabled: config.enabled ?? state.loop.enabled,
          start: config.start ?? state.loop.start,
          end: config.end ?? state.loop.end,
        },
      }))
    },

    clearLoop: () => {
      set({ loop: { ...DEFAULT_LOOP } })
    },
    
    toggleRecordArm: (armed?: boolean) => {
      set((state) => ({ isRecordArmed: armed ?? !state.isRecordArmed }))
    },

    // ── Key detection actions ──

    setDetectedKey: (key: MusicalKey, mode: KeyMode, confidence: number) => {
      set({
        detectedKey: key,
        detectedKeyMode: mode,
        detectedKeyConfidence: confidence,
      })
    },

    acceptDetectedKey: () => {
      const { detectedKey, detectedKeyMode } = get()
      if (detectedKey) {
        set({
          key: detectedKey,
          keyMode: detectedKeyMode ?? 'major',
        })
      }
    },

    // ── Generated content actions (Phase 2) ──

    pushOrganismSnapshot: (snapshot: OrganismSnapshot) => {
      set((state) => ({
        organismSnapshots: [snapshot, ...state.organismSnapshots].slice(0, MAX_SNAPSHOTS),
        activeSnapshotId: snapshot.id,
      }))
    },

    setActiveSnapshot: (id: string | null) => {
      set({ activeSnapshotId: id })
    },

    getActiveSnapshot: () => {
      const { organismSnapshots, activeSnapshotId } = get()
      if (!activeSnapshotId) return null
      return organismSnapshots.find(s => s.id === activeSnapshotId) ?? null
    },

    clearSnapshots: () => {
      set({ organismSnapshots: [], activeSnapshotId: null })
    },
  })),
  {
    name: PERSIST_STORAGE_KEY,
    version: 1,
    partialize: (state) => ({
      // Only persist musical state — NOT transport (isPlaying/position are ephemeral)
      bpm: state.bpm,
      key: state.key,
      keyMode: state.keyMode,
      timeSignature: state.timeSignature,
      detectedKey: state.detectedKey,
      detectedKeyMode: state.detectedKeyMode,
      detectedKeyConfidence: state.detectedKeyConfidence,
      organismSnapshots: state.organismSnapshots,
      activeSnapshotId: state.activeSnapshotId,
    }),
    merge: (persisted, current) => ({
      ...current,
      ...(persisted as Partial<StudioState>),
    }),
  },
  )
)

// ── Debounced server sync ─────────────────────────────────────────
// When musical globals change, mark the project dirty so the existing
// projectManager auto-save (30s interval) picks it up.

let serverSyncTimer: ReturnType<typeof setTimeout> | null = null
const SERVER_SYNC_DEBOUNCE_MS = 2000

useStudioStore.subscribe(
  (state) => ({ bpm: state.bpm, key: state.key, keyMode: state.keyMode, timeSignature: state.timeSignature }),
  () => {
    if (serverSyncTimer) clearTimeout(serverSyncTimer)
    serverSyncTimer = setTimeout(() => {
      try {
        // Dynamic import to avoid circular deps — projectManager is a standalone module
        import('../lib/projectManager').then(({ markDirty, getCurrentProject }) => {
          const project = getCurrentProject()
          if (project) {
            const store = useStudioStore.getState()
            project.bpm = store.bpm
            project.key = store.key
            project.timeSignature = [store.timeSignature.numerator, store.timeSignature.denominator]
            markDirty()
          }
        }).catch(() => { /* projectManager not available — ok */ })
      } catch { /* ignore */ }
    }, SERVER_SYNC_DEBOUNCE_MS)
  },
  { equalityFn: (a, b) => a.bpm === b.bpm && a.key === b.key && a.keyMode === b.keyMode && a.timeSignature === b.timeSignature }
)
