// client/src/components/ai/AstutelyChatbot.tsx
// ASTUTELY CHATBOT - The Single Source of Truth AI for CodedSwitch
// A conversational AI assistant that can chat, generate beats, analyze audio, and CONTROL THE ENTIRE DAW
// Connected to: TrackStore, Transport, SongWorkSession, StudioAudio, GlobalSystems

import { useState, useRef, useEffect, useLayoutEffect, useContext } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Minus, Sparkles, GripHorizontal, Zap, Music, Mic2, Wand2, Layers, Send, Play, Pause, Square, Volume2, Settings, Eye, Sliders } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { astutelyGenerate, astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import { useTransport } from '@/contexts/TransportContext';
import { useSongWorkSession } from '@/contexts/SongWorkSessionContext';
import { StudioAudioContext } from '@/pages/studio';
import { globalSystems, globalAI, globalAudio } from '@/lib/globalSystems';

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
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 520;

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
  { icon: Music, label: 'Generate Beat', action: 'beat', color: 'from-purple-500 to-pink-500' },
  { icon: Wand2, label: 'Create Melody', action: 'melody', color: 'from-orange-500 to-yellow-500' },
  { icon: Play, label: 'Play/Pause', action: 'play', color: 'from-green-500 to-emerald-500' },
  { icon: Eye, label: 'Project Status', action: 'status', color: 'from-blue-500 to-cyan-500' },
];

export default function AstutelyChatbot({ onClose, onBeatGenerated }: AstutelyChatbotProps) {
  // ═══════════════════════════════════════════════════════════════════════════
  // CENTRAL BRAIN CONNECTIONS - All contexts connected here
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Track Store - knows all tracks in the project
  const trackStore = useTrackStore();
  
  // Transport - controls playback (play/pause/stop, tempo, position)
  const transport = useTransport();
  
  // Song Work Session - current song session with analysis
  const songSession = useSongWorkSession();
  
  // Studio Audio Context - patterns, melodies, lyrics, uploaded songs
  const studioContext = useContext(StudioAudioContext);
  
  // Get current project status for AI context
  const getProjectStatus = (): ProjectStatus => {
    const totalNotes = trackStore.tracks.reduce((sum, track) => {
      const notes = (track as any).notes || (track as any).data?.notes || [];
      return sum + (Array.isArray(notes) ? notes.length : 0);
    }, 0);
    
    return {
      trackCount: trackStore.tracks.length,
      totalNotes,
      bpm: transport.tempo || studioContext.bpm || 120,
      key: studioContext.currentKey || 'C',
      isPlaying: transport.isPlaying || studioContext.isPlaying,
      currentPosition: transport.position || 0,
      hasUploadedSong: !!studioContext.currentUploadedSong,
      songName: studioContext.currentUploadedSong?.name || songSession.currentSession?.songName,
    };
  };

  const getSavedState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { x, y, isMinimized } = JSON.parse(saved);
        const clamped = clampPosition(x, y, DEFAULT_WIDTH, DEFAULT_HEIGHT);
        return { x: clamped.x, y: clamped.y, isMinimized };
      }
    } catch (e) {
      console.error('Failed to load Astutely state:', e);
    }
    return {
      x: window.innerWidth - DEFAULT_WIDTH - 24,
      y: 80,
      isMinimized: false,
    };
  };

  const savedState = getSavedState();
  const [isMinimized, setIsMinimized] = useState(savedState.isMinimized);
  const [position, setPosition] = useState({ x: savedState.x, y: savedState.y });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hey! I'm Astutely, your AI music production brain. 🧠🎵

I'm connected to your ENTIRE project and can:
• **Generate** beats, melodies, bass lines
• **Control** playback (play/pause/stop)
• **See** all your tracks and notes
• **Analyze** your project in real-time
• **Navigate** to any tool in the DAW

