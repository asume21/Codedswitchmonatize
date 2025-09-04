import { useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/hooks/use-audio";
import { useAIMessages } from "@/contexts/AIMessageContext";
import { StudioAudioContext } from "@/pages/studio";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import type { Song } from "@shared/schema";
import { Upload, Music, Play, Pause, RotateCcw, Volume2 } from "lucide-react";
import { AIProviderSelector } from "@/components/ui/ai-provider-selector";

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
}

interface UploadContext {
  name?: string;
  fileSize?: number;
  format?: string;
  mimeType?: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content: "Hello! I'm your AI assistant for CodedSwitch Studio. I can help you with:\n• Code translation and optimization\n• Music composition suggestions\n• Beat pattern generation\n• Vulnerability scanning insights\n• Lyric writing assistance\n• Song analysis and insights\n\nUpload a song below to get AI-powered analysis, or ask me anything!",
      timestamp: new Date(Date.now() - 120000),
    },
  ]);

  // Song uploader state
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [uploadContext, setUploadContext] = useState<UploadContext>({});
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aiProvider, setAiProvider] = useState("grok");

  const { messages: aiMessages, addMessage } = useAIMessages();
  const studioContext = useContext(StudioAudioContext);

  // Add AI messages from context to local messages
  useEffect(() => {
    if (aiMessages.length > 0) {
      const latestAIMessage = aiMessages[aiMessages.length - 1];

      
      setMessages(prev => {
        const exists = prev.some(msg => msg.id === latestAIMessage.id);
        if (!exists) {
          const newMessage: Message = {
            id: latestAIMessage.id,
            type: "ai",
            content: latestAIMessage.content,
            timestamp: latestAIMessage.timestamp,
          };

          return [...prev, newMessage];
        }
        return prev;
      });
    }
  }, [aiMessages]);
  const [inputMessage, setInputMessage] = useState("");

  const { toast } = useToast();
  const { initialize, isInitialized } = useAudio();

  // Load uploaded songs
  const { data: songs, isLoading: songsLoading } = useQuery<Song[]>({
    queryKey: ['/api/songs'],
    initialData: [],
  });

  // Song upload mutation
  const uploadSongMutation = useMutation({
    mutationFn: async (songData: any) => {
      const response = await apiRequest("POST", "/api/songs/upload", songData);
      return response.json();
    },
    onSuccess: (newSong: Song) => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      setUploadContext({});
      toast({
        title: "Song Uploaded",
        description: `${newSong.name} has been added to your library!`,
      });

      // Automatically trigger analysis after upload
      analyzeSong(newSong);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to save your song. Please try again.",
        variant: "destructive",
      });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (data: { message: string; context?: string; aiProvider: string }) => {
      const response = await apiRequest("POST", "/api/assistant/chat", data);
      return response.json();
    },
    onSuccess: (data) => {
      const aiMessage: Message = {
        id: Date.now().toString(),
        type: "ai",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    },
    onError: () => {
      toast({
        title: "Failed to Send Message",
        description: "Unable to get AI response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    chatMutation.mutate({
      message: inputMessage,
      context: "CodeTune Studio",
      aiProvider,
    });

    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Song upload and analysis functions
  const getUploadParameters = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload", {});
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error", temporary: false }));
        console.error('Upload URL generation failed:', errorData);
        
        if (response.status === 503 || errorData.temporary) {
          const retryAfter = errorData.retryAfter || 300;
          const minutes = Math.ceil(retryAfter / 60);
          
          toast({
            title: "Upload Service Temporarily Down",
            description: `The file upload service is temporarily unavailable. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
            variant: "destructive",
            duration: 8000,
          });
          
          throw new Error(`Service temporarily unavailable (retry in ${minutes} minutes)`);
        }
        
        toast({
          title: "Upload Service Error",
          description: "Unable to connect to upload service. Please refresh the page and try again.",
          variant: "destructive",
        });
        
        throw new Error(errorData.error || "Failed to generate upload URL");
      }
      
      const data = await response.json();
      
      if (!data.uploadURL) {
        toast({
          title: "Upload Configuration Error",
          description: "Server did not provide upload URL. Please contact support if this persists.",
          variant: "destructive",
        });
        throw new Error("No upload URL received from server");
      }
      
      console.log("✅ Upload URL received successfully");
      
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error('Upload parameters error:', error);
      
      if (!(error instanceof Error && error.message.includes("temporarily unavailable"))) {
        toast({
          title: "Upload Setup Failed",
          description: "Unable to initialize file upload. Please refresh and try again.",
          variant: "destructive",
        });
      }
      
      throw error;
    }
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    console.log('🎵 Upload complete result:', result);

    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const songURL = uploadedFile.uploadURL;
      
      console.log('🎵 Uploaded file details:', {
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.type,
        uploadURL: songURL
      });

      const fileName = uploadedFile.name || `Uploaded Song ${Date.now()}`;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      const fileSize = uploadedFile.size || 0;
      const mimeType = uploadedFile.type || '';
      
      let format = fileExtension;
      if (mimeType.includes('audio/')) {
        format = mimeType.split('/')[1] || fileExtension;
      }
      
      const fileInfo = {
        name: fileName,
        fileSize: fileSize,
        format: format === 'unknown' ? (mimeType || 'audio') : format,
        mimeType: mimeType
      };
      
      console.log('🎵 Processed file info:', fileInfo);
      setUploadContext(fileInfo);
      
      if (songURL) {
        const songData = {
          songURL,
          name: fileInfo.name,
          fileSize: fileInfo.fileSize,
          format: fileInfo.format,
          mimeType: fileInfo.mimeType
        };
        
        console.log('🎵 Sending song data:', songData);
        uploadSongMutation.mutate(songData);
      }
    }
  };

  const analyzeSong = async (song: Song) => {
    try {
      const response = await apiRequest("POST", "/api/songs/analyze", {
        songId: song.id,
        songURL: song.originalUrl,
        songName: song.name
      });
      const analysis = await response.json();
      
      toast({
        title: "Song Analysis Complete",
        description: `AI analyzed ${song.name} successfully!`,
      });

      // Store analysis in studio context for other tools to use
      studioContext.setCurrentCodeMusic?.({
        ...analysis,
        source: 'uploaded_song',
        originalSong: song
      });

      // Add analysis as AI message
      const analysisMessage = `📊 **Song Analysis Complete: ${song.name}**

🎵 **Musical Properties:**
• BPM: ${analysis.estimatedBPM}
• Key: ${analysis.keySignature} 
• Genre: ${analysis.genre}
• Mood: ${analysis.mood}

🎼 **Song Structure:**
${Object.entries(analysis.structure).map(([section, timing]) => `• ${section}: ${timing}`).join('\n')}

🎺 **Instruments Detected:**
${analysis.instruments.join(', ')}

🤖 **AI Analysis Notes:**
${analysis.analysis_notes}

This analysis has been saved and can be used with other studio tools for remixing, layering, and composition inspiration!`;

      const aiMessage: Message = {
        id: Date.now().toString(),
        type: "ai",
        content: analysisMessage,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      toast({
        title: "Analysis Failed", 
        description: "Could not analyze the song. Please try again.",
        variant: "destructive",
      });
    }
  };

  const playSong = async (song: Song) => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }

    try {
      const accessibleURL = song.accessibleUrl;
      console.log('🎵 Using accessible URL:', accessibleURL);
      
      const audio = new Audio();
      
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        toast({
          title: "Playback Error",
          description: `Cannot play ${song.name}`,
          variant: "destructive",
        });
        setIsPlaying(false);
        setCurrentSong(null);
      });

      audio.addEventListener('loadedmetadata', () => {
        console.log(`🎵 Song loaded: ${song.name}, duration: ${audio.duration}s`);
        setDuration(audio.duration);
      });
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentSong(null);
        setCurrentTime(0);
      });

      audio.src = accessibleURL;
      audio.load();
      
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          resolve(void 0);
        };
        
        const onError = (e: Event) => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          reject(new Error('Audio loading failed'));
        };
        
        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('error', onError);
      });

      await audio.play();
      setAudioElement(audio);
      setCurrentSong(song);
      setIsPlaying(true);
      
      toast({
        title: "Now Playing",
        description: `Playing ${song.name}`,
      });
      
    } catch (error) {
      console.error('Audio playback error:', error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: "Playback Failed",
        description: `Cannot play ${song.name}. The file may be corrupted or unsupported.`,
        variant: "destructive",
      });
      setIsPlaying(false);
      setCurrentSong(null);
    }
  };

  const stopSong = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentSong(null);
    setCurrentTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  const quickActions = [
    { icon: "fas fa-magic", label: "Generate Beat Pattern", action: "Generate a hip-hop beat pattern for me" },
    { icon: "fas fa-code", label: "Optimize My Code", action: "Help me optimize this JavaScript code for better performance" },
    { icon: "fas fa-music", label: "Compose Melody", action: "Compose a melody in C major scale" },
    { icon: "fas fa-shield-alt", label: "Security Analysis", action: "Analyze my code for security vulnerabilities" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold">AI Music & Code Assistant</h2>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => {
                initialize();
                toast({ title: "Audio Initialized", description: "The audio engine has started." });
              }}
              className="bg-studio-accent hover:bg-blue-500"
              disabled={isInitialized}
            >
              <i className="fas fa-power-off mr-2"></i>
              {isInitialized ? 'Audio Ready' : 'Start Audio'}
            </Button>
          </div>
        </div>

        {/* Song Upload Section */}
        <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Song for AI Analysis
            </h3>
            <div className="text-xs text-gray-400">
              Supported: MP3, WAV, M4A, OGG (Max 50MB)
            </div>
          </div>

          <div className="mb-3">
            <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
          </div>

          <div className="flex items-center space-x-4">
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={50485760} // 50MB max for audio files
              onGetUploadParameters={getUploadParameters}
              onComplete={handleUploadComplete}
              buttonClassName="bg-studio-accent hover:bg-blue-500"
            >
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Audio File
              </div>
            </ObjectUploader>

            {uploadSongMutation.isPending && (
              <div className="flex items-center gap-2 text-blue-400">
                <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                <span className="text-sm">Processing upload...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="flex flex-col space-y-6">
          {/* Chat Interface */}
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 bg-studio-panel border border-gray-600 rounded-lg p-4 mb-4">
              <div className="space-y-4">
                {messages.map((message) => {

                  return (
                  <div key={message.id} className={`flex space-x-3 ${message.type === "user" ? "justify-end" : ""}`}>
                    {message.type === "ai" && (
                      <div className="w-8 h-8 bg-gradient-to-br from-studio-accent to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-robot text-white text-sm"></i>
                      </div>
                    )}

                    <div className={`flex-1 ${message.type === "user" ? "max-w-md" : ""}`}>
                      <div className={`rounded-lg p-3 ${
                        message.type === "user"
                          ? "bg-studio-accent text-white"
                          : "bg-gray-700"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <div className={`text-xs text-gray-400 mt-1 ${message.type === "user" ? "text-right" : ""}`}>
                        {message.type === "ai" ? "AI Assistant" : "You"} • {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>

                    {message.type === "user" && (
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">CT</span>
                      </div>
                    )}
                  </div>
                )})}

                {chatMutation.isPending && (
                  <div className="flex space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-studio-accent to-blue-500 rounded-full flex items-center justify-center">
                      <i className="fas fa-robot text-white text-sm"></i>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask me anything about music production or coding..."
                  className="bg-studio-panel border-gray-600 pr-12"
                  disabled={chatMutation.isPending}
                />
                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-studio-accent">
                  <i className="fas fa-microphone"></i>
                </button>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={chatMutation.isPending || !inputMessage.trim()}
                className="bg-studio-accent hover:bg-blue-500"
              >
                <i className="fas fa-paper-plane"></i>
              </Button>
            </div>
          </div>

          {/* Uploaded Songs Library */}
          {songs && songs.length > 0 && (
            <Card className="bg-studio-panel border-gray-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Uploaded Songs ({songs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {songs.map((song) => (
                  <div key={song.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-600">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{song.name}</h4>
                      <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <span>{formatFileSize(song.fileSize)}</span>
                        <span className="capitalize">{song.format}</span>
                        {song.duration && <span>{formatTime(song.duration)}</span>}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => playSong(song)}
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 border-gray-600"
                        disabled={currentSong?.id === song.id && isPlaying}
                      >
                        {currentSong?.id === song.id && isPlaying ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => analyzeSong(song)}
                        size="sm"
                        className="h-8 px-3 bg-studio-accent hover:bg-blue-500"
                      >
                        Analyze
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions & Suggestions */}
          <div className="w-80 space-y-4">
            <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
              <h3 className="font-medium mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInputMessage(action.action);
                      // Auto-send the message
                      setTimeout(() => handleSendMessage(), 100);
                    }}
                    className="w-full bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-sm text-left transition-colors"
                  >
                    <i className={`${action.icon} mr-2 text-studio-accent`}></i>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
              <h3 className="font-medium mb-3">Recent Suggestions</h3>
              <div className="space-y-3 text-sm">
                <div className="p-2 bg-gray-700 rounded">
                  <div className="font-medium text-studio-accent">Jazz Chord Progression</div>
                  <div className="text-gray-400">Cmaj7 - Am7 - Dm7 - G7</div>
                </div>
                <div className="p-2 bg-gray-700 rounded">
                  <div className="font-medium text-studio-accent">Code Refactor</div>
                  <div className="text-gray-400">Use array.map() instead of for loop</div>
                </div>
                <div className="p-2 bg-gray-700 rounded">
                  <div className="font-medium text-studio-accent">Drum Fill</div>
                  <div className="text-gray-400">32nd note snare roll at bar end</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}