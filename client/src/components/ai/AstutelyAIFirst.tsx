/**
 * Astutely AI-First Interface
 * 
 * USER-FIRST DESIGN:
 * - AI suggests actions
 * - User sees preview with [Accept] [Modify] [Cancel] buttons
 * - Only approved actions execute
 * 
 * This follows the Windsurf/Cursor model where AI assists but user controls.
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Send, Check, X, Edit2, Play, Square, Pause, 
  Music, Wand2, Volume2, Sliders, ChevronRight,
  Sparkles, Loader2, AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransport } from '@/contexts/TransportContext';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import { 
  chatWithAstutely, 
  executeApprovedSuggestion,
  SuggestedAction,
  ToolResult,
  ActionCallbacks,
  executeAction
} from '@/lib/astutelyActionHandler';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: SuggestedAction[];
  quickActions?: ToolResult[];
}

interface AstutelyAIFirstProps {
  onClose?: () => void;
  onNavigate?: (view: string) => void;
}

export default function AstutelyAIFirst({ onClose, onNavigate }: AstutelyAIFirstProps) {
  const { toast } = useToast();
  const transport = useTransport();
  const { tracks, addTrack } = useTrackStore();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hey! I'm Astutely. Tell me what you want to create and I'll suggest how to do it. You approve before anything happens.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<Map<string, SuggestedAction>>(new Map());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Build current project state for context
  const getProjectState = () => ({
    bpm: transport.tempo || 120,
    key: 'C Major', // TODO: Get from project
    timeSignature: '4/4',
    isPlaying: transport.isPlaying || false,
    currentPosition: transport.position || 0,
    tracks: tracks.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type || 'midi',
      volume: 80,
      pan: 0,
      muted: false,
      solo: false
    }))
  });
  
  // Action callbacks - connect to actual DAW functions
  const actionCallbacks: ActionCallbacks = {
    onPlay: () => transport.play?.(),
    onStop: () => transport.stop?.(),
    onPause: () => transport.pause?.(),
    onSetBpm: (bpm) => transport.setTempo?.(bpm),
    onNavigate: (view) => onNavigate?.(view),
    onShowMessage: (message, type) => {
      toast({
        title: type === 'error' ? 'Error' : type === 'info' ? 'Info' : 'Success',
        description: message,
        variant: type === 'error' ? 'destructive' : 'default'
      });
    },
    onCreateTrack: (name, type) => {
      addTrack({ name, type: type as any, notes: [], lengthBars: 4, startBar: 0 });
    },
    onGetStatus: () => getProjectState()
  };
  
  // Send message to Astutely
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Get conversation history for context
      const history = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));
      
      const response = await chatWithAstutely(
        userMessage.content,
        getProjectState(),
        history
      );
      
      // Execute quick actions immediately (play/stop/etc)
      if (response.quickActions?.length > 0) {
        for (const action of response.quickActions) {
          executeAction(action, actionCallbacks);
        }
      }
      
      // Store pending suggestions
      const newPending = new Map(pendingActions);
      response.suggestedActions?.forEach(action => {
        newPending.set(action.id, action);
      });
      setPendingActions(newPending);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        suggestions: response.suggestedActions,
        quickActions: response.quickActions
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get response from Astutely',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Approve a suggested action
  const handleApprove = async (suggestion: SuggestedAction) => {
    try {
      const result = await executeApprovedSuggestion(
        suggestion,
        getProjectState(),
        actionCallbacks
      );
      
      // Update suggestion status
      setPendingActions(prev => {
        const updated = new Map(prev);
        const action = updated.get(suggestion.id);
        if (action) {
          action.status = 'approved';
          updated.set(suggestion.id, action);
        }
        return updated;
      });
      
      // Update message to show approved
      setMessages(prev => prev.map(msg => {
        if (msg.suggestions?.some(s => s.id === suggestion.id)) {
          return {
            ...msg,
            suggestions: msg.suggestions.map(s => 
              s.id === suggestion.id ? { ...s, status: 'approved' as const } : s
            )
          };
        }
        return msg;
      }));
      
    } catch (error) {
      toast({
        title: 'Action Failed',
        description: 'Could not execute the action',
        variant: 'destructive'
      });
    }
  };
  
  // Reject a suggested action
  const handleReject = (suggestion: SuggestedAction) => {
    setPendingActions(prev => {
      const updated = new Map(prev);
      updated.delete(suggestion.id);
      return updated;
    });
    
    setMessages(prev => prev.map(msg => {
      if (msg.suggestions?.some(s => s.id === suggestion.id)) {
        return {
          ...msg,
          suggestions: msg.suggestions.map(s => 
            s.id === suggestion.id ? { ...s, status: 'rejected' as const } : s
          )
        };
      }
      return msg;
    }));
    
    toast({ title: 'Action cancelled' });
  };
  
  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Quick action buttons
  const quickActions = [
    { label: 'Play', icon: Play, command: 'play' },
    { label: 'Stop', icon: Square, command: 'stop' },
    { label: 'Make Beat', icon: Music, command: 'make a trap beat' },
    { label: 'Status', icon: Sliders, command: 'status' },
  ];
  
  return (
    <Card className="w-full h-full bg-gray-900/95 border-white/10 flex flex-col overflow-hidden">
      {/* Header */}
      <CardHeader className="p-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Astutely</h3>
              <p className="text-[10px] text-white/50">AI suggests • You approve</p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : ''}`}>
              {/* Message bubble */}
              <div className={`rounded-xl px-3 py-2 text-sm ${
                message.role === 'user' 
                  ? 'bg-purple-500/20 text-white border border-purple-500/30' 
                  : 'bg-white/5 text-white/90 border border-white/10'
              }`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              
              {/* Suggested Actions with Approval Buttons */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.suggestions.map((suggestion) => (
                    <div 
                      key={suggestion.id}
                      className={`rounded-lg border p-2 ${
                        suggestion.status === 'approved' 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : suggestion.status === 'rejected'
                          ? 'bg-red-500/10 border-red-500/30 opacity-50'
                          : 'bg-blue-500/10 border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          <span className="text-xs text-white/80 truncate">{suggestion.description}</span>
                        </div>
                        
                        {suggestion.status === 'pending' && (
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(suggestion)}
                              className="h-6 px-2 bg-green-500/20 hover:bg-green-500/30 text-green-400"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              <span className="text-[10px]">Accept</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReject(suggestion)}
                              className="h-6 px-2 bg-red-500/20 hover:bg-red-500/30 text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        
                        {suggestion.status === 'approved' && (
                          <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                            <Check className="w-3 h-3 mr-1" />Done
                          </Badge>
                        )}
                        
                        {suggestion.status === 'rejected' && (
                          <Badge className="bg-red-500/20 text-red-400 text-[10px]">
                            Cancelled
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Quick actions executed */}
              {message.quickActions && message.quickActions.length > 0 && (
                <div className="mt-1 flex gap-1 flex-wrap">
                  {message.quickActions.map((action, i) => (
                    <Badge key={i} className="bg-emerald-500/20 text-emerald-400 text-[10px]">
                      <Check className="w-3 h-3 mr-1" />{action.message}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/10">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </CardContent>
      
      {/* Quick Actions */}
      <div className="px-3 py-2 border-t border-white/5 flex gap-1 flex-wrap">
        {quickActions.map((action) => (
          <Button
            key={action.command}
            size="sm"
            variant="ghost"
            onClick={() => {
              setInput(action.command);
              setTimeout(() => handleSend(), 100);
            }}
            className="h-7 px-2 text-[10px] bg-white/5 hover:bg-white/10 text-white/60"
          >
            <action.icon className="w-3 h-3 mr-1" />
            {action.label}
          </Button>
        ))}
      </div>
      
      {/* Input */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me what you want to create..."
            className="flex-1 min-h-[40px] max-h-[100px] bg-white/5 border-white/10 text-white text-sm resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 p-0 bg-purple-500 hover:bg-purple-400"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-white/30 mt-1 text-center">
          AI suggests actions • You click Accept to execute
        </p>
      </div>
    </Card>
  );
}
