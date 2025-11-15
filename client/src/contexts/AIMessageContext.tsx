import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { Recommendation } from "../../../shared/schema";

export interface AIMessage {
  id: string;
  content: string;
  timestamp: Date;
  source?: string;
  recommendations?: Recommendation[];
}

interface AIMessageContextType {
  addMessage: (content: string, source?: string, recommendations?: Recommendation[]) => void;
  messages: AIMessage[];
  clearMessages: () => void;
}

const AIMessageContext = createContext<AIMessageContextType | undefined>(
  undefined,
);

export function AIMessageProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<AIMessage[]>([]);

  const addMessage = useCallback((content: string, source?: string, recommendations?: Recommendation[]) => {
    const message: AIMessage = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      timestamp: new Date(),
      source,
      recommendations,
    };

    console.log("🎵 Adding AI message via context:", message.id, source, recommendations ? `with ${recommendations.length} recommendations` : '');
    
    // Store in sessionStorage for persistence across navigation
    if (recommendations && recommendations.length > 0) {
      sessionStorage.setItem('lastAnalysisRecommendations', JSON.stringify({
        recommendations,
        timestamp: new Date().toISOString(),
      }));
      console.log('💾 Stored recommendations in sessionStorage');
    }
    
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <AIMessageContext.Provider value={{ addMessage, messages, clearMessages }}>
      {children}
    </AIMessageContext.Provider>
  );
}

export function useAIMessages() {
  const context = useContext(AIMessageContext);
  if (context === undefined) {
    throw new Error("useAIMessages must be used within an AIMessageProvider");
  }
  return context;
}
