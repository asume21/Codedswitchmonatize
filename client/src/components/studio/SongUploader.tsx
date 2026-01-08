import { useState, useContext, useEffect, useCallback } from "react";
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
import { AIMessageContext } from "@/contexts/AIMessageContext";
import { useSongWorkSession, type SongIssue } from "@/contexts/SongWorkSessionContext";
import { SimpleFileUploader } from "@/components/SimpleFileUploader";
import { AudioToolRouter } from "@/components/studio/effects/AudioToolRouter";
import WaveformVisualizer from "@/components/studio/WaveformVisualizer";
import { Sparkles, Copy, Plus, Scissors, Mic, FileText, Trash2, Share2, Globe, Lock, Download } from "lucide-react";
import type { Song, Recommendation } from "../../../../shared/schema";
import { emitEvent } from "@/lib/eventBus";
import type { ToolRecommendation } from "@/components/studio/effects";
import { RecommendationList } from "@/components/studio/RecommendationCard";
import { useTracks } from "@/hooks/useTracks";
import { Textarea } from "@/components/ui/textarea";
import { professionalAudio } from "@/lib/professionalAudio";

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
  const [sunoAction, setSunoAction] = useState<'cover' | 'extend' | 'separate' | 'add-vocals' | 'add-instrumental' | null>(null);
  const [sunoPrompt, setSunoPrompt] = useState('');
  const [sunoModel, setSunoModel] = useState('v4_5plus');
  const [sunoProcessing, setSunoProcessing] = useState(false);
  
  // Per-song analysis results (Map<songId, analysis>)
  const [songAnalyses, setSongAnalyses] = useState<Map<string, any>>(new Map());
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  
  // Per-song session IDs (Map<songId, sessionId>)
  const [sessionIdsBySong, setSessionIdsBySong] = useState<Map<string, string>>(new Map());
  
  // Transcription + lyrics analysis state
  const [transcriptions, setTranscriptions] = useState<Map<string, string>>(new Map());
  const [isTranscribing, setIsTranscribing] = useState<Map<string, boolean>>(new Map());
  const [lyricsAnalyses, setLyricsAnalyses] = useState<Map<string, any>>(new Map());
  const [isAnalyzingLyrics, setIsAnalyzingLyrics] = useState<Map<string, boolean>>(new Map());
  const [isTranscribeAndAnalyze, setIsTranscribeAndAnalyze] = useState<Map<string, boolean>>(new Map());
  // Speech correction UI state
  const [speechSongId, setSpeechSongId] = useState<string>('');
  const [speechTranscript, setSpeechTranscript] = useState<string>('');
  const [speechWords, setSpeechWords] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [speechPreviewUrl, setSpeechPreviewUrl] = useState<string | null>(null);
  const [speechPreviewId, setSpeechPreviewId] = useState<string | null>(null);
  const [speechLoading, setSpeechLoading] = useState<{ transcribe: boolean; preview: boolean; commit: boolean }>({
    transcribe: false,
    preview: false,
    commit: false,
  });

  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);
  const aiContext = useContext(AIMessageContext);
  const addMessage = aiContext?.addMessage || (() => {});
  const { createSession, updateSession } = useSongWorkSession();
  const { addTrack, tracks } = useTracks();

  const transcribeSong = async (song: Song): Promise<string | null> => {
    const songId = song.id.toString();
    // Set transcribing state for this song
    setIsTranscribing(prev => {
      const newMap = new Map(prev);
      newMap.set(songId, true);
      return newMap;
    });
    
    try {
      const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
      console.log('🎤 Transcribing song:', song.name, audioUrl);
      
      const response = await apiRequest('POST', '/api/transcribe', {
        fileUrl: audioUrl
      });
      const data = await response.json();
      
      if (data.transcription && data.transcription.text) {
        const text = data.transcription.text;
        setTranscriptions(prev => {
          const newMap = new Map(prev);
          newMap.set(songId, text);
          return newMap;
        });
        setExpandedAnalysis(song.id); // Auto-expand to show result
        
        toast({
          title: "Transcription Complete",
          description: "Lyrics have been transcribed successfully.",
        });
        
        // Store in AI context
        addMessage(`📝 **Transcribed Lyrics for ${song.name}:**\n\n${text}`, 'transcription');

        return text;
      }
      return null;
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription Failed",
        description: "Could not transcribe the song. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTranscribing(prev => {
        const newMap = new Map(prev);
        newMap.delete(songId);
        return newMap;
      });
    }
    return null;
  };

  const analyzeLyrics = async (song: Song, lyricsText?: string) => {
    const songId = song.id.toString();
    const lyrics = lyricsText || transcriptions.get(songId);
    if (!lyrics) {
      toast({
        title: "No Lyrics Available",
        description: "Transcribe the song first to analyze lyrics.",
        variant: "destructive",
      });
      return null;
    }

    setIsAnalyzingLyrics(prev => {
      const newMap = new Map(prev);
      newMap.set(songId, true);
      return newMap;
    });

    try {
      const songGenre = (song as any).genre || (song as any).tags || undefined;
      const response = await apiRequest('POST', '/api/lyrics/analyze', {
        lyrics,
        genre: songGenre,
        enhanceWithAI: true,
      });
      const data = await response.json();
      if (data.analysis) {
        setLyricsAnalyses(prev => {
          const newMap = new Map(prev);
          newMap.set(songId, data.analysis);
          return newMap;
        });
        setExpandedAnalysis(song.id);
        toast({
          title: "Lyrics Analysis Ready",
          description: `${song.name} lyrics analyzed successfully.`,
        });

        const analysis = data.analysis;
        const score = analysis?.overall_rating?.score ?? analysis?.quality_score ?? 'N/A';
        const themes = (analysis?.themes || [])
          .map((t: any) => `${t.theme} (${Math.round((t.confidence || 0) * 100)}%)`)
          .join(', ');
        const lyricsQuality = analysis?.lyricsQuality || {};
        const aiInsights = analysis?.ai_insights || {};
        const improvements =
          aiInsights?.improvement_areas && aiInsights.improvement_areas.length
            ? aiInsights.improvement_areas
                .slice(0, 3)
                .map((i: any) => `${i.area} (${i.priority}): ${i.suggestion}`)
                .join('\n')
            : null;
        const hook = aiInsights?.hook_assessment;
        const sectionFeedback = Array.isArray(aiInsights?.section_feedback) ? aiInsights.section_feedback.slice(0, 2) : [];
        const lineFixes = Array.isArray(aiInsights?.line_fixes) ? aiInsights.line_fixes.slice(0, 3) : [];
        const syllables = Array.isArray(aiInsights?.syllable_counts) ? aiInsights.syllable_counts : [];
        const cadenceNotes = aiInsights?.cadence_notes;

        let details = `Score: ${score}\nKey Themes: ${themes || 'N/A'}`;
        if (lyricsQuality.rhymeScheme) details += `\nRhyme Scheme: ${lyricsQuality.rhymeScheme}`;
        if (lyricsQuality.wordplay) details += `\nWordplay: ${lyricsQuality.wordplay}`;
        if (lyricsQuality.syllableRhythm) details += `\nSyllable & Rhythm: ${lyricsQuality.syllableRhythm}`;
        if (lyricsQuality.hookCatchiness) details += `\nHook Catchiness: ${lyricsQuality.hookCatchiness}/10`;
        if (lyricsQuality.complexity) details += `\nComplexity: ${lyricsQuality.complexity}`;
        if (aiInsights.rhyme_density) details += `\nRhyme Density: ${aiInsights.rhyme_density}`;
        if (aiInsights.vocal_delivery) details += `\nVocal Delivery: ${aiInsights.vocal_delivery}`;
        if (aiInsights.production_notes && aiInsights.production_notes.length) {
          details += `\nProduction Notes: ${aiInsights.production_notes.slice(0, 2).join('; ')}`;
        }
        if (aiInsights.imagery_notes) details += `\nImagery: ${aiInsights.imagery_notes}`;
        if (aiInsights.story_clarity) details += `\nStory: ${aiInsights.story_clarity}`;
        if (cadenceNotes) details += `\nCadence: ${cadenceNotes}`;
        if (hook) {
          details += `\nHook: ${hook.hook_strength}`;
          if (hook.quick_fixes?.length) details += ` | Fixes: ${hook.quick_fixes.slice(0, 2).join('; ')}`;
        }
        if (syllables.length) details += `\nSyllables/line: ${syllables.slice(0, 8).join(', ')}${syllables.length > 8 ? '...' : ''}`;
        if (improvements) details += `\nTop Fixes:\n${improvements}`;
        if (sectionFeedback.length) {
          const sections = sectionFeedback
            .map((s: any) => `${s.section}: ${[...(s.strengths || []), ...(s.issues || []), ...(s.fixes || [])].slice(0, 2).join('; ')}`)
            .join('\n');
          details += `\nSections:\n${sections}`;
        }
        if (lineFixes.length) {
          const fixes = lineFixes.map((f: any) => `Line ${f.line}: ${f.issue} → ${f.rewrite}${f.syllables ? ` (${f.syllables} syllables)` : ''}`).join('\n');
          details += `\nLine Fixes:\n${fixes}`;
        }

        addMessage(`📘 **Lyrics Analysis for ${song.name}:**\n${details}`, 'lyrics-analysis');

        return data.analysis;
      }
      return null;
    } catch (error) {
      console.error('Lyrics analysis error:', error);
      toast({
        title: "Lyrics Analysis Failed",
        description: "Unable to analyze lyrics. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsAnalyzingLyrics(prev => {
        const newMap = new Map(prev);
        newMap.delete(songId);
        return newMap;
      });
    }
  };

  const transcribeAndAnalyzeSong = async (song: Song) => {
    const songId = song.id.toString();
    setIsTranscribeAndAnalyze(prev => {
      const newMap = new Map(prev);
      newMap.set(songId, true);
      return newMap;
    });
    const lyrics = await transcribeSong(song);
    if (lyrics) {
      await analyzeLyrics(song, lyrics);
    }
    setIsTranscribeAndAnalyze(prev => {
      const newMap = new Map(prev);
      newMap.delete(songId);
      return newMap;
    });
  };

  const registerSongTrack = useCallback((song: Song) => {
    const audioUrl = (song as any).url || (song as any).audioUrl || (song as any).songURL || song.accessibleUrl;
    if (!audioUrl) return;
    const trackId = `song-${song.id ?? audioUrl}`;
    const exists = tracks.some((track) => track.id === trackId || track.audioUrl === audioUrl);
    if (exists) return;
    addTrack({
      id: trackId,
      name: song.name || 'Uploaded Audio',
      type: 'audio',
      audioUrl,
      source: 'upload',
      lengthBars: 8,
      startBar: 0,
    });
  }, [tracks, addTrack]);

  const { data: songs, isLoading: songsLoading, refetch } = useQuery<Song[]>({
    queryKey: ['/api/songs'],
    initialData: [],
  });

  // Load songs when component mounts
  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (selectedSong) {
      registerSongTrack(selectedSong);
    }
  }, [selectedSong, registerSongTrack]);

  const findSongById = useCallback(
    (id: string | null | undefined) => {
      if (!id) return undefined;
      return songs?.find((s) => s.id?.toString() === id);
    },
    [songs]
  );

  const getSongAudioUrl = (song: Song | undefined | null) =>
    song
      ? (song as any).url || song.accessibleUrl || song.originalUrl || (song as any).songURL
      : undefined;

  useEffect(() => {
    if (!speechSongId) {
      setSpeechTranscript('');
      setSpeechWords([]);
      setSpeechPreviewUrl(null);
      setSpeechPreviewId(null);
      return;
    }
    const existing = transcriptions.get(speechSongId);
    if (existing) {
      setSpeechTranscript(existing);
    }
  }, [speechSongId, transcriptions]);

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
      registerSongTrack(newSong);
      setSelectedSong(newSong);
      
      // Emit event for other components
      const audioUrl = (newSong as any).url || newSong.accessibleUrl || newSong.originalUrl;
      emitEvent('song:uploaded', {
        songId: newSong.id.toString(),
        songName: newSong.name,
        audioUrl: audioUrl
      });
      
      toast({
        title: "Song Uploaded",
        description: `${newSong.name} has been added to your library! Starting auto-transcription...`,
      });

      // Auto-transcribe newly uploaded song
      transcribeSong(newSong);
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

  const deleteSongMutation = useMutation({
    mutationFn: async (songId: string) => {
      const response = await apiRequest("DELETE", `/api/songs/${songId}`);
      if (!response.ok) {
        throw new Error("Failed to delete song");
      }
      return songId;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      toast({
        title: "Song Deleted",
        description: "Song removed from library",
      });
      // If deleted song was selected, clear selection
      if (selectedSong?.id.toString() === id) {
        setSelectedSong(null);
        studioContext.setCurrentUploadedSong(null, null);
      }
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Could not delete song. Please try again.",
        variant: "destructive",
      });
    }
  });

  const runSpeechTranscribe = async () => {
    const song = findSongById(speechSongId);
    if (!song) {
      toast({
        title: "Choose a song first",
        description: "Select an uploaded song to run speech correction.",
        variant: "destructive",
      });
      return;
    }

    const audioUrl = getSongAudioUrl(song);
    setSpeechLoading((p) => ({ ...p, transcribe: true }));

    try {
      const response = await apiRequest("POST", "/api/speech-correction/transcribe", {
        fileId: song.id,
        fileUrl: audioUrl,
      });
      const data = await response.json();
      if (data.transcript) {
        setSpeechTranscript(data.transcript);
      }
      if (Array.isArray(data.words)) {
        setSpeechWords(data.words);
      }
      toast({
        title: "Speech transcript ready",
        description: "Word-level transcript loaded for editing.",
      });
    } catch (error) {
      console.error("Speech correction transcribe error:", error);
      toast({
        title: "Transcription failed",
        description: "Could not get word-level transcript.",
        variant: "destructive",
      });
    } finally {
      setSpeechLoading((p) => ({ ...p, transcribe: false }));
    }
  };

  const runSpeechPreview = async () => {
    const song = findSongById(speechSongId);
    if (!song) {
      toast({
        title: "Choose a song first",
        description: "Select an uploaded song to preview corrections.",
        variant: "destructive",
      });
      return;
    }
    if (!speechTranscript.trim()) {
      toast({
        title: "Transcript is empty",
        description: "Add or import a transcript before previewing.",
        variant: "destructive",
      });
      return;
    }

    setSpeechLoading((p) => ({ ...p, preview: true }));
    try {
      const response = await apiRequest("POST", "/api/speech-correction/preview", {
        transcriptEdits: speechTranscript,
        wordTiming: speechWords,
        guideAudioId: song.id,
        keepTiming: true,
      });
      const data = await response.json();
      setSpeechPreviewUrl(data.previewUrl || data.url || null);
      setSpeechPreviewId(data.previewId || data.id || null);
      if (Array.isArray(data.alignedWords)) {
        setSpeechWords(data.alignedWords);
      }
      toast({
        title: "Preview ready",
        description: "Listen and compare with the original.",
      });
    } catch (error) {
      console.error("Speech correction preview error:", error);
      toast({
        title: "Preview failed",
        description: "Could not generate preview.",
        variant: "destructive",
      });
    } finally {
      setSpeechLoading((p) => ({ ...p, preview: false }));
    }
  };

  const runSpeechCommit = async () => {
    if (!speechPreviewId) {
      toast({
        title: "No preview to commit",
        description: "Generate a preview first.",
        variant: "destructive",
      });
      return;
    }
    setSpeechLoading((p) => ({ ...p, commit: true }));
    try {
      const response = await apiRequest("POST", "/api/speech-correction/commit", {
        previewId: speechPreviewId,
      });
      const data = await response.json().catch(() => ({}));
      if (data.finalStemUrl) {
        setSpeechPreviewUrl(data.finalStemUrl);
      }
      toast({
        title: "Committed",
        description: "Corrected vocal saved as a new version.",
      });
    } catch (error) {
      console.error("Speech correction commit error:", error);
      toast({
        title: "Commit failed",
        description: "Could not save corrected vocal.",
        variant: "destructive",
      });
    } finally {
      setSpeechLoading((p) => ({ ...p, commit: false }));
    }
  };

  const getUploadParameters = async (file?: File) => {
    try {
      const fileName = file?.name || '';
      const format = fileName.split('.').pop()?.toLowerCase() || '';
      
      const response = await apiRequest("POST", "/api/objects/upload", {
        fileName,
        format
      });
      
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
      // Try multiple URL sources in order of preference (including legacy songURL for backward compatibility)
      let accessibleURL = song.accessibleUrl || song.originalUrl || (song as any).songURL;
      const songFormat = (song.format || '').toLowerCase();
      
      if (!accessibleURL) {
        throw new Error("No URL available for this song");
      }

      // Check format
      const isMP3 = songFormat === 'mp3' || accessibleURL.toLowerCase().includes('.mp3');
      const isM4A = songFormat === 'm4a' || songFormat === 'mp4' || songFormat === 'aac' || 
                    accessibleURL.toLowerCase().includes('.m4a');
      const isConverted = accessibleURL.includes('/api/songs/converted/') || accessibleURL.includes('/api/songs/convert-and-play/');

      // FOR ALL NON-MP3 FILES: Always use conversion endpoint (M4A, WAV, etc don't play reliably)
      if (!isMP3 && !isConverted) {
        console.log('🔄 Non-MP3 detected - using server conversion immediately');
        
        // Extract file ID from URL
        let fileId = '';
        if (accessibleURL.includes('/api/internal/uploads/')) {
          const parts = accessibleURL.split('/api/internal/uploads/');
          if (parts.length > 1) {
            fileId = decodeURIComponent(parts[1].split('?')[0]);
          }
        } else if (accessibleURL.includes('/uploads/')) {
          const parts = accessibleURL.split('/uploads/');
          if (parts.length > 1) {
            fileId = decodeURIComponent(parts[1].split('?')[0]);
          }
        } else if (accessibleURL.includes('/objects/')) {
          const parts = accessibleURL.split('/objects/');
          if (parts.length > 1) {
            fileId = decodeURIComponent(parts[1].split('?')[0]);
          }
        }
        
        if (fileId) {
          // Use the conversion endpoint
          accessibleURL = `/api/songs/convert-and-play/${encodeURIComponent(fileId)}`;
          console.log('🎵 Using conversion URL:', accessibleURL);
        }
      }

      // Fix internal URLs to ensure they're accessible
      if (accessibleURL.includes('/api/internal/uploads/')) {
        const timestamp = Date.now();
        accessibleURL = accessibleURL.includes('?') 
          ? `${accessibleURL}&t=${timestamp}&direct=true`
          : `${accessibleURL}?t=${timestamp}&direct=true`;
      }

      // For M4A files that haven't been converted, add format hint
      if (isM4A && !isConverted) {
        accessibleURL = accessibleURL.includes('?') 
          ? `${accessibleURL}&format=mp4`
          : `${accessibleURL}?format=mp4`;
      }

      // For MP3 files or converted files, add cache-busting
      if (isMP3 || isConverted) {
        const timestamp = Date.now();
        accessibleURL = accessibleURL.includes('?') 
          ? `${accessibleURL}&t=${timestamp}`
          : `${accessibleURL}?t=${timestamp}`;
      }

      console.log(`🎵 Attempting to play: ${song.name} (format: ${songFormat}) from URL: ${accessibleURL.substring(0, 100)}...`);

      // Stop any currently playing audio
      if (studioContext.uploadedSongAudio) {
        studioContext.uploadedSongAudio.pause();
        studioContext.uploadedSongAudio.src = '';
      }

      // Create fresh audio element and store it immediately so Transport can see it
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.autoplay = false;
      audio.muted = false;
      audio.volume = 1;
      
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
        if (isFormatIssue) {
          console.log('🔄 Trying server-converted audio...');
          
          // Extract file ID from URL and use conversion endpoint
          // Handle multiple URL formats:
          // - /api/internal/uploads/songs%2Fuser123%2Ffile.m4a
          // - /api/internal/uploads/songs/user123/file.m4a
          // - /uploads/songs/file.m4a
          let fileId = '';
          
          if (accessibleURL.includes('/api/internal/uploads/')) {
            const parts = accessibleURL.split('/api/internal/uploads/');
            if (parts.length > 1) {
              fileId = decodeURIComponent(parts[1].split('?')[0]); // Decode and remove query params
            }
          } else if (accessibleURL.includes('/uploads/')) {
            const parts = accessibleURL.split('/uploads/');
            if (parts.length > 1) {
              fileId = decodeURIComponent(parts[1].split('?')[0]); // Decode and remove query params
            }
          }
          
          console.log(`🔄 Extracted fileId for conversion: ${fileId}`);
          
          if (!fileId) {
            console.error('❌ Could not extract fileId from URL:', accessibleURL);
            toast({
              title: "⚠️ Playback Failed",
              description: `Cannot play ${song.name}. Audio format not supported by your browser. M4A files may not work in all browsers. Try re-uploading as MP3 or WAV.`,
              variant: "destructive",
              duration: 8000,
            });
            studioContext.setCurrentUploadedSong(null, null);
            return;
          }
          
          const convertedURL = `/api/songs/converted/${encodeURIComponent(fileId)}`;
          
          const convertedAudio = new Audio();
          convertedAudio.crossOrigin = "anonymous";
          
          convertedAudio.addEventListener('loadedmetadata', () => {
            console.log('✅ Server conversion worked for:', song.name);
            studioContext.setCurrentUploadedSong(song, convertedAudio);
            toast({
              title: "🎵 Song Converted & Ready",
              description: `${song.name} converted to browser-friendly format. Ready to play!`,
            });
          });
          
          convertedAudio.addEventListener('error', () => {
            // If conversion fails, show helpful message based on format field
            if (isM4A) {
              errorMessage += '. M4A files may not work in all browsers. Try re-uploading as MP3 or WAV.';
            } else if (isMP3) {
              errorMessage += '. This MP3 may use an unsupported encoding or bitrate. Server conversion failed - try re-uploading a standard MP3 (128-320 kbps).';
            } else {
              errorMessage += '. This audio format is not supported. Try converting to MP3 or WAV format.';
            }
            
            toast({
              title: "⚠️ Playback Failed",
              description: `Cannot play ${song.name}. ${errorMessage}`,
              variant: "destructive",
              duration: 8000,
            });
            
            studioContext.setCurrentUploadedSong(null, null);
          });
          
          convertedAudio.src = convertedURL;
          return; // Don't show the original error yet
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
      audio.preload = "auto";
      
      // Initialize/Resume professional audio context
      await professionalAudio.initialize();
      const audioCtx = professionalAudio.getAudioContext();
      const masterBus = professionalAudio.getMasterBus();
      
      if (audioCtx && masterBus) {
        // Create source and connect to professional audio graph
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(masterBus);
        console.log('🎛️ Routed uploaded song through professional master bus');
      }
      
      // Initialize Tone.js if needed (requires user interaction)
      if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
        await Tone.start();
        console.log('🎵 Tone.js AudioContext started');
      }
      
      // Store in context for Global Transport to play
      studioContext.setCurrentUploadedSong(song, audio);
      // Broadcast to Astutely/global listeners so any view can route playback
      window.dispatchEvent(new CustomEvent('astutely:load', {
        detail: {
          song,
          audio,
          url: accessibleURL,
          name: song.name,
          source: 'song-uploader'
        }
      }));
      
      // Start playback immediately
      try {
        // Ensure the element is ready
        await audio.play();
        console.log('▶️ Playback started for:', song.name);
      } catch (playError) {
        console.warn('⚠️ Auto-play blocked, user interaction required:', playError);
      }
      
      // Also load into global audio player for persistent playback across navigation
      window.dispatchEvent(new CustomEvent('globalAudio:load', {
        detail: { name: song.name, url: accessibleURL, type: 'song', autoplay: true }
      }));
      
      toast({
        title: "Song Playing",
        description: `Now playing: ${song.name}`,
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

  // Helper function to map Recommendation to SongIssue
  const mapRecommendationToIssue = (rec: Recommendation): SongIssue | null => {
    // Map category to issue type
    let type: SongIssue['type'];
    const category = rec.category;
    
    if (['mix_balance', 'vocal_effects', 'production', 'instrumentation'].includes(category)) {
      type = 'production';
    } else if (category === 'tempo') {
      type = 'rhythm';
    } else if (category === 'melody') {
      type = 'melody';
    } else if (category === 'structure') {
      type = 'structure';
    } else if (category === 'lyrics') {
      type = 'lyrics' as SongIssue['type'];
    } else {
      // Other unsupported categories
      console.warn('⚠️ Unsupported recommendation category:', category);
      return null;
    }
    
    // Map target tool
    let targetTool: SongIssue['targetTool'] | undefined;
    if (rec.targetTool === 'mix-studio') targetTool = 'mixer';
    else if (rec.targetTool === 'beat-studio') targetTool = 'beat-maker';
    else if (rec.targetTool === 'piano-roll') targetTool = 'piano-roll';
    else if (rec.targetTool === 'lyrics-lab' || rec.targetTool === 'unified-studio') targetTool = 'composition';
    
    return {
      type,
      severity: rec.severity,
      description: rec.message,
      recommendation: rec.message,
      targetTool,
      measureRange: rec.navigationPayload?.params?.measureRange as [number, number] | undefined
    };
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
      
      // Store analysis per-song
      setSongAnalyses(prev => {
        const newMap = new Map(prev);
        newMap.set(song.id, analysis);
        return newMap;
      });
      
      // Create or update SongWorkSession for this analysis
      let sessionId = sessionIdsBySong.get(song.id);
      if (!sessionId) {
        // Create new session
        sessionId = createSession({
          name: song.name,
          audioUrl: song.accessibleUrl || song.originalUrl
        });
        
        setSessionIdsBySong(prev => {
          const newMap = new Map(prev);
          newMap.set(song.id, sessionId!);
          return newMap;
        });
      }
      
      // Map recommendations to SongIssues
      const issues: SongIssue[] = (analysis.actionableRecommendations || [])
        .map(mapRecommendationToIssue)
        .filter((issue: SongIssue | null): issue is SongIssue => issue !== null);
      
      // Update session with analysis data
      updateSession(sessionId, {
        analysis: {
          bpm: analysis.estimatedBPM,
          key: analysis.keySignature,
          timeSignature: analysis.timeSignature,
          duration: song.duration ?? undefined,
          issues
        }
      });
      
      console.log('✅ SongWorkSession created/updated:', { sessionId, songId: song.id, issuesCount: issues.length });
      
      // Auto-expand the analysis card
      setExpandedAnalysis(song.id);
      
      toast({
        title: "Analysis Complete!",
        description: `${song.name} analyzed - see results below`,
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

      // Add message to AI Assistant using context with recommendations
      console.log('🎵 Sending analysis to AI Assistant via context:', analysisMessage.substring(0, 100) + '...');
      console.log('🎯 Including recommendations:', analysis.actionableRecommendations?.length || 0);
      addMessage(analysisMessage, 'song-analysis', analysis.actionableRecommendations);

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
      const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
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
      const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
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
      const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
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
      const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
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

  // Suno API - Add Instrumental
  const processSunoAddInstrumental = async (song: Song, prompt: string) => {
    setSunoProcessing(true);
    try {
      const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
      const response = await apiRequest('POST', '/api/songs/suno/add-instrumental', {
        audioUrl,
        prompt,
        model: sunoModel
      });
      
      const data = await response.json();
      toast({
        title: "Adding Instrumental Started!",
        description: `Adding AI instrumental to "${song.name}". This may take a few minutes.`,
      });

      addMessage(`🎵 Started adding instrumental to "${song.name}": ${prompt}`, 'suno-add-instrumental');
    } catch (error) {
      toast({
        title: "Add Instrumental Failed",
        description: error instanceof Error ? error.message : "Failed to add instrumental",
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
          songUrl={studioContext.currentUploadedSong.accessibleUrl || studioContext.currentUploadedSong.originalUrl || (studioContext.currentUploadedSong as any).songURL || ''}
          songName={studioContext.currentUploadedSong.name}
          recommendations={songAnalysis.toolRecommendations || []}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden text-white">
      <div className="p-6 border-b border-gray-600 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-heading font-bold text-white">Song Upload & Library</h2>
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

            <Card className="border-blue-700/60 bg-gray-900/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <i className="fas fa-microphone-alt text-blue-400"></i>
                  Speech Correction (Transcript → Regenerate Vocal)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Select song</Label>
                    <Select value={speechSongId} onValueChange={(v) => setSpeechSongId(v)}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 h-10">
                        <SelectValue placeholder="Choose uploaded song" />
                      </SelectTrigger>
                      <SelectContent>
                        {songs.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.name || `Song ${s.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={runSpeechTranscribe}
                      disabled={!speechSongId || speechLoading.transcribe}
                      className="bg-orange-600 hover:bg-orange-500"
                    >
                      {speechLoading.transcribe ? <i className="fas fa-spinner fa-spin mr-1"></i> : <FileText className="w-3 h-3 mr-1" />}
                      Word Transcribe
                    </Button>
                    <Button
                      size="sm"
                      onClick={runSpeechPreview}
                      disabled={!speechSongId || speechLoading.preview}
                      className="bg-purple-600 hover:bg-purple-500"
                    >
                      {speechLoading.preview ? <i className="fas fa-spinner fa-spin mr-1"></i> : <Sparkles className="w-3 h-3 mr-1" />}
                      Preview Regen
                    </Button>
                    <Button
                      size="sm"
                      onClick={runSpeechCommit}
                      disabled={!speechPreviewId || speechLoading.commit}
                      className="bg-green-600 hover:bg-green-500"
                    >
                      {speechLoading.commit ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-save mr-1"></i>}
                      Commit
                    </Button>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>Words: <span className="text-white font-semibold">{speechWords.length}</span></div>
                    {speechPreviewId && <div>Preview ID: <span className="text-blue-300">{speechPreviewId}</span></div>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-gray-300">Edit Transcript</Label>
                  <Textarea
                    value={speechTranscript}
                    onChange={(e) => setSpeechTranscript(e.target.value)}
                    rows={6}
                    placeholder="Edit the transcript here..."
                    className="bg-gray-800 border-gray-700 text-sm"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400">Original</div>
                    <audio
                      controls
                      className="w-full"
                      src={getSongAudioUrl(findSongById(speechSongId))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400">Preview</div>
                    <audio
                      controls
                      className="w-full"
                      src={speechPreviewUrl || undefined}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

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
                        <Button
                          size="sm"
                          onClick={() => transcribeSong(song)}
                          disabled={isTranscribing.get(song.id.toString())}
                          className="bg-orange-600 hover:bg-orange-500"
                          data-testid={`button-transcribe-song-${song.id}`}
                        >
                          {isTranscribing.get(song.id.toString()) ? (
                            <i className="fas fa-spinner fa-spin mr-1"></i>
                          ) : (
                            <FileText className="w-3 h-3 mr-1" />
                          )}
                          Transcribe
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => transcribeAndAnalyzeSong(song)}
                          disabled={
                            isTranscribing.get(song.id.toString()) ||
                            isAnalyzingLyrics.get(song.id.toString()) ||
                            isTranscribeAndAnalyze.get(song.id.toString())
                          }
                          className="bg-pink-600 hover:bg-pink-500"
                          data-testid={`button-transcribe-analyze-song-${song.id}`}
                        >
                          {isTranscribeAndAnalyze.get(song.id.toString()) ? (
                            <i className="fas fa-spinner fa-spin mr-1"></i>
                          ) : (
                            <Sparkles className="w-3 h-3 mr-1" />
                          )}
                          Transcribe + Analyze
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => analyzeLyrics(song)}
                          disabled={
                            !transcriptions.get(song.id.toString()) ||
                            isAnalyzingLyrics.get(song.id.toString())
                          }
                          className="bg-indigo-600 hover:bg-indigo-500"
                          data-testid={`button-analyze-lyrics-${song.id}`}
                        >
                          {isAnalyzingLyrics.get(song.id.toString()) ? (
                            <i className="fas fa-spinner fa-spin mr-1"></i>
                          ) : (
                            <FileText className="w-3 h-3 mr-1" />
                          )}
                          Analyze Lyrics
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            // Add to timeline track store
                            registerSongTrack(song);
                            
                            // Also dispatch event for MasterMultiTrackPlayer
                            const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
                            if (audioUrl) {
                              window.dispatchEvent(new CustomEvent('importToMultiTrack', {
                                detail: {
                                  type: 'audio',
                                  name: song.name,
                                  audioUrl: audioUrl,
                                }
                              }));
                            }
                            
                            toast({
                              title: "Added to Multi-Track!",
                              description: `"${song.name}" is now available in the Multi-Track Studio for layering and recording.`,
                            });
                          }}
                          className="bg-blue-600 hover:bg-blue-500"
                          data-testid={`button-add-to-tracks-${song.id}`}
                        >
                          <i className="fas fa-layer-group mr-1"></i>
                          Add to Tracks
                        </Button>
                        
                        <Button
                          size="sm"
                          onClick={() => {
                            const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
                            if (audioUrl) {
                              const link = document.createElement('a');
                              link.href = audioUrl;
                              link.download = song.name || 'song';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              toast({ title: "Download Started", description: `Downloading ${song.name}` });
                            }
                          }}
                          className="bg-cyan-600 hover:bg-cyan-500"
                          data-testid={`button-download-song-${song.id}`}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (window.confirm(`Delete "${song.name}"? This cannot be undone.`)) {
                              deleteSongMutation.mutate(song.id.toString());
                            }
                          }}
                          className="bg-red-600 hover:bg-red-500"
                          data-testid={`button-delete-song-${song.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        
                        {/* Share / Public Toggle */}
                        <Button
                          size="sm"
                          onClick={async () => {
                            const newPublicState = !song.isPublic;
                            try {
                              const response = await apiRequest('PATCH', `/api/songs/${song.id}/public`, {
                                isPublic: newPublicState
                              });
                              const data = await response.json();
                              
                              if (data.success) {
                                // Refresh song list
                                queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
                                
                                if (newPublicState && data.shareUrl) {
                                  const fullUrl = `${window.location.origin}${data.shareUrl}`;
                                  await navigator.clipboard.writeText(fullUrl);
                                  toast({
                                    title: "Song is now public!",
                                    description: "Share link copied to clipboard.",
                                  });
                                } else {
                                  toast({
                                    title: "Song is now private",
                                    description: "Only you can access this song.",
                                  });
                                }
                              }
                            } catch (error) {
                              toast({
                                title: "Failed to update",
                                description: "Could not change song visibility.",
                                variant: "destructive"
                              });
                            }
                          }}
                          className={song.isPublic 
                            ? "bg-green-600 hover:bg-green-500" 
                            : "bg-gray-600 hover:bg-gray-500"
                          }
                          title={song.isPublic ? "Click to make private" : "Click to make public & copy link"}
                        >
                          {song.isPublic ? (
                            <>
                              <Globe className="w-3 h-3 mr-1" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 mr-1" />
                              Private
                            </>
                          )}
                        </Button>
                        
                        {/* Copy Share Link (only if public) */}
                        {song.isPublic && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const shareUrl = `${window.location.origin}/s/${song.id}`;
                              await navigator.clipboard.writeText(shareUrl);
                              toast({
                                title: "Link copied!",
                                description: shareUrl,
                              });
                            }}
                            title="Copy share link"
                          >
                            <Share2 className="w-3 h-3" />
                          </Button>
                        )}
                        
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
                            <SelectItem value="add-instrumental">
                              <div className="flex items-center">
                                <Plus className="w-3 h-3 mr-2" />
                                Add AI Instrumental
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

                      
                      {/* Inline Analysis Results */}
                      {songAnalyses.get(song.id) && (
                        <div className="mt-4 border border-purple-500/30 rounded-md bg-purple-950/20 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-purple-300 flex items-center gap-2">
                              <i className="fas fa-chart-line"></i>
                              Analysis Results
                            </h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedAnalysis(expandedAnalysis === song.id ? null : song.id)}
                              data-testid={`button-toggle-analysis-${song.id}`}
                            >
                              {expandedAnalysis === song.id ? 'Collapse' : 'Expand'}
                            </Button>
                          </div>
                          
                          {expandedAnalysis === song.id && (() => {
                            const analysis = songAnalyses.get(song.id);
                            const lyrics = transcriptions.get(song.id.toString());
                            const lyricsAnalysis = lyricsAnalyses.get(song.id.toString());
                            
                            return (
                              <div className="space-y-4">
                                {/* Transcribed Lyrics */}
                                {lyrics && (
                                  <div className="bg-gray-800/50 rounded p-4 border border-orange-500/30">
                                    <h5 className="text-sm font-semibold text-orange-300 mb-2 flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      Transcribed Lyrics
                                    </h5>
                                    <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto pr-2">
                                      {lyrics}
                                    </div>
                                  </div>
                                )}

                                {/* Quick Metrics */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  {analysis?.estimatedBPM && (
                                    <div className="bg-gray-800/50 rounded p-2">
                                      <div className="text-gray-400 text-xs">BPM</div>
                                      <div className="font-bold text-purple-300">{analysis.estimatedBPM}</div>
                                    </div>
                                  )}
                                  {analysis?.keySignature && (
                                    <div className="bg-gray-800/50 rounded p-2">
                                      <div className="text-gray-400 text-xs">Key</div>
                                      <div className="font-bold text-purple-300">{analysis.keySignature}</div>
                                    </div>
                                  )}
                                  {analysis?.genre && (
                                    <div className="bg-gray-800/50 rounded p-2">
                                      <div className="text-gray-400 text-xs">Genre</div>
                                      <div className="font-bold text-purple-300">{analysis.genre}</div>
                                    </div>
                                  )}
                                  {analysis?.overallScore && (
                                    <div className="bg-gray-800/50 rounded p-2">
                                      <div className="text-gray-400 text-xs">Score</div>
                                      <div className="font-bold text-green-400">{analysis.overallScore}/10</div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Lyrics Analysis Metrics */}
                                {lyricsAnalysis && (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                      {lyricsAnalysis.overall_rating?.score && (
                                        <div className="bg-gray-800/50 rounded p-2">
                                          <div className="text-gray-400 text-xs">Lyrics Score</div>
                                          <div className="font-bold text-green-400">{lyricsAnalysis.overall_rating.score}/10</div>
                                        </div>
                                      )}
                                      {lyricsAnalysis.hook_metrics?.score !== undefined && (
                                        <div className="bg-gray-800/50 rounded p-2">
                                          <div className="text-gray-400 text-xs">Hook Catchiness</div>
                                          <div className="font-bold text-purple-300">{lyricsAnalysis.hook_metrics.score}/100</div>
                                        </div>
                                      )}
                                      {lyricsAnalysis.lexical_diversity !== undefined && (
                                        <div className="bg-gray-800/50 rounded p-2">
                                          <div className="text-gray-400 text-xs">Lexical Diversity</div>
                                          <div className="font-bold text-blue-300">{(lyricsAnalysis.lexical_diversity * 100).toFixed(0)}%</div>
                                        </div>
                                      )}
                                      {lyricsAnalysis.flow_analysis?.rhythm_consistency !== undefined && (
                                        <div className="bg-gray-800/50 rounded p-2">
                                          <div className="text-gray-400 text-xs">Flow Consistency</div>
                                          <div className="font-bold text-blue-300">{(lyricsAnalysis.flow_analysis.rhythm_consistency * 100).toFixed(0)}%</div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {lyricsAnalysis.hook_metrics && (
                                      <div className="bg-gray-800/50 rounded p-3 border border-purple-500/30">
                                        <h5 className="text-sm font-semibold text-purple-300 mb-1">Hook Insights</h5>
                                        {lyricsAnalysis.hook_metrics.repeated_phrases?.length > 0 && (
                                          <div className="text-xs text-gray-300 mb-1">
                                            <span className="font-semibold">Repeated Phrases:</span> {lyricsAnalysis.hook_metrics.repeated_phrases.join(', ')}
                                          </div>
                                        )}
                                        {lyricsAnalysis.hook_metrics.recommendations?.length > 0 && (
                                          <ul className="list-disc list-inside text-xs text-gray-300">
                                            {lyricsAnalysis.hook_metrics.recommendations.map((r: string, idx: number) => (
                                              <li key={idx}>{r}</li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    )}
                                    
                                    {lyricsAnalysis.breath_map && (
                                      <div className="bg-gray-800/50 rounded p-3 border border-blue-500/30 max-h-40 overflow-y-auto">
                                        <h5 className="text-sm font-semibold text-blue-300 mb-1">Breath Map</h5>
                                        <div className="text-[11px] text-gray-300 grid grid-cols-3 gap-1">
                                          {lyricsAnalysis.breath_map.map((entry: any) => (
                                            <div key={entry.line} className="flex justify-between">
                                              <span>Line {entry.line}</span>
                                              <span>{entry.syllables} syll</span>
                                              <span className={entry.breath_risk === 'high' ? 'text-red-400' : entry.breath_risk === 'medium' ? 'text-yellow-300' : 'text-green-400'}>
                                                {entry.breath_risk}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {lyricsAnalysis.audience_fit && (
                                      <div className="bg-gray-800/50 rounded p-3 border border-green-500/30">
                                        <h5 className="text-sm font-semibold text-green-300 mb-1">Audience & Playlists</h5>
                                        {lyricsAnalysis.audience_fit.playlists && (
                                          <div className="text-xs text-gray-300 mb-1">
                                            <span className="font-semibold">Playlists:</span> {lyricsAnalysis.audience_fit.playlists.join(', ')}
                                          </div>
                                        )}
                                        {lyricsAnalysis.audience_fit.moods && (
                                          <div className="text-xs text-gray-300 mb-1">
                                            <span className="font-semibold">Moods:</span> {lyricsAnalysis.audience_fit.moods.join(', ')}
                                          </div>
                                        )}
                                        {lyricsAnalysis.audience_fit.marketingIdeas && (
                                          <ul className="list-disc list-inside text-xs text-gray-300">
                                            {lyricsAnalysis.audience_fit.marketingIdeas.map((idea: string, idx: number) => (
                                              <li key={idx}>{idea}</li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    )}
                                    
                                    {lyricsAnalysis.production_checklist && lyricsAnalysis.production_checklist.length > 0 && (
                                      <div className="bg-gray-800/50 rounded p-3 border border-yellow-500/30">
                                        <h5 className="text-sm font-semibold text-yellow-300 mb-1">Production Checklist</h5>
                                        <ul className="list-disc list-inside text-xs text-gray-300">
                                          {lyricsAnalysis.production_checklist.map((item: string, idx: number) => (
                                            <li key={idx}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {lyricsAnalysis.rewrite_suggestions && lyricsAnalysis.rewrite_suggestions.length > 0 && (
                                      <div className="bg-gray-800/50 rounded p-3 border border-red-500/30">
                                        <h5 className="text-sm font-semibold text-red-300 mb-1">Rewrite Suggestions</h5>
                                        <ul className="list-disc list-inside text-xs text-gray-300 max-h-32 overflow-y-auto">
                                          {lyricsAnalysis.rewrite_suggestions.map((s: any, idx: number) => (
                                            <li key={idx}>
                                              <span className="font-semibold">Line {s.line}:</span> {s.suggestion}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Recommendations */}
                                {analysis?.actionableRecommendations && analysis.actionableRecommendations.length > 0 && (
                                  <div>
                                    <RecommendationList 
                                      recommendations={analysis.actionableRecommendations} 
                                      sessionId={sessionIdsBySong.get(song.id)}
                                    />
                                  </div>
                                )}
                                <div className="text-xs text-gray-400 italic">
                                  Full analysis available in AI Assistant panel
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      
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
                Suno AI - {sunoAction === 'cover' ? 'Cover Song' : sunoAction === 'extend' ? 'Extend Song' : sunoAction === 'add-vocals' ? 'Add Vocals' : 'Add Instrumental'}
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

              {sunoAction === 'add-instrumental' && (
                <div>
                  <Label htmlFor="instrumental-prompt" className="text-white mb-2 block">
                    Instrumental Prompt
                  </Label>
                  <Input
                    id="instrumental-prompt"
                    placeholder="e.g., acoustic guitar, electronic synths, jazz piano"
                    value={sunoPrompt}
                    onChange={(e) => setSunoPrompt(e.target.value)}
                    className="bg-gray-700 text-white"
                    data-testid="input-suno-prompt"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Describe the instrumental style you want to add
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
                    } else if (sunoAction === 'add-instrumental' && sunoPrompt) {
                      processSunoAddInstrumental(selectedSong, sunoPrompt);
                    }
                    setSunoPrompt('');
                  }}
                  disabled={sunoProcessing || (sunoAction === 'cover' && !sunoPrompt) || (sunoAction === 'add-vocals' && !sunoPrompt) || (sunoAction === 'add-instrumental' && !sunoPrompt)}
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
