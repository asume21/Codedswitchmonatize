import { useState, useContext, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StudioAudioContext } from "@/pages/studio";
import { useAIMessages } from "@/contexts/AIMessageContext";
import { SimpleFileUploader } from "@/components/SimpleFileUploader";
import type { Song } from "@shared/schema";

interface UploadContext {
  name?: string;
  fileSize?: number;
  format?: string;
}

export default function SongUploader() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [uploadContext, setUploadContext] = useState<UploadContext>({});
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);
  const { addMessage } = useAIMessages();

  const { data: songs, isLoading: songsLoading } = useQuery<Song[]>({
    queryKey: ['/api/songs'],
    initialData: [],
  });

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
    },
    onError: (error: any) => {
      console.error('Upload mutation error:', error);
      const isAuthError = error?.response?.status === 401 || error?.message?.includes('log in');
      
      toast({
        title: "Upload Failed",
        description: isAuthError 
          ? "Please log in to upload songs. Refresh the page and sign in."
          : "Failed to save your song. Please try again.",
        variant: "destructive",
        duration: isAuthError ? 10000 : 5000,
      });
    },
  });

  const getUploadParameters = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload", {});
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error", temporary: false }));
        console.error('Upload URL generation failed:', errorData);
        
        // Check if it's a temporary service issue
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
        
        // For other errors, show generic message
        toast({
          title: "Upload Service Error",
          description: "Unable to connect to upload service. Please refresh the page and try again.",
          variant: "destructive",
        });
        
        throw new Error(errorData.error || "Failed to generate upload URL");
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        toast({
          title: "Server Error",
          description: "Server returned an invalid response. The upload service may be down.",
          variant: "destructive",
        });
        throw new Error("Server returned HTML instead of JSON - upload endpoint may not be deployed");
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
      
      // Don't show duplicate toast if we already showed one above
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

      // Extract proper file information
      const fileName = uploadedFile.name || `Uploaded Song ${Date.now()}`;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      const fileSize = uploadedFile.size || 0;
      const mimeType = uploadedFile.type || '';
      
      // Determine format from file extension and MIME type
      let format = fileExtension;
      if (mimeType.includes('audio/')) {
        format = mimeType.split('/')[1] || fileExtension;
      }
      
      // Create context with proper file information
      const fileInfo = {
        name: fileName,
        fileSize: fileSize,
        format: format === 'unknown' ? (mimeType || 'audio') : format,
        mimeType: mimeType
      };
      
      console.log('🎵 Processed file info:', fileInfo);
      setUploadContext(fileInfo);
      
      if (songURL) {
        // Upload with proper metadata
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

  const playSong = async (song: Song) => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }

    try {
      // Use the accessible URL that's already stored in the song record
      const accessibleURL = song.accessibleUrl;
      console.log('🎵 Using accessible URL:', accessibleURL);
      
      const audio = new Audio();
      
      // Add comprehensive error handling
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        const error = (e.target as HTMLAudioElement).error;
        let errorMessage = 'Unknown error occurred';
        
        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
              errorMessage = 'Audio playback aborted';
              break;
            case error.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error while loading audio';
              break;
            case error.MEDIA_ERR_DECODE:
              errorMessage = 'Audio format not supported or corrupted';
              break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Audio format not supported by browser';
              break;
          }
        }
        
        toast({
          title: "Playback Error",
          description: `Cannot play ${song.name}: ${errorMessage}`,
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

      audio.addEventListener('canplaythrough', () => {
        console.log(`🎵 Song ready to play: ${song.name}`);
      });

      // Clear existing sources
      audio.innerHTML = '';
      
      // Create source element with proper MIME type
      const source = document.createElement('source');
      source.src = accessibleURL;
      
      // Set MIME type based on file extension
      if (accessibleURL.toLowerCase().endsWith('.m4a')) {
        source.type = 'audio/mp4';
      } else if (accessibleURL.toLowerCase().endsWith('.mp3')) {
        source.type = 'audio/mpeg';
      } else if (accessibleURL.toLowerCase().endsWith('.wav')) {
        source.type = 'audio/wav';
      } else if (accessibleURL.toLowerCase().endsWith('.ogg')) {
        source.type = 'audio/ogg';
      } else {
        source.type = 'audio/mpeg'; // Default to mp3
      }
      
      audio.appendChild(source);
      audio.load();
      
      // Wait for audio to be ready before playing
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          resolve(void 0);
        };
        
        const onError = (e: Event) => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          const error = (e.target as HTMLAudioElement).error;
          let errorMessage = 'Audio loading failed';
          
          if (error) {
            switch (error.code) {
              case error.MEDIA_ERR_ABORTED:
                errorMessage = 'Audio loading aborted';
                break;
              case error.MEDIA_ERR_NETWORK:
                errorMessage = 'Network error while loading audio';
                break;
              case error.MEDIA_ERR_DECODE:
                errorMessage = 'Audio format not supported or corrupted';
                break;
              case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Audio format not supported by browser';
                break;
            }
          }
          
          reject(new Error(errorMessage));
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
        description: `Cannot play ${song.name}. ${error instanceof Error ? error.message : 'The file may be corrupted or unsupported.'}`,
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

  const pauseSong = () => {
    if (audioElement && isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else if (audioElement && !isPlaying) {
      audioElement.play();
      setIsPlaying(true);
    }
  };

  const seekTo = (time: number) => {
    if (audioElement) {
      audioElement.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        description: `AI analyzed ${song.name} - check the AI Assistant for insights!`,
      });

      // Store analysis in studio context for other tools to use
      studioContext.setCurrentCodeMusic?.({
        ...analysis,
        source: 'uploaded_song',
        originalSong: song
      });

      // Send analysis to AI Assistant by posting a message
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

      // Add message to AI Assistant using context
      console.log('🎵 Sending analysis to AI Assistant via context:', analysisMessage.substring(0, 100) + '...');
      addMessage(analysisMessage, 'song-analysis');

    } catch (error) {
      toast({
        title: "Analysis Failed", 
        description: "Could not analyze the song. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-600 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-heading font-bold">Song Upload & Library</h2>
          <div className="text-xs text-gray-400 px-2">
            <div>Upload existing songs for AI analysis</div>
            <div>Supported: MP3, WAV, M4A, OGG</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <SimpleFileUploader
            maxFileSize={50485760} // 50MB max for audio files
            onGetUploadParameters={getUploadParameters}
            onComplete={(result) => {
              console.log('🎵 Upload complete:', result);
              const songData = {
                songURL: result.url,
                name: result.name,
                fileSize: 0,
                format: result.name.split('.').pop() || 'audio',
                mimeType: 'audio/*'
              };
              uploadSongMutation.mutate(songData);
            }}
            buttonClassName="bg-studio-accent hover:bg-blue-500"
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-upload"></i>
              <span>Upload Song</span>
            </div>
          </SimpleFileUploader>

          {songs && songs.length > 0 && (
            <Badge variant="secondary">{songs.length} song{songs.length > 1 ? 's' : ''} uploaded</Badge>
          )}

          {isPlaying && currentSong && (
            <div className="space-y-3">
              {/* Visual Timeline */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Now Playing: {currentSong.name}</span>
                  <span className="text-sm text-gray-400">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  ></div>
                </div>
                
                {/* Seek Bar */}
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #374151 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #374151 100%)`
                  }}
                />
                
                {/* Control Buttons */}
                <div className="flex items-center justify-center space-x-3 mt-3">
                  <Button
                    onClick={pauseSong}
                    className="bg-blue-600 hover:bg-blue-500"
                    size="sm"
                  >
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} mr-2`}></i>
                    {isPlaying ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    onClick={stopSong}
                    className="bg-red-600 hover:bg-red-500"
                    size="sm"
                  >
                    <i className="fas fa-stop mr-2"></i>
                    Stop
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {songsLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-spinner fa-spin text-4xl text-blue-400 mb-4"></i>
              <p className="text-gray-400">Loading your songs...</p>
            </div>
          </div>
        ) : !songs || songs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-md">
              <i className="fas fa-cloud-upload-alt text-6xl text-gray-600 mb-4"></i>
              <h3 className="text-xl font-semibold mb-2">No Songs Uploaded</h3>
              <p className="text-gray-400 mb-6">
                Upload your existing songs to integrate them with CodedSwitch's AI tools. 
                Once uploaded, you can analyze them for musical insights, extract patterns, 
                or use them as reference for new compositions.
              </p>
              <div className="text-sm text-gray-500 space-y-2">
                <p><strong>What you can do with uploaded songs:</strong></p>
                <p>• AI analysis for musical structure and patterns</p>
                <p>• Extract beats and melodies for remixing</p>
                <p>• Generate lyrics that match the song's mood</p>
                <p>• Use as reference for Dynamic Layering</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Song Library ({songs.length})</h3>
            </div>

            <div className="grid gap-4">
              {songs.map((song) => (
                <Card key={song.id} className={`border-gray-600 ${currentSong?.id === song.id ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center">
                        <i className="fas fa-music mr-2 text-blue-400"></i>
                        {song.name}
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => playSong(song)}
                          disabled={currentSong?.id === song.id}
                          className="bg-green-600 hover:bg-green-500"
                        >
                          <i className="fas fa-play mr-1"></i>
                          {currentSong?.id === song.id ? 'Selected' : 'Play'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => analyzeSong(song)}
                          className="bg-purple-600 hover:bg-purple-500"
                        >
                          <i className="fas fa-brain mr-1"></i>
                          Analyze
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Size:</span>
                          <div className="font-semibold">{Math.round(song.fileSize / (1024 * 1024) * 10) / 10} MB</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Uploaded:</span>
                          <div className="font-semibold">{song.uploadDate ? formatDate(song.uploadDate) : 'Unknown'}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Duration:</span>
                          <div className="font-semibold">{song.duration ? `${Math.round(song.duration)}s` : 'Unknown'}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Status:</span>
                          <div className="font-semibold text-green-400">Ready</div>
                        </div>
                      </div>

                      <Separator className="bg-gray-600" />

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          <i className="fas fa-file-audio mr-1"></i>
                          Audio File
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <i className="fas fa-brain mr-1"></i>
                          AI Ready
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <i className="fas fa-layer-group mr-1"></i>
                          Layer Source
                        </Badge>
                      </div>

                      <div className="text-xs text-gray-500">
                        Click "Analyze" to extract musical patterns, or use as reference material for Dynamic Layering and other AI tools.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}