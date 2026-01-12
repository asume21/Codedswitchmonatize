/**
 * Astutely Action Handler
 * 
 * Executes approved actions from Astutely in the frontend.
 * This is the bridge between AI suggestions and actual DAW operations.
 * 
 * USER-FIRST: Actions only execute after user approval.
 */

import { apiRequest } from './queryClient';

// Types matching backend
export interface SuggestedAction {
  id: string;
  toolName: string;
  description: string;
  params: Record<string, any>;
  preview?: any;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  action?: string;
}

export interface ActionCallbacks {
  // Transport
  onPlay?: () => void;
  onStop?: () => void;
  onPause?: () => void;
  onSetBpm?: (bpm: number) => void;
  onSetKey?: (key: string) => void;
  
  // Piano Roll
  onAddNote?: (note: { pitch: number; start: number; duration: number; velocity: number }) => void;
  onAddChord?: (chord: { pitches: number[]; start: number; duration: number }) => void;
  onAddMelody?: (notes: Array<{ pitch: number; start: number; duration: number }>) => void;
  onClearTrack?: () => void;
  
  // Mixer
  onSetVolume?: (trackId: string, volume: number) => void;
  onSetPan?: (trackId: string, pan: number) => void;
  onMuteTrack?: (trackId: string, muted: boolean) => void;
  onSoloTrack?: (trackId: string, solo: boolean) => void;
  
  // Tracks
  onCreateTrack?: (name: string, type: string) => void;
  onSelectTrack?: (trackId: string) => void;
  onDeleteTrack?: (trackId: string) => void;
  onRenameTrack?: (trackId: string, name: string) => void;
  
  // Navigation
  onNavigate?: (view: string) => void;
  
  // Generation (these call APIs)
  onGenerateBeat?: (style: string, prompt?: string) => Promise<void>;
  onGenerateMelody?: (options: { style?: string; key?: string; mood?: string }) => Promise<void>;
  onGenerateChords?: (options: { style?: string; progression?: string }) => Promise<void>;
  onGenerateAudio?: (prompt: string, duration?: number) => Promise<void>;
  onGenerateFullSong?: (prompt: string, style?: string, lyrics?: string) => Promise<void>;
  onGenerateLyrics?: (theme: string, style?: string, mood?: string) => Promise<void>;
  
  // Analysis
  onAnalyzeAudio?: (audioUrl: string) => Promise<void>;
  onAnalyzeLyrics?: (lyrics: string) => Promise<void>;
  onSeparateStems?: (audioUrl: string, stems?: number) => Promise<void>;
  
  // Status
  onGetStatus?: () => any;
  
