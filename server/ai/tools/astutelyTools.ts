/**
 * Astutely Tool System
 * 
 * USER-FIRST DESIGN: Astutely suggests actions, user approves them.
 * 
 * Flow:
 * 1. User asks Astutely to do something
 * 2. Astutely analyzes and SUGGESTS actions (doesn't auto-execute)
 * 3. User sees the suggestions and can:
 *    - Accept (execute the action)
 *    - Modify (change parameters)
 *    - Reject (cancel)
 * 4. Only approved actions are executed
 * 
 * This is similar to how Windsurf shows code changes for approval.
 * The AI assists, but the USER always has final control.
 * 
 * Tools available:
 * - Piano Roll (read/write notes)
 * - Mixer (adjust levels, effects)
 * - Transport (play, stop, set BPM)
 * - Beat Maker (generate patterns)
 * - Audio Generation (MusicGen, Suno)
 * - Lyrics (generate, analyze)
 * - Stem Separation (split audio)
 */

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  action?: string; // Action type for frontend
}

// Suggested action that user can approve/reject
export interface SuggestedAction {
  id: string;                    // Unique ID for this suggestion
  toolName: string;              // Which tool to use
  description: string;           // Human-readable description
  params: Record<string, any>;   // Parameters for the tool
  preview?: any;                 // Preview of what will happen (e.g., notes to add)
  status: 'pending' | 'approved' | 'rejected' | 'modified';
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'transport' | 'piano_roll' | 'mixer' | 'tracks' | 'generation' | 'navigation' | 'analysis';
  parameters: Record<string, { type: string; description: string; required?: boolean; enum?: string[] }>;
}

export interface ToolContext {
  userId?: string;
  sessionId?: string;
  projectState: ProjectState;
}

export interface ProjectState {
  bpm: number;
  key: string;
  timeSignature: string;
  isPlaying: boolean;
  currentPosition: number;
  tracks: Track[];
  selectedTrackId?: string;
  songName?: string;
}

