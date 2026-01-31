// client/src/components/ai/AstutelyChatbot.tsx
// ASTUTELY CHATBOT - The Single Source of Truth AI for CodedSwitch
// A conversational AI assistant that can chat, generate beats, analyze audio, and CONTROL THE ENTIRE DAW
// Connected to: TrackStore, Transport, SongWorkSession, StudioAudio, GlobalSystems

import { useState, useRef, useEffect, useLayoutEffect, useContext, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Minus, Sparkles, GripHorizontal, Zap, Music, Mic2, Wand2, Layers, Send, Play, Pause, Square, Volume2, Settings, Eye, Sliders, Activity, Database, Cpu, Search, MoveDiagonal2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { astutelyGenerate, astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import { useTransport } from '@/contexts/TransportContext';
import { useSongWorkSession } from '@/contexts/SongWorkSessionContext';
import { StudioAudioContext } from '@/pages/studio';
import { globalSystems, globalAI, globalAudio } from '@/lib/globalSystems';
import { AstroHUD } from './AstroHUD';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: 'beat' | 'stems' | 'analyze' | 'melody' | 'play' | 'stop' | 'status' | null;
}

interface AstutelyChatbotProps {
  onClose?: () => void;
  onBeatGenerated?: (result: AstutelyResult) => void;
}

// Project status for AI context
interface ProjectStatus {
  trackCount: number;
  totalNotes: number;
  bpm: number;
  key: string;
  isPlaying: boolean;
  currentPosition: number;
  hasUploadedSong: boolean;
  songName?: string;
}

const STORAGE_KEY = 'astutelyChatbot';
const DEFAULT_WIDTH = 420; // Increased for HUD
const DEFAULT_HEIGHT = 650; // Increased for HUD
const MIN_WIDTH = 360;
const MAX_WIDTH = 860;
const MIN_HEIGHT = 420;
const MAX_HEIGHT = 960;

const clampPosition = (x: number, y: number, width: number, height: number) => {
  const padding = 24;
  const maxX = window.innerWidth - padding;
  const maxY = window.innerHeight - padding;
  
  return {
    x: Math.max(padding - width + padding, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY - padding)),
  };
};