Try: "play", "stop", "status", "make a trap beat", or ask me anything!`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        x: position.x,
        y: position.y,
        isMinimized,
      }));
    } catch (e) {
      console.error('Failed to save Astutely state:', e);
    }
  }, [position, isMinimized]);

  useLayoutEffect(() => {
    const handleResize = () => {
      setPosition(prev => clampPosition(prev.x, prev.y, DEFAULT_WIDTH, DEFAULT_HEIGHT));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        DEFAULT_WIDTH,
        DEFAULT_HEIGHT
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
  }, [isDragging, dragOffset]);

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
    studioContext.setBpm(newBpm);
    return newBpm;
  };
  
  const handleNavigateToTool = (tool: string) => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: tool }));
    return tool;
  };
  
  const handleAddTrack = (trackData: any) => {
    trackStore.addTrack(trackData);
    return trackData.name || 'New Track';
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

Say "stop" or "pause" to stop playback.`
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
        const tracks = trackStore.tracks;
        
        let trackList = '';
        if (tracks.length > 0) {
          trackList = tracks.slice(0, 5).map((t: any, i: number) => 
            `  ${i + 1}. ${t.name || t.type || 'Track'}`
          ).join('\n');
          if (tracks.length > 5) {
            trackList += `\n  ... and ${tracks.length - 5} more`;
          }
        }
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: `📊 **Project Status**

🎵 **${status.trackCount}** tracks • **${status.totalNotes}** notes
🎹 Key: **${status.key}** • BPM: **${status.bpm}**
${status.isPlaying ? '▶️ Currently playing' : '⏹️ Stopped'} at beat ${status.currentPosition.toFixed(1)}
${status.hasUploadedSong ? `🎧 Song loaded: "${status.songName}"` : '📂 No song uploaded'}

${tracks.length > 0 ? `**Tracks:**\n${trackList}` : '💡 No tracks yet - say "make a beat" to get started!'}

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
            content: `You are Astutely, the central AI brain for CodedSwitch DAW. You're connected to the entire project and can control everything.

CURRENT PROJECT STATE:
- Tracks: ${status.trackCount}
- Total Notes: ${status.totalNotes}
- BPM: ${status.bpm}
- Key: ${status.key}
- Playing: ${status.isPlaying ? 'Yes' : 'No'}
- Position: Beat ${status.currentPosition.toFixed(1)}
${status.songName ? `- Song: "${status.songName}"` : ''}

You can help users with:
- Music production techniques and tips
- Beat making and composition advice
- Mixing and mastering guidance
- Music theory explanations
- Creative suggestions based on their project

COMMANDS YOU CAN TELL USERS TO USE:
- "play" / "stop" / "pause" - control playback
- "set bpm to [number]" - change tempo
- "make a [style] beat" - generate beats (trap, lofi, pop, phonk, edm, etc.)
- "status" - see project overview
- "go to [tool]" - navigate to piano roll, mixer, lyrics, etc.

Keep responses concise but helpful. Reference their current project when relevant.`,
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
        content: "I had trouble connecting. Try commands like 'play', 'stop', 'status', or 'make a beat'!",
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
        width: `${DEFAULT_WIDTH}px`,
        maxHeight: `${DEFAULT_HEIGHT}px`,
        zIndex: 9999,
      }}
    >
      <Card className="shadow-2xl border-2 border-orange-500/50 bg-gray-900 overflow-hidden">
        {/* Header - Draggable */}
        <CardHeader 
          className="pb-2 cursor-move"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
          onPointerDown={handlePointerDown}
        >
          <div className="flex items-center justify-center py-1">
            <GripHorizontal className="w-4 h-4 text-white/50" />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-300" />
              <span className="text-xl font-bold text-white">Astutely</span>
              <Badge variant="secondary" className="bg-green-500/30 text-green-300 text-xs">
                {transport.isPlaying ? '▶️' : '⏹️'} {transport.tempo || studioContext.bpm || 120} BPM
              </Badge>
            </div>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="h-7 w-7 p-0 text-white hover:bg-white/20"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0 text-white hover:bg-white/20"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex flex-col" style={{ height: '440px' }}>
          {/* Quick Actions */}
          <div className="p-3 border-b border-gray-700 bg-gray-800/50">
            <div className="grid grid-cols-4 gap-2">
              {quickActions.map(action => (
                <button
                  key={action.action}
                  onClick={() => handleQuickAction(action.action)}
                  disabled={isLoading}
                  className={`p-2 rounded-lg bg-gradient-to-br ${action.color} hover:scale-105 transition-all disabled:opacity-50`}
                  title={action.label}
                >
                  <action.icon className="w-5 h-5 mx-auto text-white" />
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-50 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-700 p-3 bg-gray-800/50">
            <div className="flex space-x-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything about music..."
                className="flex-1 min-h-[50px] max-h-[80px] resize-none bg-gray-900 border-gray-600"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
