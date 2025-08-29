import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface AIMessage {
  id: string;
  content: string;
  timestamp: Date;
  source?: string;
}

interface AIMessageContextType {
  addMessage: (content: string, source?: string) => void;
  messages: AIMessage[];
  clearMessages: () => void;
}

const AIMessageContext = createContext<AIMessageContextType | undefined>(
  undefined,
);

export function AIMessageProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<AIMessage[]>([]);

  const addMessage = useCallback((content: string, source?: string) => {
    const message: AIMessage = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      timestamp: new Date(),
      source,
    };

    console.log("🎵 Adding AI message via context:", message.id, source);
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
