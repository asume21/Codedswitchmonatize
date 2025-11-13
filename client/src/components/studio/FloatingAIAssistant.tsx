import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Minus, MessageSquare, Sparkles, GripHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface FloatingAIAssistantProps {
  onClose?: () => void;
}

const STORAGE_KEY = 'floatingAIAssistant';
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 420;

// Clamp position to keep assistant visible within viewport
const clampPosition = (x: number, y: number, width: number, height: number) => {
  const padding = 24; // Minimum pixels visible
  const maxX = window.innerWidth - padding;
  const maxY = window.innerHeight - padding;
  
  return {
    x: Math.max(padding - width + padding, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY - padding)),
  };
};

export default function FloatingAIAssistant({ onClose }: FloatingAIAssistantProps) {
  // Load saved state from localStorage
  const getSavedState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { x, y, isMinimized } = JSON.parse(saved);
        const clamped = clampPosition(x, y, DEFAULT_WIDTH, DEFAULT_HEIGHT);
        return { x: clamped.x, y: clamped.y, isMinimized };
      }
    } catch (e) {
      console.error('Failed to load AI assistant state:', e);
    }
    // Default position: bottom-right for minimized, top-right for expanded
    return {
      x: window.innerWidth - DEFAULT_WIDTH - 24,
      y: 100,
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
      content: 'Hi! I\'m your AI music assistant powered by Grok. Ask me anything about music production, composition, or let me help you generate lyrics!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save state to localStorage whenever position or minimized changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        x: position.x,
        y: position.y,
        isMinimized,
      }));
    } catch (e) {
      console.error('Failed to save AI assistant state:', e);
    }
  }, [position, isMinimized]);

  // Re-clamp position on window resize
  useLayoutEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const clamped = clampPosition(prev.x, prev.y, DEFAULT_WIDTH, DEFAULT_HEIGHT);
        return clamped;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle dragging with pointer events (better than mouse events)
  const handlePointerDown = (e: React.PointerEvent) => {
    console.log('🖱️ Pointer down on drag handle!', { x: e.clientX, y: e.clientY });
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    console.log('✅ Dragging enabled, offset:', { x: e.clientX - position.x, y: e.clientY - position.y });
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
      
      console.log('🚀 Moving to:', newPos);
      setPosition(newPos);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, dragOffset]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call Grok AI for assistant help
      const response = await apiRequest('POST', '/api/ai/chat', {
        messages: [
          {
            role: 'system',
            content: 'You are a professional music production assistant. Help users with music theory, composition, production techniques, and creative advice. Be concise but helpful.',
          },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: input },
        ],
      });

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || 'I apologize, I encountered an error. Please try again.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get AI response. Please try again.',
        variant: 'destructive',
      });
      
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, I encountered an error connecting to the AI service. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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

  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 9999,
        }}
        onPointerDown={handlePointerDown}
        data-testid="ai-assistant-minimized"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-2xl cursor-move"
          size="lg"
        >
          <MessageSquare className="w-5 h-5 mr-2" />
          AI Assistant
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${DEFAULT_WIDTH}px`,
        maxHeight: `${DEFAULT_HEIGHT}px`,
        zIndex: 9999,
      }}
      data-testid="ai-assistant-floating"
    >
      <Card className="shadow-2xl border-2 border-purple-500/50 bg-gray-900">
        <CardHeader 
          className="pb-2 border-b border-gray-700 bg-gradient-to-r from-blue-900/50 to-purple-900/50 cursor-move"
          onPointerDown={handlePointerDown}
          data-testid="ai-assistant-drag-handle"
        >
          <div className="flex items-center justify-center py-1">
            <GripHorizontal className="w-4 h-4 text-gray-400/50" />
          </div>
          
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center pointer-events-none">
              <Sparkles className="w-4 h-4 mr-2 text-yellow-400" />
              AI Assistant
            </CardTitle>
            <div className="flex space-x-1" style={{ pointerEvents: 'auto' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="h-7 w-7 p-0"
                data-testid="button-minimize-ai"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0"
                data-testid="button-close-ai"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex flex-col cursor-default" style={{ height: '360px' }}>
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
                      ? 'bg-blue-600 text-white'
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
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-700 p-4 no-drag">
            <div className="flex space-x-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything about music production..."
                className="flex-1 min-h-[60px] max-h-[120px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
              >
                <i className="fas fa-paper-plane"></i>
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