export interface Track {
  id: string;
  name: string;
  type: 'midi' | 'audio' | 'beat';
  notes?: Note[];
  audioUrl?: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export interface Note {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

// ============================================
// ALL TOOLS ASTUTELY CAN USE
// ============================================

export const ASTUTELY_TOOLS: ToolDefinition[] = [
  // TRANSPORT TOOLS
  {
    name: 'play',
    description: 'Start playback of the project',
    category: 'transport',
    parameters: {}
  },
  {
    name: 'stop',
    description: 'Stop playback and reset to start',
    category: 'transport',
    parameters: {}
  },
  {
    name: 'pause',
    description: 'Pause playback at current position',
    category: 'transport',
    parameters: {}
  },
  {
    name: 'set_bpm',
    description: 'Set the tempo/BPM of the project',
    category: 'transport',
    parameters: {
      bpm: { type: 'number', description: 'Beats per minute (20-300)', required: true }
    }
  },
  {
    name: 'set_key',
    description: 'Set the musical key of the project',
    category: 'transport',
    parameters: {
      key: { type: 'string', description: 'Musical key (e.g., "C Major", "A Minor")', required: true }
    }
  },

  // PIANO ROLL TOOLS
  {
    name: 'add_note',
    description: 'Add a single note to the piano roll',
    category: 'piano_roll',
    parameters: {
      pitch: { type: 'number', description: 'MIDI note (0-127, 60=middle C)', required: true },
      start: { type: 'number', description: 'Start position in steps', required: true },
      duration: { type: 'number', description: 'Duration in steps', required: true },
      velocity: { type: 'number', description: 'Velocity 1-127', required: false }
    }
  },
  {
    name: 'add_chord',
    description: 'Add a chord (multiple notes at once)',
    category: 'piano_roll',
    parameters: {
      pitches: { type: 'array', description: 'Array of MIDI notes', required: true },
      start: { type: 'number', description: 'Start position in steps', required: true },
      duration: { type: 'number', description: 'Duration in steps', required: true }
    }
  },
  {
    name: 'add_melody',
    description: 'Add a sequence of notes as a melody',
    category: 'piano_roll',
    parameters: {
      notes: { type: 'array', description: 'Array of {pitch, start, duration} objects', required: true }
    }
  },
  {
    name: 'clear_track',
    description: 'Clear all notes from the current track',
    category: 'piano_roll',
    parameters: {}
  },

  // MIXER TOOLS
  {
    name: 'set_volume',
    description: 'Set volume of a track or master',
    category: 'mixer',
    parameters: {
      trackId: { type: 'string', description: 'Track ID or "master"', required: false },
      volume: { type: 'number', description: 'Volume 0-100', required: true }
    }
  },
  {
    name: 'set_pan',
    description: 'Set pan position of a track',
    category: 'mixer',
    parameters: {
      trackId: { type: 'string', description: 'Track ID', required: false },
      pan: { type: 'number', description: '-100 (left) to 100 (right)', required: true }
    }
  },
  {
    name: 'mute_track',
    description: 'Mute or unmute a track',
    category: 'mixer',
    parameters: {
      trackId: { type: 'string', description: 'Track ID', required: false },
      muted: { type: 'boolean', description: 'True to mute, false to unmute', required: true }
    }
  },
  {
    name: 'solo_track',
    description: 'Solo or unsolo a track',
    category: 'mixer',
    parameters: {
      trackId: { type: 'string', description: 'Track ID', required: false },
      solo: { type: 'boolean', description: 'True to solo, false to unsolo', required: true }
    }
  },

  // TRACK TOOLS
  {
    name: 'create_track',
    description: 'Create a new track',
    category: 'tracks',
    parameters: {
      name: { type: 'string', description: 'Track name', required: true },
      type: { type: 'string', description: 'Track type', required: true, enum: ['midi', 'audio', 'beat'] }
    }
  },
  {
    name: 'select_track',
    description: 'Select a track to work with',
    category: 'tracks',
    parameters: {
      trackId: { type: 'string', description: 'Track ID or name', required: true }
    }
  },
  {
    name: 'delete_track',
    description: 'Delete a track',
    category: 'tracks',
    parameters: {
      trackId: { type: 'string', description: 'Track ID', required: true }
    }
  },
  {
    name: 'rename_track',
    description: 'Rename a track',
    category: 'tracks',
    parameters: {
      trackId: { type: 'string', description: 'Track ID', required: false },
      name: { type: 'string', description: 'New name', required: true }
    }
  },

  // GENERATION TOOLS
  {
    name: 'generate_beat',
    description: 'Generate a beat pattern using AI',
    category: 'generation',
    parameters: {
      style: { type: 'string', description: 'Genre/style (trap, lofi, pop, etc.)', required: true },
      prompt: { type: 'string', description: 'Additional instructions', required: false }
    }
  },
  {
    name: 'generate_melody',
    description: 'Generate a melody using AI',
    category: 'generation',
    parameters: {
      style: { type: 'string', description: 'Genre/style', required: false },
      key: { type: 'string', description: 'Musical key', required: false },
      mood: { type: 'string', description: 'Mood (happy, sad, energetic, etc.)', required: false }
    }
  },
  {
    name: 'generate_chords',
    description: 'Generate a chord progression',
    category: 'generation',
    parameters: {
      style: { type: 'string', description: 'Genre/style', required: false },
      progression: { type: 'string', description: 'Progression type (e.g., "I-V-vi-IV")', required: false }
    }
  },
  {
    name: 'generate_audio',
    description: 'Generate audio using MusicGen (returns audio file, not editable)',
    category: 'generation',
    parameters: {
      prompt: { type: 'string', description: 'Description of audio to generate', required: true },
      duration: { type: 'number', description: 'Duration in seconds (max 30)', required: false }
    }
  },
  {
    name: 'generate_full_song',
    description: 'Generate a complete song with vocals using Suno',
    category: 'generation',
    parameters: {
      prompt: { type: 'string', description: 'Song description', required: true },
      style: { type: 'string', description: 'Genre/style', required: false },
      lyrics: { type: 'string', description: 'Lyrics for the song', required: false }
    }
  },
  {
    name: 'generate_lyrics',
    description: 'Generate lyrics for a song',
    category: 'generation',
    parameters: {
      theme: { type: 'string', description: 'Theme or topic', required: true },
      style: { type: 'string', description: 'Genre/style', required: false },
      mood: { type: 'string', description: 'Mood', required: false }
    }
  },

  // NAVIGATION TOOLS
  {
    name: 'go_to',
    description: 'Navigate to a specific tool/view in the studio',
    category: 'navigation',
    parameters: {
      view: { type: 'string', description: 'View to navigate to', required: true, 
        enum: ['piano_roll', 'mixer', 'beat_maker', 'lyrics', 'melody_composer', 'timeline', 'library'] }
    }
  },

  // ANALYSIS TOOLS
  {
    name: 'analyze_audio',
    description: 'Analyze audio to detect BPM, key, etc.',
    category: 'analysis',
    parameters: {
      audioUrl: { type: 'string', description: 'URL or path to audio file', required: true }
    }
  },
  {
    name: 'analyze_lyrics',
    description: 'Analyze lyrics for rhyme scheme, themes, quality',
    category: 'analysis',
    parameters: {
      lyrics: { type: 'string', description: 'Lyrics text to analyze', required: true }
    }
  },
  {
    name: 'separate_stems',
    description: 'Separate audio into stems (vocals, drums, bass, etc.)',
    category: 'analysis',
    parameters: {
      audioUrl: { type: 'string', description: 'URL or path to audio file', required: true },
      stems: { type: 'number', description: 'Number of stems (2, 4, or 5)', required: false }
    }
  },
  {
    name: 'get_status',
    description: 'Get current project status (BPM, key, tracks, etc.)',
    category: 'analysis',
    parameters: {}
  }
];

// ============================================
// TOOL EXECUTOR
// ============================================

export async function executeTool(
  toolName: string, 
  params: Record<string, any>, 
  context: ToolContext
): Promise<ToolResult> {
  const tool = ASTUTELY_TOOLS.find(t => t.name === toolName);
  
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  // Validate required parameters
  for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
    if (paramDef.required && !(paramName in params)) {
      return { success: false, error: `Missing required parameter: ${paramName}` };
    }
  }

  // Execute based on tool category and name
  switch (toolName) {
    // Transport
    case 'play':
      return { success: true, action: 'TRANSPORT_PLAY', message: 'Starting playback' };
    case 'stop':
      return { success: true, action: 'TRANSPORT_STOP', message: 'Stopping playback' };
    case 'pause':
      return { success: true, action: 'TRANSPORT_PAUSE', message: 'Pausing playback' };
    case 'set_bpm':
      const bpm = Math.max(20, Math.min(300, params.bpm));
      return { success: true, action: 'SET_BPM', data: { bpm }, message: `BPM set to ${bpm}` };
    case 'set_key':
      return { success: true, action: 'SET_KEY', data: { key: params.key }, message: `Key set to ${params.key}` };

    // Piano Roll
    case 'add_note':
      return { 
        success: true, 
        action: 'ADD_NOTE', 
        data: { 
          pitch: params.pitch, 
          start: params.start, 
          duration: params.duration, 
          velocity: params.velocity || 100 
        },
        message: `Added note ${params.pitch} at step ${params.start}`
      };
    case 'add_chord':
      return { 
        success: true, 
        action: 'ADD_CHORD', 
        data: { pitches: params.pitches, start: params.start, duration: params.duration },
        message: `Added chord with ${params.pitches.length} notes`
      };
    case 'add_melody':
      return { 
        success: true, 
        action: 'ADD_MELODY', 
        data: { notes: params.notes },
        message: `Added melody with ${params.notes.length} notes`
      };
    case 'clear_track':
      return { success: true, action: 'CLEAR_TRACK', message: 'Track cleared' };

    // Mixer
    case 'set_volume':
      return { 
        success: true, 
        action: 'SET_VOLUME', 
        data: { trackId: params.trackId || 'selected', volume: params.volume },
        message: `Volume set to ${params.volume}%`
      };
    case 'set_pan':
      return { 
        success: true, 
        action: 'SET_PAN', 
        data: { trackId: params.trackId || 'selected', pan: params.pan },
        message: `Pan set to ${params.pan}`
      };
    case 'mute_track':
      return { 
        success: true, 
        action: 'MUTE_TRACK', 
        data: { trackId: params.trackId || 'selected', muted: params.muted },
        message: params.muted ? 'Track muted' : 'Track unmuted'
      };
    case 'solo_track':
      return { 
        success: true, 
        action: 'SOLO_TRACK', 
        data: { trackId: params.trackId || 'selected', solo: params.solo },
        message: params.solo ? 'Track soloed' : 'Track unsoloed'
      };

    // Tracks
    case 'create_track':
      return { 
        success: true, 
        action: 'CREATE_TRACK', 
        data: { name: params.name, type: params.type },
        message: `Created ${params.type} track: ${params.name}`
      };
    case 'select_track':
      return { 
        success: true, 
        action: 'SELECT_TRACK', 
        data: { trackId: params.trackId },
        message: `Selected track: ${params.trackId}`
      };
    case 'delete_track':
      return { 
        success: true, 
        action: 'DELETE_TRACK', 
        data: { trackId: params.trackId },
        message: 'Track deleted'
      };
    case 'rename_track':
      return { 
        success: true, 
        action: 'RENAME_TRACK', 
        data: { trackId: params.trackId || 'selected', name: params.name },
        message: `Track renamed to: ${params.name}`
      };

    // Generation - these return action for frontend to call the appropriate API
    case 'generate_beat':
      return { 
        success: true, 
        action: 'GENERATE_BEAT', 
        data: { style: params.style, prompt: params.prompt },
        message: `Generating ${params.style} beat...`
      };
    case 'generate_melody':
      return { 
        success: true, 
        action: 'GENERATE_MELODY', 
        data: { style: params.style, key: params.key, mood: params.mood },
        message: 'Generating melody...'
      };
    case 'generate_chords':
      return { 
        success: true, 
        action: 'GENERATE_CHORDS', 
        data: { style: params.style, progression: params.progression },
        message: 'Generating chord progression...'
      };
    case 'generate_audio':
      return { 
        success: true, 
        action: 'GENERATE_AUDIO', 
        data: { prompt: params.prompt, duration: params.duration || 30 },
        message: 'Generating audio with MusicGen...'
      };
    case 'generate_full_song':
      return { 
        success: true, 
        action: 'GENERATE_FULL_SONG', 
        data: { prompt: params.prompt, style: params.style, lyrics: params.lyrics },
        message: 'Generating full song with Suno...'
      };
    case 'generate_lyrics':
      return { 
        success: true, 
        action: 'GENERATE_LYRICS', 
        data: { theme: params.theme, style: params.style, mood: params.mood },
        message: 'Generating lyrics...'
      };

    // Navigation
    case 'go_to':
      return { 
        success: true, 
        action: 'NAVIGATE', 
        data: { view: params.view },
        message: `Opening ${params.view.replace('_', ' ')}`
      };

    // Analysis
    case 'analyze_audio':
      return { 
        success: true, 
        action: 'ANALYZE_AUDIO', 
        data: { audioUrl: params.audioUrl },
        message: 'Analyzing audio...'
      };
    case 'analyze_lyrics':
      return { 
        success: true, 
        action: 'ANALYZE_LYRICS', 
        data: { lyrics: params.lyrics },
        message: 'Analyzing lyrics...'
      };
    case 'separate_stems':
      return { 
        success: true, 
        action: 'SEPARATE_STEMS', 
        data: { audioUrl: params.audioUrl, stems: params.stems || 2 },
        message: `Separating into ${params.stems || 2} stems...`
      };
    case 'get_status':
      return { 
        success: true, 
        action: 'GET_STATUS',
        data: context.projectState,
        message: `Project: ${context.projectState.bpm} BPM, ${context.projectState.key}, ${context.projectState.tracks.length} tracks`
      };

    default:
      return { success: false, error: `Tool not implemented: ${toolName}` };
  }
}

// ============================================
// GENERATE TOOL DESCRIPTIONS FOR AI
// ============================================

export function getToolDescriptionsForAI(): string {
  let description = `You have access to the following tools to control the DAW:\n\n`;
  
  const categories = ['transport', 'piano_roll', 'mixer', 'tracks', 'generation', 'navigation', 'analysis'];
  
  for (const category of categories) {
    const categoryTools = ASTUTELY_TOOLS.filter(t => t.category === category);
    if (categoryTools.length === 0) continue;
    
    description += `## ${category.toUpperCase().replace('_', ' ')}\n`;
    
    for (const tool of categoryTools) {
      description += `- **${tool.name}**: ${tool.description}\n`;
      const params = Object.entries(tool.parameters);
      if (params.length > 0) {
        description += `  Parameters: ${params.map(([name, def]) => `${name}${def.required ? '*' : ''}`).join(', ')}\n`;
      }
    }
    description += '\n';
  }
  
  return description;
}
