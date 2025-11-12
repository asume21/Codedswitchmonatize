import { useState, useContext, useEffect } from "react";
import * as Tone from "tone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StudioAudioContext } from "@/pages/studio";
import { useAIMessages } from "@/contexts/AIMessageContext";
import { SimpleFileUploader } from "@/components/SimpleFileUploader";
import { AudioToolRouter } from "@/components/studio/effects/AudioToolRouter";
import WaveformVisualizer from "@/components/studio/WaveformVisualizer";
import { Sparkles, Copy, Plus, Scissors, Mic } from "lucide-react";
import type { Song } from "../../../../shared/schema";
import type { ToolRecommendation } from "@/components/studio/effects";

interface UploadContext {
  name?: string;
  fileSize?: number;
  format?: string;
}

export default function SongUploader() {
  const [uploadContext, setUploadContext] = useState<UploadContext>({});
  const [showAudioTools, setShowAudioTools] = useState(false);
  const [songAnalysis, setSongAnalysis] = useState<any>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [sunoAction, setSunoAction] = useState<'cover' | 'extend' | 'separate' | 'add-vocals' | null>(null);
  const [sunoPrompt, setSunoPrompt] = useState('');
  const [sunoModel, setSunoModel] = useState('v4_5plus');
  const [sunoProcessing, setSunoProcessing] = useState(false);

  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);
  const { addMessage } = useAIMessages();

  const { data: songs, isLoading: songsLoading, refetch } = useQuery<Song[]>({
    queryKey: ['/api/songs'],
    initialData: [],
  });

  // Load songs when component mounts
  useEffect(() => {
    refetch();
  }, [refetch]);

  const uploadSongMutation = useMutation({
    mutationFn: async (songData: any) => {
      console.log('🚀 MUTATION: Sending to server:', {
        name: songData.name,
        fileSize: songData.fileSize,
        duration: songData.duration,
        format: songData.format
      });
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

  const handleUploadComplete = (result: any) => {
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

      // Extract proper file information - get from the actual File object
      const actualFile = uploadedFile.data as File;
      const fileName = uploadedFile.name || `Uploaded Song ${Date.now()}`;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      const fileSize = (actualFile && actualFile.size) || uploadedFile.size || 0;
      const mimeType = (actualFile && actualFile.type) || uploadedFile.type || '';
      
      console.log('📊 File size detected:', fileSize, 'bytes (', Math.round(fileSize / (1024 * 1024) * 10) / 10, 'MB )');
      
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
        // Try to get audio duration from the uploaded file
        const file = uploadedFile.data as File;
        
        if (file && file instanceof File) {
          // Use FileReader to get duration from the actual file
          const audioEl = document.createElement('audio');
          const objectURL = URL.createObjectURL(file);
          
          let durationFound = false;
          const audioTimeout = setTimeout(() => {
            if (!durationFound) {
              console.warn('⏱️ Audio metadata timeout, uploading without duration');
              URL.revokeObjectURL(objectURL);
              uploadWithData(0);
            }
          }, 8000);
          
          const uploadWithData = (duration: number) => {
            if (durationFound) return;
            durationFound = true;
            clearTimeout(audioTimeout);
            URL.revokeObjectURL(objectURL);
            
            const songData = {
              songURL,
              name: fileInfo.name,
              fileSize: fileInfo.fileSize,
              format: fileInfo.format,
              mimeType: fileInfo.mimeType,
              duration: duration || 0
            };
            
            console.log('🎵 Sending song data with file size:', fileInfo.fileSize, 'bytes');
            uploadSongMutation.mutate(songData);
          };
          
          audioEl.addEventListener('loadedmetadata', () => {
            console.log('✅ Got duration from file:', audioEl.duration);
            uploadWithData(audioEl.duration);
          });
          
          audioEl.addEventListener('error', (e) => {
            console.warn('⚠️ Audio metadata error, uploading without duration');
            uploadWithData(0);
          });
          
          audioEl.src = objectURL;
        } else {
          // Fallback: upload without duration
          const songData = {
            songURL,
            name: fileInfo.name,
            fileSize: fileInfo.fileSize,
            format: fileInfo.format,
            mimeType: fileInfo.mimeType,
            duration: 0
          };
          
          console.log('🎵 Sending song data (no duration available)');
          uploadSongMutation.mutate(songData);
        }
      }
    }
  };

  const playSong = async (song: Song) => {
    try {
      // Try multiple URL sources in order of preference
      let accessibleURL = song.accessibleUrl || song.originalUrl || song.songURL;
      
      if (!accessibleURL) {
        throw new Error("No URL available for this song");
      }

      // Fix internal URLs to ensure they're accessible
      if (accessibleURL.includes('/api/internal/uploads/')) {
        // Add timestamp and proper headers for internal URLs
        const timestamp = Date.now();
        accessibleURL = accessibleURL.includes('?') 
          ? `${accessibleURL}&t=${timestamp}&direct=true`
          : `${accessibleURL}?t=${timestamp}&direct=true`;
      }

      // For M4A files, try to add format parameter to help browser
      if (accessibleURL.includes('.m4a')) {
        accessibleURL = accessibleURL.includes('?') 
          ? `${accessibleURL}&format=mp4`
          : `${accessibleURL}?format=mp4`;
      }

      console.log(`🎵 Attempting to play: ${song.name} from URL: ${accessibleURL.substring(0, 100)}...`);

      // Stop any currently playing audio
      if (studioContext.uploadedSongAudio) {
        studioContext.uploadedSongAudio.pause();
        studioContext.uploadedSongAudio.src = '';
      }

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      
      audio.addEventListener('loadedmetadata', () => {
        console.log(`✅ Song loaded: ${song.name}, duration: ${audio.duration}s`);
      });
      
      audio.addEventListener('ended', () => {
        console.log(`✅ Song finished: ${song.name}`);
        // Clear from context when song ends
        studioContext.setCurrentUploadedSong(null, null);
      });

      audio.addEventListener('error', (e) => {
        const error = (e.target as HTMLAudioElement).error;
        let errorMessage = 'Audio loading failed';
        let isFormatIssue = false;
        
        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
              errorMessage = 'Audio loading aborted';
              break;
            case error.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error - check your connection';
              break;
            case error.MEDIA_ERR_DECODE:
              errorMessage = 'Audio format not supported or file corrupted';
              isFormatIssue = true;
              break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Audio format not supported by your browser';
              isFormatIssue = true;
              break;
          }
        }
        
        // Check if it's an M4A format issue and suggest conversion
        if (isFormatIssue && (accessibleURL.includes('.m4a') || accessibleURL.includes('.mp4'))) {
          errorMessage += '. M4A files may not work in all browsers. Try converting to MP3 or WAV format.';
        }
        
        console.error('🚫 Audio error:', errorMessage, 'URL:', accessibleURL);
        toast({
          title: "Playback Error",
          description: `Cannot play ${song.name}: ${errorMessage}`,
          variant: "destructive",
          duration: 8000,
        });
        
        studioContext.setCurrentUploadedSong(null, null);
      });

      // Set source and load
      audio.src = accessibleURL;
      audio.preload = "metadata";
      
      // Initialize Tone.js if needed (requires user interaction)
      if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
        await Tone.start();
        console.log('🎵 Tone.js AudioContext started');
      }
      
      // Store in context for Global Transport to play
      studioContext.setCurrentUploadedSong(song, audio);
      
      toast({
        title: "Song Loaded",
        description: `${song.name} ready to play. Use Global Transport ▶️ to play.`,
      });
      
    } catch (error) {
      console.error('🚫 Audio playback error:', error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: "Load Failed",
        description: `Cannot load ${song.name}. ${error instanceof Error ? error.message : 'The file may be corrupted or unsupported.'}`,
        variant: "destructive",
      });
      studioContext.setCurrentUploadedSong(null, null);
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
      
      console.log('🔍 FRONTEND RECEIVED ANALYSIS:', {
        hasVocalAnalysis: !!analysis.vocalAnalysis,
        hasVocals: analysis.vocalAnalysis?.hasVocals,
        hasLyricsQuality: !!analysis.lyricsQuality,
        vocalAnalysis: analysis.vocalAnalysis,
        lyricsQuality: analysis.lyricsQuality
      });
      
      setSongAnalysis(analysis);
      
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
      let analysisMessage = `📊 **Song Analysis Complete: ${song.name}**

🎵 **Musical Properties:**
• BPM: ${analysis.estimatedBPM}
• Key: ${analysis.keySignature} 
• Genre: ${analysis.genre}
• Mood: ${analysis.mood}
${analysis.energyLevel ? `• Energy Level: ${analysis.energyLevel}/10` : ''}


${analysis.structure ? `🎼 **Song Structure:**
${typeof analysis.structure === 'object' && !Array.isArray(analysis.structure) 
  ? Object.entries(analysis.structure).map(([section, timing]) => `• ${section}: ${timing}`).join('\n')
  : Array.isArray(analysis.structure)
    ? analysis.structure.map((s: any) => `• ${s}`).join('\n')
    : analysis.structure}