  // Toast/notification
  onShowMessage?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Execute a single action result from the backend
 */
export function executeAction(result: ToolResult, callbacks: ActionCallbacks): void {
  if (!result.success || !result.action) {
    callbacks.onShowMessage?.(result.error || 'Action failed', 'error');
    return;
  }
  
  const { action, data, message } = result;
  
  switch (action) {
    // Transport
    case 'TRANSPORT_PLAY':
      callbacks.onPlay?.();
      break;
    case 'TRANSPORT_STOP':
      callbacks.onStop?.();
      break;
    case 'TRANSPORT_PAUSE':
      callbacks.onPause?.();
      break;
    case 'SET_BPM':
      callbacks.onSetBpm?.(data.bpm);
      break;
    case 'SET_KEY':
      callbacks.onSetKey?.(data.key);
      break;
      
    // Piano Roll
    case 'ADD_NOTE':
      callbacks.onAddNote?.(data);
      break;
    case 'ADD_CHORD':
      callbacks.onAddChord?.(data);
      break;
    case 'ADD_MELODY':
      callbacks.onAddMelody?.(data.notes);
      break;
    case 'CLEAR_TRACK':
      callbacks.onClearTrack?.();
      break;
      
    // Mixer
    case 'SET_VOLUME':
      callbacks.onSetVolume?.(data.trackId, data.volume);
      break;
    case 'SET_PAN':
      callbacks.onSetPan?.(data.trackId, data.pan);
      break;
    case 'MUTE_TRACK':
      callbacks.onMuteTrack?.(data.trackId, data.muted);
      break;
    case 'SOLO_TRACK':
      callbacks.onSoloTrack?.(data.trackId, data.solo);
      break;
      
    // Tracks
    case 'CREATE_TRACK':
      callbacks.onCreateTrack?.(data.name, data.type);
      break;
    case 'SELECT_TRACK':
      callbacks.onSelectTrack?.(data.trackId);
      break;
    case 'DELETE_TRACK':
      callbacks.onDeleteTrack?.(data.trackId);
      break;
    case 'RENAME_TRACK':
      callbacks.onRenameTrack?.(data.trackId, data.name);
      break;
      
    // Navigation
    case 'NAVIGATE':
      callbacks.onNavigate?.(data.view);
      break;
      
    // Generation - these are async
    case 'GENERATE_BEAT':
      callbacks.onGenerateBeat?.(data.style, data.prompt);
      break;
    case 'GENERATE_MELODY':
      callbacks.onGenerateMelody?.(data);
      break;
    case 'GENERATE_CHORDS':
      callbacks.onGenerateChords?.(data);
      break;
    case 'GENERATE_AUDIO':
      callbacks.onGenerateAudio?.(data.prompt, data.duration);
      break;
    case 'GENERATE_FULL_SONG':
      callbacks.onGenerateFullSong?.(data.prompt, data.style, data.lyrics);
      break;
    case 'GENERATE_LYRICS':
      callbacks.onGenerateLyrics?.(data.theme, data.style, data.mood);
      break;
      
    // Analysis
    case 'ANALYZE_AUDIO':
      callbacks.onAnalyzeAudio?.(data.audioUrl);
      break;
    case 'ANALYZE_LYRICS':
      callbacks.onAnalyzeLyrics?.(data.lyrics);
      break;
    case 'SEPARATE_STEMS':
      callbacks.onSeparateStems?.(data.audioUrl, data.stems);
      break;
      
    // Status
    case 'GET_STATUS':
      const status = callbacks.onGetStatus?.();
      if (status) {
        callbacks.onShowMessage?.(`BPM: ${status.bpm}, Key: ${status.key}, Tracks: ${status.tracks?.length || 0}`, 'info');
      }
      break;
      
    default:
      console.warn(`Unknown action: ${action}`);
  }
  
  // Show success message if provided
  if (message) {
    callbacks.onShowMessage?.(message, 'success');
  }
}

/**
 * Execute an approved suggestion by calling the backend
 */
export async function executeApprovedSuggestion(
  suggestion: SuggestedAction,
  projectState: any,
  callbacks: ActionCallbacks
): Promise<ToolResult> {
  try {
    const response = await apiRequest('POST', '/api/astutely/execute', {
      action: suggestion,
      projectState
    });
    
    const result = await response.json();
    
    if (result.success) {
      executeAction(result, callbacks);
    }
    
    return result;
  } catch (error: any) {
    const errorResult: ToolResult = {
      success: false,
      error: error.message || 'Failed to execute action'
    };
    callbacks.onShowMessage?.(errorResult.error!, 'error');
    return errorResult;
  }
}

/**
 * Chat with Astutely and get suggestions
 */
export async function chatWithAstutely(
  message: string,
  projectState: any,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<{
  message: string;
  suggestedActions: SuggestedAction[];
  quickActions: ToolResult[];
  success: boolean;
}> {
  try {
    const response = await apiRequest('POST', '/api/astutely/chat', {
      message,
      projectState,
      conversationHistory
    });
    
    return await response.json();
  } catch (error: any) {
    return {
      message: "Sorry, I couldn't process that. Try again or use a simple command like 'play' or 'stop'.",
      suggestedActions: [],
      quickActions: [],
      success: false
    };
  }
}

/**
 * Get available tools from Astutely
 */
export async function getAstutelyTools(): Promise<{
  categories: string[];
  tools: Record<string, any[]>;
  totalTools: number;
}> {
  try {
    const response = await apiRequest('GET', '/api/astutely/tools');
    return await response.json();
  } catch (error) {
    return { categories: [], tools: {}, totalTools: 0 };
  }
}