const quickActions = [
  { icon: Music, label: 'Generate Beat', action: 'beat', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' },
  { icon: Wand2, label: 'Create Melody', action: 'melody', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
  { icon: Play, label: 'Play/Pause', action: 'play', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
  { icon: Eye, label: 'Project Status', action: 'status', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
];

export default function AstutelyChatbot({ onClose, onBeatGenerated }: AstutelyChatbotProps) {
  // ═══════════════════════════════════════════════════════════════════════════
  // CENTRAL BRAIN CONNECTIONS - All contexts connected here
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Track Store - knows all tracks in the project
  const { tracks, addTrack, saveTrackToServer } = useTrackStore();
  
  // Transport - controls playback (play/pause/stop, tempo, position)
  const transport = useTransport();
  
  // Song Work Session - current song session with analysis
  const songSession = useSongWorkSession();
  
  // Studio Audio Context - patterns, melodies, lyrics, uploaded songs
  const studioContext = useContext(StudioAudioContext);
  
  // Fetch uploaded songs from library
  const { data: uploadedSongs = [] } = useQuery<any[]>({
    queryKey: ['/api/songs'],
    initialData: [],
  });
  
  // Get current project status for AI context
  const getProjectStatus = (): ProjectStatus => {
    const totalNotes = tracks.reduce((sum: number, track: any) => {
      const notes = track.payload?.notes || [];
      return sum + (Array.isArray(notes) ? notes.length : 0);
    }, 0);
    
    return {
      trackCount: tracks.length,
      totalNotes,
      bpm: transport.tempo || studioContext?.bpm || 120,
      key: studioContext?.currentKey || 'C',
      isPlaying: transport.isPlaying || studioContext?.isPlaying || false,
      currentPosition: transport.position || 0,
      hasUploadedSong: !!studioContext?.currentUploadedSong,
      songName: studioContext?.currentUploadedSong?.name || songSession.currentSession?.songName,
    };
  };

  const getSavedState = () => {
    const fallback = {
      x: typeof window !== 'undefined' ? window.innerWidth - DEFAULT_WIDTH - 24 : 100,
      y: 80,
      isMinimized: false,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const width = Math.min(Math.max(parsed.width ?? DEFAULT_WIDTH, MIN_WIDTH), MAX_WIDTH);
        const height = Math.min(Math.max(parsed.height ?? DEFAULT_HEIGHT, MIN_HEIGHT), MAX_HEIGHT);
        const clamped = clampPosition(parsed.x ?? fallback.x, parsed.y ?? fallback.y, width, height);
        return {
          x: clamped.x,
          y: clamped.y,
          isMinimized: Boolean(parsed.isMinimized),
          width,
          height,
        };
      }
    } catch (e) {
      console.error('Failed to load Astutely state:', e);
    }

    return fallback;
  };

  const savedState = getSavedState();
  const [isMinimized, setIsMinimized] = useState(savedState.isMinimized);
  const [position, setPosition] = useState({ x: savedState.x, y: savedState.y });
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({ width: savedState.width, height: savedState.height });
  const [showResizeGuide, setShowResizeGuide] = useState(true);
  const resizeStateRef = useRef({ startX: 0, startY: 0, startWidth: DEFAULT_WIDTH, startHeight: DEFAULT_HEIGHT });
  const resizingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `CENTRAL AI BRAIN ONLINE. 🧠
Connected to all tracks and transport. Ready to generate, mix, and control.

Try: "play", "make a drill beat", or "analyze my project".`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        x: position.x,
        y: position.y,
        isMinimized,
        width: panelSize.width,
        height: panelSize.height,
      }));
    } catch (e) {
      console.error('Failed to save Astutely state:', e);
    }
  }, [position, isMinimized, panelSize.width, panelSize.height]);

  useLayoutEffect(() => {
    const handleResize = () => {
      setPosition(prev => clampPosition(prev.x, prev.y, panelSize.width, panelSize.height));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [panelSize.width, panelSize.height]);

  useEffect(() => {
    setPosition(prev => clampPosition(prev.x, prev.y, panelSize.width, panelSize.height));
  }, [panelSize.width, panelSize.height]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const newPos = clampPosition(
        e.clientX - dragOffset.x,
        e.clientY - dragOffset.y,
        panelSize.width,
        panelSize.height
      );
      setPosition(newPos);
    };

    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, dragOffset, panelSize.width, panelSize.height]);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const handleResizePointerMove = useCallback((event: PointerEvent) => {
    if (!resizingRef.current) return;
    const { startX, startY, startWidth, startHeight } = resizeStateRef.current;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    setPanelSize({
      width: clamp(startWidth + deltaX, MIN_WIDTH, MAX_WIDTH),
      height: clamp(startHeight + deltaY, MIN_HEIGHT, MAX_HEIGHT),
    });
  }, []);

  const handleResizePointerUp = useCallback(() => {
    document.removeEventListener('pointermove', handleResizePointerMove);
    document.removeEventListener('pointerup', handleResizePointerUp);
    resizingRef.current = false;
  }, [handleResizePointerMove]);

  const handleResizeStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelSize.width,
      startHeight: panelSize.height,
    };
    resizingRef.current = true;
    setShowResizeGuide(false);
    document.addEventListener('pointermove', handleResizePointerMove);
    document.addEventListener('pointerup', handleResizePointerUp);
  }, [panelSize.width, panelSize.height, handleResizePointerMove, handleResizePointerUp]);

  useEffect(() => () => {
    document.removeEventListener('pointermove', handleResizePointerMove);
    document.removeEventListener('pointerup', handleResizePointerUp);
  }, [handleResizePointerMove, handleResizePointerUp]);

  useEffect(() => {
    if (!showResizeGuide) return;
    const timer = setTimeout(() => setShowResizeGuide(false), 5000);
    return () => clearTimeout(timer);
  }, [showResizeGuide]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError(null);
    };

    recognition.onerror = (event: any) => {
      const message = event.error === 'not-allowed'
        ? 'Microphone access was blocked. Please allow it in your browser permissions.'
        : 'Voice capture failed. Please try again.';
      setSpeechError(message);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(prev => {
        const trimmed = prev.trim();
        if (!trimmed) return transcript;
        return `${trimmed} ${transcript}`.trim();
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleStartListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      toast({ title: 'Voice Input Not Supported', description: 'Your browser does not support speech recognition.' });
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (error) {
      setSpeechError('Unable to access your microphone. Please try again.');
    }
  };

  const handleStopListening = () => {
    recognitionRef.current?.stop();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DAW CONTROL FUNCTIONS - Astutely can control the entire DAW
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handlePlayPause = () => {
    if (transport.isPlaying) {
      transport.pause();
      return 'paused';
    } else {
      transport.play();
      return 'playing';
    }
  };
  
  const handleStop = () => {
    transport.stop();
    return 'stopped';
  };
  
  const handleSetTempo = (newBpm: number) => {
    transport.setTempo(newBpm);
    studioContext?.setBpm?.(newBpm);
    return newBpm;
  };
  
  const handleNavigateToTool = (tool: string) => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: tool }));
    return tool;
  };

  const handleQuickAction = async (action: string) => {
    const actionMessages: Record<string, string> = {
      beat: "Generate a beat for me",
      melody: "Create a melody for my project",
      play: transport.isPlaying ? "Pause playback" : "Start playback",
      status: "Show me my project status",
    };

    const userMessage: Message = {
      role: 'user',
      content: actionMessages[action] || action,
      timestamp: new Date(),
      action: action as any,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (action === 'beat') {
        const status = getProjectStatus();
        const result = await astutelyGenerate('Travis Scott rage');
        const notes = astutelyToNotes(result);
        
        // Update BPM to match generated beat
        handleSetTempo(result.bpm);
        
        if (onBeatGenerated) {
          onBeatGenerated(result);
        }

        // PERSISTENCE: Save all 4 generated tracks to database
        const trackTypes = ['drums', 'bass', 'chords', 'melody'];
        for (const type of trackTypes) {
          const typeNotes = notes.filter(n => n.trackType === type);
          if (typeNotes.length > 0) {
            const trackData: any = {
              id: `ai-${type}-${Date.now()}`,
              name: `Astutely ${type.charAt(0).toUpperCase() + type.slice(1)}`,
              kind: type === 'drums' ? 'beat' : 'midi',
              lengthBars: 4,
              startBar: 0,
              payload: {
                type: type === 'drums' ? 'beat' : 'midi',
                notes: typeNotes,
                bpm: result.bpm,
                source: 'astutely',
                color: type === 'drums' ? '#ef4444' : type === 'bass' ? '#f59e0b' : type === 'chords' ? '#8b5cf6' : '#3b82f6',
                volume: 0.8,
                pan: 0,
              }
            };
            addTrack(trackData);
            await saveTrackToServer(trackData);
          }
        }

        window.dispatchEvent(new CustomEvent('astutely:generated', { 
          detail: { notes, bpm: result.bpm } 
        }));

        const assistantMessage: Message = {
          role: 'assistant',
          content: `🔥 Beat generated and loaded!

**${result.style}** at **${result.bpm} BPM** in **${result.key}**

Added to your project:
• 🥁 Drums: ${notes.filter(n => n.trackType === 'drums').length} hits
• 🎸 Bass: ${notes.filter(n => n.trackType === 'bass').length} notes
• 🎹 Chords: ${notes.filter(n => n.trackType === 'chords').length} notes
• 🎵 Melody: ${notes.filter(n => n.trackType === 'melody').length} notes

Your project now has **${status.trackCount + 4} tracks**. Say "play" to hear it!`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        toast({ title: '🔥 Beat Generated!', description: `${result.style} at ${result.bpm} BPM` });

      } else if (action === 'play') {
        const state = handlePlayPause();
        const status = getProjectStatus();
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: state === 'playing' 
            ? `▶️ **Playing** at ${status.bpm} BPM in ${status.key}

${status.trackCount} tracks • ${status.totalNotes} notes
${status.songName ? `🎵 "${status.songName}"` : ''}
The song is now playing. Say "stop" or "pause" to stop playback.`
            : `⏸️ **Paused** at position ${status.currentPosition.toFixed(1)} beats

Say "play" to resume or "stop" to reset.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        toast({ 
          title: state === 'playing' ? '▶️ Playing' : '⏸️ Paused',
          description: `${status.bpm} BPM`
        });

      } else if (action === 'status') {
        const status = getProjectStatus();
        const projectTracks = tracks;
        
        let trackList = '';
        if (projectTracks.length > 0) {
          trackList = projectTracks.slice(0, 5).map((t: any, i: number) => 
            `  ${i + 1}. ${t.name || t.type || 'Track'}`
          ).join('\n');
          if (projectTracks.length > 5) {
            trackList += `\n  ... and ${projectTracks.length - 5} more`;
          }
        }
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: `📊 **Project Status**

🎵 **${status.trackCount}** tracks • **${status.totalNotes}** notes
🎹 Key: **${status.key}** • BPM: **${status.bpm}**
${status.isPlaying ? '▶️ Currently playing' : '⏹️ Stopped'} at beat ${status.currentPosition.toFixed(1)}
${status.hasUploadedSong ? `🎧 Song loaded: "${status.songName}"` : '📂 No song uploaded'}

${projectTracks.length > 0 ? `**Tracks:**\n${trackList}` : '💡 No tracks yet - say "make a beat" to get started!'}

What would you like to do?`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

      } else if (action === 'melody') {
        const result = await astutelyGenerate('Lo-fi chill');
        const notes = astutelyToNotes(result);
        const melodyNotes = notes.filter(n => n.trackType === 'melody');
        
        if (onBeatGenerated) {
          onBeatGenerated(result);
        }

        window.dispatchEvent(new CustomEvent('astutely:generated', { 
          detail: { notes, bpm: result.bpm } 
        }));

        const assistantMessage: Message = {
          role: 'assistant',
          content: `🎹 Melody created!

Generated a **${result.style}** melody with **${melodyNotes.length} notes** in **${result.key}**.

The melody is now in your Piano Roll. Say "play" to hear it!`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        toast({ title: '🎹 Melody Created!', description: `${melodyNotes.length} notes in ${result.key}` });
      }

    } catch (error) {
      console.error('Astutely action error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Oops! Something went wrong. Let me try again or try a different approach.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // ═══════════════════════════════════════════════════════════════════════════
      // INTELLIGENT COMMAND PARSING - Astutely understands natural language commands
      // ═══════════════════════════════════════════════════════════════════════════
      const lowerInput = currentInput.toLowerCase().trim();
      const status = getProjectStatus();
      
      // PLAYBACK COMMANDS
      if (lowerInput === 'play' || lowerInput === 'start' || lowerInput.includes('play it') || lowerInput.includes('start playing')) {
        if (!transport.isPlaying) {
          transport.play();
          const assistantMessage: Message = {
            role: 'assistant',
            content: `▶️ **Playing** at ${status.bpm} BPM in ${status.key}\n\n${status.trackCount} tracks • ${status.totalNotes} notes`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          toast({ title: '▶️ Playing', description: `${status.bpm} BPM` });
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `Already playing! Say "pause" or "stop" to control playback.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      if (lowerInput === 'pause' || lowerInput === 'stop' || lowerInput.includes('stop it') || lowerInput.includes('pause it')) {
        if (lowerInput === 'stop' || lowerInput.includes('stop')) {
          transport.stop();
          const assistantMessage: Message = {
            role: 'assistant',
            content: `⏹️ **Stopped** and reset to beginning.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          transport.pause();
          const assistantMessage: Message = {
            role: 'assistant',
            content: `⏸️ **Paused** at beat ${status.currentPosition.toFixed(1)}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      // BPM COMMANDS
      const bpmMatch = lowerInput.match(/(?:set\s+)?(?:bpm|tempo)\s*(?:to\s+)?(\d+)/i) || 
                       lowerInput.match(/(\d+)\s*bpm/i);
      if (bpmMatch) {
        const newBpm = parseInt(bpmMatch[1]);
        if (newBpm >= 40 && newBpm <= 300) {
          handleSetTempo(newBpm);
          const assistantMessage: Message = {
            role: 'assistant',
            content: `🎚️ **Tempo set to ${newBpm} BPM**\n\nYour project is now at ${newBpm} BPM.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          toast({ title: '🎚️ Tempo Changed', description: `${newBpm} BPM` });
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `BPM should be between 40 and 300. Try "set bpm to 120".`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      // SONG LIBRARY COMMANDS
      if (lowerInput.includes('list songs') || lowerInput.includes('show songs') || lowerInput.includes('my songs') || lowerInput.includes('song library')) {
        if (uploadedSongs.length === 0) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `📂 **Your Song Library is Empty**

No songs uploaded yet. Say "go to upload" to upload your first song!`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          const songList = uploadedSongs.slice(0, 10).map((song: any, i: number) => 
            `  ${i + 1}. **${song.title || song.name || 'Untitled'}**${song.artist ? ` - ${song.artist}` : ''}`
          ).join('\n');
          
          const assistantMessage: Message = {
            role: 'assistant',
            content: `🎵 **Your Song Library** (${uploadedSongs.length} songs)

${songList}
${uploadedSongs.length > 10 ? `\n... and ${uploadedSongs.length - 10} more` : ''}

Say "play [song name]" to load and play a song!`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      // PLAY UPLOADED SONG COMMAND
      if (lowerInput.includes('play ') && !lowerInput.includes('play it') && !lowerInput.includes('playback')) {
        const songQuery = lowerInput.replace(/^play\s+/i, '').trim();
        const matchedSong = uploadedSongs.find((song: any) => 
          (song.title || song.name || '').toLowerCase().includes(songQuery) ||
          (song.artist || '').toLowerCase().includes(songQuery)
        );
        
        if (matchedSong) {
          // Load the song into the studio context
          // Create audio element for the song
          const audio = new Audio();
          const songUrl = matchedSong.accessibleUrl || matchedSong.originalUrl || matchedSong.songURL || '';
          
          if (songUrl) {
            audio.src = songUrl;
            audio.load();
            
            if (studioContext?.setCurrentUploadedSong) {
              studioContext.setCurrentUploadedSong(matchedSong, audio);
            }
            
            const assistantMessage: Message = {
              role: 'assistant',
              content: `🎵 **Loaded: ${matchedSong.title || matchedSong.name || 'Untitled'}**
${matchedSong.artist ? `Artist: ${matchedSong.artist}\n` : ''}
The song is now loaded in your workspace. Say "play" to start playback!`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            toast({ 
              title: '🎵 Song Loaded', 
              description: matchedSong.title || matchedSong.name || 'Untitled'
            });
          } else {
            const assistantMessage: Message = {
              role: 'assistant',
              content: `❌ Couldn't load "${matchedSong.title || matchedSong.name}" - no audio URL found.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
          }
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `❌ Couldn't find a song matching "${songQuery}".

Say "list songs" to see your uploaded songs.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      // STATUS COMMAND
      if (lowerInput === 'status' || lowerInput.includes('project status') || lowerInput.includes('what do i have')) {
        await handleQuickAction('status');
        return;
      }
      
      // NAVIGATION COMMANDS
      if (lowerInput.includes('go to') || lowerInput.includes('open') || lowerInput.includes('show me')) {
        const toolMap: Record<string, string> = {
          'piano': 'piano-roll',
          'piano roll': 'piano-roll',
          'beat': 'beatmaker',
          'beats': 'beatmaker',
          'drum': 'beatmaker',
          'melody': 'melody',
          'mixer': 'mixer',
          'mix': 'mixer',
          'lyrics': 'lyrics',
          'lyric': 'lyrics',
          'upload': 'upload',
          'tools': 'tools',
          'audio': 'audio-tools',
        };
        
        for (const [keyword, tool] of Object.entries(toolMap)) {
          if (lowerInput.includes(keyword)) {
            handleNavigateToTool(tool);
            const assistantMessage: Message = {
              role: 'assistant',
              content: `🧭 Navigating to **${tool.replace('-', ' ')}**...`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            return;
          }
        }
      }
      
      // BEAT GENERATION
      if (lowerInput.includes('beat') || lowerInput.includes('drum') || lowerInput.includes('808') || 
          lowerInput.includes('make a') || lowerInput.includes('create a') || lowerInput.includes('generate')) {
        const style = lowerInput.includes('trap') ? 'Travis Scott rage' 
          : lowerInput.includes('chill') || lowerInput.includes('lofi') || lowerInput.includes('lo-fi') ? 'Lo-fi chill'
          : lowerInput.includes('pop') || lowerInput.includes('kpop') ? 'K-pop cute'
          : lowerInput.includes('phonk') ? 'Phonk drift'
          : lowerInput.includes('edm') || lowerInput.includes('future') ? 'Future bass'
          : lowerInput.includes('afro') ? 'Afrobeats bounce'
          : lowerInput.includes('latin') || lowerInput.includes('reggaeton') ? 'Latin trap'
          : lowerInput.includes('hyper') ? 'Hyperpop glitch'
          : lowerInput.includes('weeknd') || lowerInput.includes('dark') ? 'The Weeknd dark'
          : 'Drake smooth';
          
        const result = await astutelyGenerate(style);
        const notes = astutelyToNotes(result);
        
        handleSetTempo(result.bpm);
        
        if (onBeatGenerated) {
          onBeatGenerated(result);
        }

        window.dispatchEvent(new CustomEvent('astutely:generated', { 
          detail: { notes, bpm: result.bpm } 
        }));

        const assistantMessage: Message = {
          role: 'assistant',
          content: `🔥 Created a **${result.style}** beat!

**${result.bpm} BPM** in **${result.key}**
• 🥁 ${notes.filter(n => n.trackType === 'drums').length} drum hits
• 🎸 ${notes.filter(n => n.trackType === 'bass').length} bass notes
• 🎹 ${notes.filter(n => n.trackType === 'chords').length} chord notes
• 🎵 ${notes.filter(n => n.trackType === 'melody').length} melody notes

Say "play" to hear it!`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        toast({ title: '🔥 Beat Generated!', description: `${result.style} at ${result.bpm} BPM` });
        return;
      }

      // GENERAL CHAT - Use AI with full project context
      const response = await apiRequest('POST', '/api/ai/chat', {
        messages: [
          {
            role: 'system',
            content: `You are Astutely, the AI assistant for CodedSwitch DAW.

IMPORTANT: Do NOT introduce yourself or say "Hey, I'm Astutely" in every response. The user already knows who you are. Just answer their question directly and naturally, like a helpful friend.

CURRENT PROJECT STATE:
- Tracks: ${status.trackCount}
- Total Notes: ${status.totalNotes}
- BPM: ${status.bpm}
- Key: ${status.key}
- Playing: ${status.isPlaying ? 'Yes' : 'No'}
- Position: Beat ${status.currentPosition.toFixed(1)}
${status.songName ? `- Song: "${status.songName}"` : ''}

You help with: music production, beat making, mixing, mastering, music theory, and creative suggestions.

COMMANDS users can use:
- "play" / "stop" / "pause" - playback
- "set bpm to [number]" - tempo
- "make a [style] beat" - generate beats
- "status" - project overview
- "go to [tool]" - navigation

Be concise, friendly, and direct. Skip formalities.`,
          },
          ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: currentInput },
        ],
      });

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || "I'm here to help! Try commands like 'play', 'make a trap beat', or 'status'.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Astutely chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "Oops! The server didn't respond. Try 'play', 'stop', 'status', or 'make a beat' instead!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Minimized state - floating button
  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 9999,
        }}
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-14 px-6 font-bold text-white shadow-2xl hover:scale-105 transition-all"
          style={{ 
            background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
            boxShadow: '0 0 30px rgba(245, 158, 11, 0.5)'
          }}
        >
          <Sparkles className="w-6 h-6 mr-2" />
          Astutely
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${panelSize.width}px`,
        height: `${panelSize.height}px`,
        zIndex: 9999,
      }}
      className="animate-in fade-in zoom-in duration-300"
    >
      <div className="relative group">
        {/* Holographic Border Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse" />
        
        <Card className="relative shadow-2xl border border-cyan-500/50 bg-black/80 backdrop-blur-3xl rounded-xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)]">
          {/* Scanline Effect Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]" />
          
          {/* Header - Draggable */}
          <CardHeader 
            className="pb-2 cursor-move border-b border-cyan-500/30 bg-cyan-950/40 backdrop-blur-md"
            onPointerDown={handlePointerDown}
          >
            <div className="flex items-center justify-center py-0.5 opacity-30">
              <div className="w-12 h-1 bg-cyan-500 rounded-full" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative group/brain">
                  <div className="absolute -inset-2 bg-cyan-500/20 rounded-full blur-xl group-hover/brain:bg-cyan-500/40 transition-all duration-500" />
                  <Cpu className="w-7 h-7 text-cyan-400 relative z-10 animate-[pulse_2s_infinite]" />
                  <Sparkles className="w-3 h-3 text-white absolute -top-1 -right-1 z-20 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 uppercase tracking-[0.2em] leading-none">
                    Astutely Core
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Neural Link Active</span>
                    </div>
                    <Activity className="w-3 h-3 text-cyan-500/50 animate-pulse" />
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(true)}
                  className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-500/20"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 text-cyan-400 hover:bg-red-500/20 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex flex-col" style={{ height: `${Math.max(panelSize.height - 85, MIN_HEIGHT - 85)}px` }}>
            {/* HOLOGRAPHIC ASTRO-HUD */}
            <div className="p-5 bg-gradient-to-b from-cyan-950/30 to-transparent relative overflow-hidden group/hud">
              {/* Dynamic Grid Background for HUD area */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(6,182,212,0.4) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
              
              <div className="flex justify-between items-end mb-3 px-1 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400/80 uppercase tracking-[0.15em]">
                    <Database className="w-3 h-3 animate-[bounce_2s_infinite]" /> Matrix Status
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-cyan-500/60 uppercase font-black">Streams</span>
                      <span className="text-lg font-black text-white leading-none tracking-tighter">{getProjectStatus().trackCount}</span>
                    </div>
                    <div className="w-px h-6 bg-cyan-500/20 self-end mb-1" />
                    <div className="flex flex-col">
                      <span className="text-[8px] text-cyan-500/60 uppercase font-black">Elements</span>
                      <span className="text-lg font-black text-white leading-none tracking-tighter">{getProjectStatus().totalNotes}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-2 justify-end text-[10px] font-bold text-cyan-400/80 uppercase tracking-[0.15em]">
                    Temporal Sync <Cpu className="w-3 h-3 text-cyan-400" />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-cyan-500/60 uppercase font-black">Velocity</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-cyan-400 leading-none tabular-nums tracking-tighter">{getProjectStatus().bpm}</span>
                      <span className="text-[9px] font-black text-cyan-500/40">BPM</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="relative cursor-crosshair" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const newPos = (x / rect.width) * 16;
                transport.seek(newPos);
              }}>
                <AstroHUD 
                  tracks={tracks.map(t => ({
                    id: t.id,
                    name: t.name || 'Unnamed Track',
                    color: t.payload?.color || '#3b82f6',
                    notes: (t.payload?.notes || []).map(n => ({
                      ...n,
                      id: n.id || `note-${Math.random().toString(36).substr(2, 9)}`
                    })),
                    muted: false, // Default for HUD
                    volume: (t.payload?.volume || 0.8) * 100,
                    instrument: t.payload?.instrument || 'piano'
                  })) as any}
                  currentStep={Math.floor(transport.position * 4)}
                  totalSteps={64}
                  isPlaying={transport.isPlaying}
                />
              </div>

              {/* HOLOGRAPHIC TRANSPORT CONTROLS */}
              <div className="mt-5 flex items-center justify-between bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2.5 backdrop-blur-xl relative z-10 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => transport.stop()}
                    className="h-10 w-10 p-0 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-all active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current opacity-80" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handlePlayPause}
                    className={`h-10 w-14 p-0 border border-cyan-400/40 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95 ${
                      transport.isPlaying 
                        ? 'bg-cyan-500/30 text-white animate-[pulse_1.5s_infinite] border-cyan-300' 
                        : 'text-cyan-400 hover:bg-cyan-500/20'
                    }`}
                  >
                    {transport.isPlaying 
                      ? <Pause className="w-5 h-5 fill-current" /> 
                      : <Play className="w-5 h-5 fill-current ml-0.5" />
                    }
                  </Button>
                </div>

                <div className="flex-1 px-4 flex flex-col gap-1">
                  <div className="flex justify-between text-[8px] font-black text-cyan-500/60 uppercase tracking-widest">
                    <span>Signal Strength</span>
                    <span>{transport.isPlaying ? 'Transmitting' : 'Standby'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-cyan-950/60 rounded-full overflow-hidden border border-cyan-500/10">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-300 transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                      style={{ width: transport.isPlaying ? '100%' : '15%' }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <div className="text-[8px] text-cyan-500/40 font-mono uppercase leading-none">Sync</div>
                    <Badge variant="outline" className="text-[8px] h-3 px-1 border-cyan-500/20 text-cyan-400/60 font-mono uppercase">LOCKED</Badge>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-cyan-500/30 flex items-center justify-center relative overflow-hidden group/knob">
                    <div className="absolute inset-0 bg-cyan-500/10 scale-0 group-hover/hud:scale-100 transition-transform" />
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400 z-10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Track & Song Library Display */}
            <div className="px-4 py-3 border-b border-cyan-500/10 bg-black/20">
              {/* Tracks Section */}
              {tracks.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-400/80 uppercase tracking-wider">Active Tracks ({tracks.length})</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20">
                    {tracks.slice(0, 5).map((track: any, i: number) => (
                      <div 
                        key={track.id}
                        className="flex items-center gap-2 px-2 py-1 rounded bg-cyan-950/20 border border-cyan-500/10 hover:border-cyan-500/30 transition-colors"
                      >
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: track.payload?.color || '#3b82f6' }}
                        />
                        <span className="text-[10px] text-white/80 flex-1 truncate">
                          {track.name || `Track ${i + 1}`}
                        </span>
                        <span className="text-[9px] text-cyan-500/60 font-mono">
                          {track.payload?.notes?.length || 0} notes
                        </span>
                      </div>
                    ))}
                    {tracks.length > 5 && (
                      <div className="text-[9px] text-cyan-500/40 text-center py-1">
                        +{tracks.length - 5} more tracks
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Uploaded Songs Section */}
              {uploadedSongs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] font-bold text-purple-400/80 uppercase tracking-wider">Song Library ({uploadedSongs.length})</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500/20">
                    {uploadedSongs.slice(0, 5).map((song: any, i: number) => (
                      <button
                        key={song.id}
                        onClick={() => {
                          const audio = new Audio();
                          const songUrl = song.accessibleUrl || song.originalUrl || song.songURL || '';
                          if (songUrl) {
                            audio.src = songUrl;
                            audio.load();
                            studioContext?.setCurrentUploadedSong?.(song, audio);
                            toast({ 
                              title: '🎵 Song Loaded', 
                              description: song.title || song.name || 'Untitled'
                            });
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded bg-purple-950/20 border border-purple-500/10 hover:border-purple-500/30 hover:bg-purple-950/30 transition-colors text-left"
                      >
                        <Play className="w-2.5 h-2.5 text-purple-400/60" />
                        <span className="text-[10px] text-white/80 flex-1 truncate">
                          {song.title || song.name || 'Untitled'}
                        </span>
                        {song.artist && (
                          <span className="text-[9px] text-purple-500/60 truncate max-w-[80px]">
                            {song.artist}
                          </span>
                        )}
                      </button>
                    ))}
                    {uploadedSongs.length > 5 && (
                      <div className="text-[9px] text-purple-500/40 text-center py-1">
                        +{uploadedSongs.length - 5} more songs
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {tracks.length === 0 && uploadedSongs.length === 0 && (
                <div className="text-center py-2">
                  <span className="text-[10px] text-cyan-500/40">No tracks or songs loaded yet</span>
                </div>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="px-4 py-2 flex gap-2 border-b border-cyan-500/10 bg-black/20">
              {quickActions.map(action => (
                <button
                  key={action.action}
                  onClick={() => handleQuickAction(action.action)}
                  disabled={isLoading}
                  className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 disabled:opacity-50 bg-black/40 border-cyan-500/20 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10 shadow-lg`}
                >
                  <action.icon className="w-4 h-4 mb-1" />
                  <span className="text-[9px] uppercase font-bold tracking-tighter">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Chat Interface */}
            <div className="flex-none overflow-hidden flex flex-col bg-black/40" style={{ maxHeight: 240 }}>
              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/20 border-b border-cyan-500/10"
                style={{ minHeight: 140, maxHeight: 200 }}
              >
                {messages.length === 0 && (
                  <div className="text-xs text-cyan-300/60 bg-white/5 border border-cyan-500/20 rounded-lg p-3">
                    Astutely is ready. Ask a question or type a command.
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 relative group/msg ${
                        msg.role === 'user'
                          ? 'bg-cyan-600/20 text-cyan-100 border border-cyan-500/30'
                          : 'bg-white/5 text-gray-200 border border-white/10'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="absolute -left-1 -top-1 w-2 h-2 border-t border-l border-cyan-500" />
                      )}
                      <p className="text-xs leading-relaxed font-medium">{msg.content}</p>
                      <div className="mt-2 flex items-center justify-between opacity-30 group-hover/msg:opacity-100 transition-opacity">
                        <span className="text-[9px] font-mono">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === 'assistant' && (
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-cyan-500/30 rounded-full" />
                            <div className="w-1.5 h-1.5 bg-cyan-500/30 rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <div className="flex space-x-2">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Control Center */}
              <div className="p-4 border-t border-cyan-500/20 bg-cyan-500/5">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-cyan-400/10 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                  <div className="relative flex items-end gap-2">
                    <div className="flex-1 bg-black/60 rounded-lg border border-cyan-500/30 overflow-hidden focus-within:border-cyan-400 transition-colors">
                      <div className="px-2 pt-1 flex items-center gap-1.5 text-[8px] text-cyan-500 font-mono uppercase tracking-widest">
                        <Search className="w-2.5 h-2.5" /> Input Command
                      </div>
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type command or ask Astutely..."
                        className="w-full bg-transparent border-none text-xs text-white placeholder:text-cyan-900 focus:ring-0 min-h-[50px] max-h-[120px] resize-none px-3 pb-2"
                        disabled={isLoading}
                      />
                      {speechError && (
                        <div className="px-3 pb-2 text-[10px] text-red-400/80">
                          {speechError}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={isListening ? handleStopListening : handleStartListening}
                      disabled={!speechSupported || isLoading}
                      className={`h-[50px] w-[50px] border border-cyan-500/30 bg-black/60 text-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95 ${!speechSupported ? 'opacity-40 cursor-not-allowed' : ''} ${isListening ? 'shadow-[0_0_15px_rgba(34,211,238,0.6)] bg-cyan-500/30 text-white' : ''}`}
                    >
                      <Mic2 className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      className="h-[50px] w-[50px] bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-90"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <div className="absolute bottom-3 right-3 flex items-end gap-2">
            {showResizeGuide && (
              <div className="px-3 py-2 rounded-lg bg-black/60 text-white text-xs border border-cyan-500/40 shadow-xl">
                Drag to resize
              </div>
            )}
            <button
              type="button"
              aria-label="Resize Astutely core panel"
              onPointerDown={handleResizeStart}
              className="h-10 w-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-se-resize"
            >
              <MoveDiagonal2 className="w-5 h-5" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