` : ''}
${analysis.instruments ? `🎺 **Instruments Detected:**
${Array.isArray(analysis.instruments) ? analysis.instruments.join(', ') : analysis.instruments}` : ''}
`;

      // Add vocal analysis if available
      if (analysis.vocalAnalysis && analysis.vocalAnalysis.hasVocals) {
        analysisMessage += `\n🎤 **Vocal Analysis:**\n`;
        if (analysis.vocalAnalysis.vocalRange) analysisMessage += `• Vocal Range: ${analysis.vocalAnalysis.vocalRange}\n`;
        if (analysis.vocalAnalysis.deliveryStyle) analysisMessage += `• Delivery Style: ${analysis.vocalAnalysis.deliveryStyle}\n`;
        if (analysis.vocalAnalysis.flowTiming) analysisMessage += `• Flow & Timing: ${analysis.vocalAnalysis.flowTiming}\n`;
        if (analysis.vocalAnalysis.breathControl) analysisMessage += `• Breath Control: ${analysis.vocalAnalysis.breathControl}\n`;
        if (analysis.vocalAnalysis.vocalEffects && Array.isArray(analysis.vocalAnalysis.vocalEffects) && analysis.vocalAnalysis.vocalEffects.length > 0) {
          analysisMessage += `• Effects Used: ${analysis.vocalAnalysis.vocalEffects.join(', ')}\n`;
        }
        if (analysis.vocalAnalysis.clarity) analysisMessage += `• Clarity: ${analysis.vocalAnalysis.clarity}\n`;
        if (analysis.vocalAnalysis.emotionalDelivery) analysisMessage += `• Emotional Delivery: ${analysis.vocalAnalysis.emotionalDelivery}\n`;
        if (analysis.vocalAnalysis.timingIssues) analysisMessage += `• Timing Notes: ${analysis.vocalAnalysis.timingIssues}\n`;
      }

      // Add lyrics quality if available
      if (analysis.lyricsQuality) {
        analysisMessage += `\n📝 **Lyrics Analysis:**\n`;
        if (analysis.lyricsQuality.rhymeScheme) analysisMessage += `• Rhyme Scheme: ${analysis.lyricsQuality.rhymeScheme}\n`;
        if (analysis.lyricsQuality.wordplay) analysisMessage += `• Wordplay: ${analysis.lyricsQuality.wordplay}\n`;
        if (analysis.lyricsQuality.theme) analysisMessage += `• Theme: ${analysis.lyricsQuality.theme}\n`;
        if (analysis.lyricsQuality.syllableRhythm) analysisMessage += `• Syllable & Rhythm: ${analysis.lyricsQuality.syllableRhythm}\n`;
        if (analysis.lyricsQuality.hookCatchiness) analysisMessage += `• Hook Catchiness: ${analysis.lyricsQuality.hookCatchiness}/10\n`;
        if (analysis.lyricsQuality.complexity) analysisMessage += `• Complexity: ${analysis.lyricsQuality.complexity}\n`;
      }

      // Add production quality feedback if available
      if (analysis.productionQuality) {
        analysisMessage += `\n🎚️ **Production Quality:**\n`;
        if (analysis.productionQuality.mixQuality) analysisMessage += `• Mix Quality: ${analysis.productionQuality.mixQuality}/10\n`;
        if (analysis.productionQuality.masterQuality) analysisMessage += `• Master Quality: ${analysis.productionQuality.masterQuality}/10\n`;
        
        if (analysis.productionQuality.strengths && Array.isArray(analysis.productionQuality.strengths) && analysis.productionQuality.strengths.length > 0) {
          analysisMessage += `\n✅ **What's Working:**\n`;
          analysisMessage += analysis.productionQuality.strengths.map((s: string) => `• ${s}`).join('\n') + '\n';
        }
        
        if (analysis.productionQuality.issues && Array.isArray(analysis.productionQuality.issues) && analysis.productionQuality.issues.length > 0) {
          analysisMessage += `\n⚠️ **Issues Found:**\n`;
          analysisMessage += analysis.productionQuality.issues.map((i: string) => `• ${i}`).join('\n') + '\n';
        }
        
        if (analysis.productionQuality.recommendations && Array.isArray(analysis.productionQuality.recommendations) && analysis.productionQuality.recommendations.length > 0) {
          analysisMessage += `\n🎯 **Recommendations:**\n`;
          analysisMessage += analysis.productionQuality.recommendations.map((r: string) => `• ${r}`).join('\n') + '\n';
        }
      }

      // Add specific issues to fix
      if (analysis.specificIssues && Array.isArray(analysis.specificIssues) && analysis.specificIssues.length > 0) {
        analysisMessage += `\n🛠️ **Specific Issues to Fix:**\n`;
        analysis.specificIssues.forEach((issue: any, index: number) => {
          if (issue && issue.issue) {
            const priorityIcon = issue.priority === 'high' ? '🔴' : issue.priority === 'medium' ? '🟡' : '🟢';
            analysisMessage += `\n${index + 1}. ${priorityIcon} **${issue.issue}**${issue.priority ? ` (${issue.priority} priority)` : ''}\n`;
            if (issue.fix) analysisMessage += `   💡 How to fix: ${issue.fix}\n`;
          }
        });
      }

      // Add commercial viability if available
      if (analysis.commercialViability) {
        analysisMessage += `\n💰 **Commercial Viability:**\n`;
        if (analysis.commercialViability.streamingPotential) analysisMessage += `• Streaming Potential: ${analysis.commercialViability.streamingPotential}/10\n`;
        if (analysis.commercialViability.improvements && Array.isArray(analysis.commercialViability.improvements) && analysis.commercialViability.improvements.length > 0) {
          analysisMessage += `• Improvements:\n`;
          analysisMessage += analysis.commercialViability.improvements.map((i: string) => `  - ${i}`).join('\n') + '\n';
        }
      }

      // Add overall score
      if (analysis.overallScore) {
        analysisMessage += `\n📈 **Overall Quality Score: ${analysis.overallScore}/10**\n`;
      }

      // Add AI analysis notes
      if (analysis.analysis_notes) {
        analysisMessage += `\n🤖 **Detailed Analysis:**\n${analysis.analysis_notes}\n`;
      }

      analysisMessage += `\nThis analysis has been saved and can be used with other studio tools for remixing, layering, and composition inspiration!`;

      // Add message to AI Assistant using context
      console.log('🎵 Sending analysis to AI Assistant via context:', analysisMessage.substring(0, 100) + '...');
      addMessage(analysisMessage, 'song-analysis');

    } catch (error) {
      console.error('❌ Analysis error:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
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

  // Suno API - Cover Song (Transform with different style)
  const processSunoCover = async (song: Song, prompt: string) => {
    setSunoProcessing(true);
    try {
      const audioUrl = song.accessibleUrl || song.originalUrl || song.songURL;
      const response = await apiRequest('POST', '/api/songs/suno/cover', {
        audioUrl,
        prompt,
        model: sunoModel
      });
      
      const data = await response.json();
      toast({
        title: "Suno Cover Started!",
        description: `Creating ${prompt} version. This may take a few minutes.`,
      });

      addMessage(`🎵 Started Suno cover for "${song.name}": ${prompt}`, 'suno-cover');
    } catch (error) {
      toast({
        title: "Suno Cover Failed",
        description: error instanceof Error ? error.message : "Failed to start cover",
        variant: "destructive",
      });
    } finally {
      setSunoProcessing(false);
      setSunoAction(null);
    }
  };

  // Suno API - Extend Song
  const processSunoExtend = async (song: Song) => {
    setSunoProcessing(true);
    try {
      const audioUrl = song.accessibleUrl || song.originalUrl || song.songURL;
      const response = await apiRequest('POST', '/api/songs/suno/extend', {
        audioUrl,
        prompt: sunoPrompt || undefined,
        model: sunoModel
      });
      
      const data = await response.json();
      toast({
        title: "Suno Extend Started!",
        description: `Extending "${song.name}". This may take a few minutes.`,
      });

      addMessage(`🎵 Started Suno extend for "${song.name}"`, 'suno-extend');
    } catch (error) {
      toast({
        title: "Suno Extend Failed",
        description: error instanceof Error ? error.message : "Failed to extend song",
        variant: "destructive",
      });
    } finally {
      setSunoProcessing(false);
      setSunoAction(null);
    }
  };

  // Suno API - Separate Vocals
  const processSunoSeparate = async (song: Song) => {
    setSunoProcessing(true);
    try {
      const audioUrl = song.accessibleUrl || song.originalUrl || song.songURL;
      const response = await apiRequest('POST', '/api/songs/suno/separate', {
        audioUrl
      });
      
      const data = await response.json();
      toast({
        title: "Vocal Separation Started!",
        description: `Separating vocals from "${song.name}". This may take a few minutes.`,
      });

      addMessage(`🎵 Started vocal separation for "${song.name}"`, 'suno-separate');
    } catch (error) {
      toast({
        title: "Separation Failed",
        description: error instanceof Error ? error.message : "Failed to separate vocals",
        variant: "destructive",
      });
    } finally {
      setSunoProcessing(false);
      setSunoAction(null);
    }
  };

  // Suno API - Add Vocals
  const processSunoAddVocals = async (song: Song, prompt: string) => {
    setSunoProcessing(true);
    try {
      const audioUrl = song.accessibleUrl || song.originalUrl || song.songURL;
      const response = await apiRequest('POST', '/api/songs/suno/add-vocals', {
        audioUrl,
        prompt,
        model: sunoModel
      });
      
      const data = await response.json();
      toast({
        title: "Adding Vocals Started!",
        description: `Adding AI vocals to "${song.name}". This may take a few minutes.`,
      });

      addMessage(`🎵 Started adding vocals to "${song.name}": ${prompt}`, 'suno-add-vocals');
    } catch (error) {
      toast({
        title: "Add Vocals Failed",
        description: error instanceof Error ? error.message : "Failed to add vocals",
        variant: "destructive",
      });
    } finally {
      setSunoProcessing(false);
      setSunoAction(null);
    }
  };

  // If showing audio tools, render the tool router
  if (showAudioTools && studioContext.currentUploadedSong && songAnalysis) {
    return (
      <div className="h-full flex flex-col overflow-hidden p-6">
        <Button 
          variant="ghost" 
          onClick={() => setShowAudioTools(false)}
          className="mb-4 text-white hover:text-gray-300"
        >
          ← Back to Song Library
        </Button>
        <AudioToolRouter
          songUrl={studioContext.currentUploadedSong.accessibleUrl || studioContext.currentUploadedSong.originalUrl || studioContext.currentUploadedSong.songURL || ''}
          songName={studioContext.currentUploadedSong.name}
          recommendations={songAnalysis.toolRecommendations || []}
        />
      </div>
    );
  }

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
              console.log('🎵 SimpleFileUploader complete:', result);
              
              const fileSize = result.file.size;
              const format = result.name.split('.').pop()?.toLowerCase() || 'audio';
              const mimeType = result.file.type || 'audio/*';
              
              console.log('📊 File size detected:', fileSize, 'bytes (', Math.round(fileSize / (1024 * 1024) * 10) / 10, 'MB )');
              
              // Try to get duration from the File object
              const audioEl = document.createElement('audio');
              const objectURL = URL.createObjectURL(result.file);
              
              let durationFound = false;
              const audioTimeout = setTimeout(() => {
                if (!durationFound) {
                  console.warn('⏱️ Audio metadata timeout, uploading without duration');
                  URL.revokeObjectURL(objectURL);
                  uploadSong(0);
                }
              }, 8000);
              
              const uploadSong = (duration: number) => {
                if (durationFound) return;
                durationFound = true;
                clearTimeout(audioTimeout);
                URL.revokeObjectURL(objectURL);
                
                const songData = {
                  songURL: result.url,
                  name: result.name,
                  fileSize: fileSize,
                  duration: Math.round(duration) || 0, // Round to integer for database
                  format: format,
                  mimeType: mimeType
                };
                
                console.log('🚀 MUTATION: Sending to server:', {
                  name: songData.name,
                  fileSize: songData.fileSize,
                  duration: songData.duration,
                  format: songData.format
                });
                uploadSongMutation.mutate(songData);
              };
              
              audioEl.addEventListener('loadedmetadata', () => {
                console.log('✅ Got duration from file:', audioEl.duration);
                uploadSong(audioEl.duration);
              });
              
              audioEl.addEventListener('error', (e) => {
                console.warn('⚠️ Audio metadata error, uploading without duration');
                uploadSong(0);
              });
              
              audioEl.src = objectURL;
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

          {studioContext.currentUploadedSong && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm text-gray-400">Selected Song</div>
                    <div className="text-lg font-bold text-white">{studioContext.currentUploadedSong.name}</div>
                  </div>
                  <div className="text-sm text-blue-400 flex items-center gap-2">
                    <i className="fas fa-info-circle"></i>
                    Use Global Transport ▶️ to play
                  </div>
                </div>
                
                {/* Waveform Visualizer */}
                {studioContext.uploadedSongAudio && (
                  <WaveformVisualizer
                    audioElement={studioContext.uploadedSongAudio}
                    isPlaying={studioContext.isPlaying}
                    height={100}
                    showControls={true}
                  />
                )}
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
                <Card key={song.id} className={`border-gray-600 ${studioContext.currentUploadedSong?.id === song.id ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center">
                        <i className="fas fa-music mr-2 text-blue-400"></i>
                        {song.name}
                      </CardTitle>
                      <div className="flex items-center space-x-2 flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => playSong(song)}
                          disabled={studioContext.currentUploadedSong?.id === song.id}
                          className="bg-green-600 hover:bg-green-500"
                          data-testid={`button-load-song-${song.id}`}
                        >
                          <i className="fas fa-check-circle mr-1"></i>
                          {studioContext.currentUploadedSong?.id === song.id ? 'Loaded' : 'Load'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => analyzeSong(song)}
                          className="bg-purple-600 hover:bg-purple-500"
                          data-testid={`button-analyze-song-${song.id}`}
                        >
                          <i className="fas fa-brain mr-1"></i>
                          Analyze
                        </Button>
                        
                        {/* Suno AI Actions Dropdown */}
                        <Select
                          value=""
                          onValueChange={(value: any) => {
                            setSelectedSong(song);
                            setSunoAction(value);
                            // Separate vocals is instant - no prompt needed
                            if (value === 'separate') {
                              processSunoSeparate(song);
                            }
                            // Other actions need prompt - they'll show dialog below
                          }}
                        >
                          <SelectTrigger className="w-[140px] h-8 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500" data-testid={`select-suno-action-${song.id}`}>
                            <Sparkles className="w-3 h-3 mr-1" />
                            <SelectValue placeholder="Suno AI ✨" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cover">
                              <div className="flex items-center">
                                <Copy className="w-3 h-3 mr-2" />
                                Cover (Transform Style)
                              </div>
                            </SelectItem>
                            <SelectItem value="extend">
                              <div className="flex items-center">
                                <Plus className="w-3 h-3 mr-2" />
                                Extend Song
                              </div>
                            </SelectItem>
                            <SelectItem value="separate">
                              <div className="flex items-center">
                                <Scissors className="w-3 h-3 mr-2" />
                                Separate Vocals
                              </div>
                            </SelectItem>
                            <SelectItem value="add-vocals">
                              <div className="flex items-center">
                                <Mic className="w-3 h-3 mr-2" />
                                Add AI Vocals
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {songAnalysis && studioContext.currentUploadedSong?.id === song.id && (
                          <Button
                            size="sm"
                            onClick={() => setShowAudioTools(true)}
                            className="bg-blue-600 hover:bg-blue-500"
                            data-testid="button-open-tools"
                          >
                            <i className="fas fa-sliders-h mr-1"></i>
                            Open Tools
                          </Button>
                        )}
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

      {/* Suno AI Prompt Dialog */}
      {selectedSong && sunoAction && sunoAction !== 'separate' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Suno AI - {sunoAction === 'cover' ? 'Cover Song' : sunoAction === 'extend' ? 'Extend Song' : 'Add Vocals'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white mb-2 block">Song: {selectedSong.name}</Label>
              </div>

              {sunoAction === 'cover' && (
                <div>
                  <Label htmlFor="cover-prompt" className="text-white mb-2 block">
                    Style Transformation Prompt
                  </Label>
                  <Input
                    id="cover-prompt"
                    placeholder="e.g., acoustic version, electronic remix, jazz arrangement"
                    value={sunoPrompt}
                    onChange={(e) => setSunoPrompt(e.target.value)}
                    className="bg-gray-700 text-white"
                    data-testid="input-suno-prompt"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Describe how you want to transform this song's style
                  </p>
                </div>
              )}

              {sunoAction === 'extend' && (
                <div>
                  <Label htmlFor="extend-prompt" className="text-white mb-2 block">
                    Extension Prompt (Optional)
                  </Label>
                  <Input
                    id="extend-prompt"
                    placeholder="e.g., continue with upbeat energy, add a guitar solo"
                    value={sunoPrompt}
                    onChange={(e) => setSunoPrompt(e.target.value)}
                    className="bg-gray-700 text-white"
                    data-testid="input-suno-prompt"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Leave blank for automatic continuation
                  </p>
                </div>
              )}

              {sunoAction === 'add-vocals' && (
                <div>
                  <Label htmlFor="vocals-prompt" className="text-white mb-2 block">
                    Vocal Prompt
                  </Label>
                  <Input
                    id="vocals-prompt"
                    placeholder="e.g., female pop vocals, rap verses, soulful singing"
                    value={sunoPrompt}
                    onChange={(e) => setSunoPrompt(e.target.value)}
                    className="bg-gray-700 text-white"
                    data-testid="input-suno-prompt"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Describe the vocal style you want to add
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="suno-model" className="text-white mb-2 block">
                  AI Model
                </Label>
                <Select value={sunoModel} onValueChange={setSunoModel}>
                  <SelectTrigger id="suno-model" className="bg-gray-700 text-white" data-testid="select-suno-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v5">V5 (Latest - Best Quality)</SelectItem>
                    <SelectItem value="v4_5plus">V4.5 Plus (Richer Tones, 8min)</SelectItem>
                    <SelectItem value="v4_5">V4.5 (Smart Prompts, 8min)</SelectItem>
                    <SelectItem value="v4">V4 (Improved Vocals, 4min)</SelectItem>
                    <SelectItem value="v3_5">V3.5 (Better Structure, 4min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSunoAction(null);
                    setSunoPrompt('');
                  }}
                  disabled={sunoProcessing}
                  data-testid="button-cancel-suno"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-pink-600 to-purple-600"
                  onClick={() => {
                    if (sunoAction === 'cover' && sunoPrompt) {
                      processSunoCover(selectedSong, sunoPrompt);
                    } else if (sunoAction === 'extend') {
                      processSunoExtend(selectedSong);
                    } else if (sunoAction === 'add-vocals' && sunoPrompt) {
                      processSunoAddVocals(selectedSong, sunoPrompt);
                    }
                    setSunoPrompt('');
                  }}
                  disabled={sunoProcessing || (sunoAction === 'cover' && !sunoPrompt) || (sunoAction === 'add-vocals' && !sunoPrompt)}
                  data-testid="button-confirm-suno"
                >
                  {sunoProcessing ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate with Suno
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}