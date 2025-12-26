/**
 * Audio Detector Component
 * Real-time chord detection and BPM detection from audio
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Music, 
  Mic, 
  MicOff, 
  Upload, 
  Play, 
  Square, 
  RefreshCw,
  Activity,
  Gauge,
  Piano,
  Drum
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { audioDetection, ChordDetectionResult, BPMDetectionResult } from '@/lib/audioDetection';

interface AudioDetectorProps {
  onChordDetected?: (chord: ChordDetectionResult) => void;
  onBPMDetected?: (bpm: BPMDetectionResult) => void;
  onClose?: () => void;
}

export function AudioDetector({ onChordDetected, onBPMDetected, onClose }: AudioDetectorProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'chord' | 'bpm'>('chord');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chordResult, setChordResult] = useState<ChordDetectionResult | null>(null);
  const [bpmResult, setBpmResult] = useState<BPMDetectionResult | null>(null);
  const [chordHistory, setChordHistory] = useState<string[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  const stopListeningRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopListeningRef.current) {
        stopListeningRef.current();
      }
    };
  }, []);

  // Handle chord detection callback
  const handleChordDetected = useCallback((chord: ChordDetectionResult) => {
    setChordResult(chord);
    if (chord.confidence > 0.5 && chord.chord !== 'No chord detected') {
      setChordHistory(prev => {
        const newHistory = [chord.chord, ...prev.slice(0, 9)];
        return newHistory;
      });
    }
    onChordDetected?.(chord);
  }, [onChordDetected]);

  // Handle BPM detection callback
  const handleBPMDetected = useCallback((bpm: BPMDetectionResult) => {
    setBpmResult(bpm);
    onBPMDetected?.(bpm);
  }, [onBPMDetected]);

  // Start real-time listening
  const startListening = async () => {
    try {
      setIsListening(true);
      const stopFn = await audioDetection.startRealtimeAnalysis(
        handleChordDetected,
        handleBPMDetected
      );
      stopListeningRef.current = stopFn;
      toast({ title: '🎤 Listening', description: 'Analyzing audio in real-time...' });
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsListening(false);
      toast({ 
        title: 'Microphone Error', 
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive'
      });
    }
  };

  // Stop listening
  const stopListening = () => {
    if (stopListeningRef.current) {
      stopListeningRef.current();
      stopListeningRef.current = null;
    }
    setIsListening(false);
    toast({ title: '🔇 Stopped', description: 'Audio analysis stopped' });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      toast({ 
        title: 'Invalid File', 
        description: 'Please upload an audio file',
        variant: 'destructive'
      });
      return;
    }
    
    setAudioFile(file);
    toast({ title: '📁 File Loaded', description: file.name });
  };

  // Analyze uploaded file
  const analyzeFile = async () => {
    if (!audioFile) {
      toast({ 
        title: 'No File', 
        description: 'Please upload an audio file first',
        variant: 'destructive'
      });
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const result = await audioDetection.analyzeAudioFile(audioFile);
      setChordResult(result.chord);
      setBpmResult(result.bpm);
      
      if (result.chord.confidence > 0.5) {
        setChordHistory(prev => [result.chord.chord, ...prev.slice(0, 9)]);
      }
      
      onChordDetected?.(result.chord);
      onBPMDetected?.(result.bpm);
      
      toast({ 
        title: '✅ Analysis Complete', 
        description: `Chord: ${result.chord.chord}, BPM: ${result.bpm.bpm}`
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({ 
        title: 'Analysis Failed', 
        description: 'Could not analyze the audio file',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Clear results
  const clearResults = () => {
    setChordResult(null);
    setBpmResult(null);
    setChordHistory([]);
    setAudioFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get chord type badge variant
  const getChordBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    if (type.includes('Major')) return 'default';
    if (type.includes('Minor')) return 'secondary';
    if (type.includes('Diminished') || type.includes('Augmented')) return 'destructive';
    return 'outline';
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span>Audio Detector</span>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input Controls */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? 'destructive' : 'default'}
              className="flex items-center gap-2"
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Start Listening
                </>
              )}
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Audio
            </Button>
            
            {audioFile && (
              <Button
                onClick={analyzeFile}
                disabled={isAnalyzing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Analyze File
                  </>
                )}
              </Button>
            )}
            
            <Button variant="ghost" onClick={clearResults} className="flex items-center gap-2">
              <Square className="w-4 h-4" />
              Clear
            </Button>
          </div>

          {audioFile && (
            <div className="text-sm text-gray-400">
              📁 {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}

          {/* Tabs for Chord/BPM */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chord' | 'bpm')}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="chord" className="flex items-center gap-2">
                <Piano className="w-4 h-4" />
                Chord Detection
              </TabsTrigger>
              <TabsTrigger value="bpm" className="flex items-center gap-2">
                <Drum className="w-4 h-4" />
                BPM Detection
              </TabsTrigger>
            </TabsList>

            {/* Chord Detection Tab */}
            <TabsContent value="chord" className="space-y-4 mt-4">
              {chordResult ? (
                <div className="space-y-4">
                  {/* Main Chord Display */}
                  <div className="text-center p-6 bg-gray-800 rounded-lg">
                    <div className="text-4xl font-bold text-white mb-2">
                      {chordResult.chord}
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Badge variant={getChordBadgeVariant(chordResult.type)}>
                        {chordResult.type}
                      </Badge>
                      {chordResult.root && (
                        <Badge variant="outline">Root: {chordResult.root}</Badge>
                      )}
                    </div>
                    
                    {/* Confidence Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Confidence</span>
                        <span>{Math.round(chordResult.confidence * 100)}%</span>
                      </div>
                      <Progress 
                        value={chordResult.confidence * 100} 
                        className={`h-2 ${getConfidenceColor(chordResult.confidence)}`}
                      />
                    </div>
                  </div>

                  {/* Detected Notes */}
                  {chordResult.notes.length > 0 && (
                    <div className="p-4 bg-gray-800 rounded-lg">
                      <div className="text-sm text-gray-400 mb-2">Detected Notes:</div>
                      <div className="flex flex-wrap gap-2">
                        {chordResult.notes.map((note, i) => (
                          <Badge key={i} variant="secondary" className="text-lg">
                            {note}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frequencies */}
                  {chordResult.frequencies.length > 0 && (
                    <div className="p-4 bg-gray-800 rounded-lg">
                      <div className="text-sm text-gray-400 mb-2">Frequencies (Hz):</div>
                      <div className="flex flex-wrap gap-2">
                        {chordResult.frequencies.map((freq, i) => (
                          <Badge key={i} variant="outline" className="font-mono">
                            {freq.toFixed(1)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chord History */}
                  {chordHistory.length > 0 && (
                    <div className="p-4 bg-gray-800 rounded-lg">
                      <div className="text-sm text-gray-400 mb-2">Recent Chords:</div>
                      <div className="flex flex-wrap gap-2">
                        {chordHistory.map((chord, i) => (
                          <Badge 
                            key={i} 
                            variant={i === 0 ? 'default' : 'outline'}
                            className={i === 0 ? 'bg-blue-600' : ''}
                          >
                            {chord}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  <Piano className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Start listening or upload an audio file to detect chords</p>
                </div>
              )}
            </TabsContent>

            {/* BPM Detection Tab */}
            <TabsContent value="bpm" className="space-y-4 mt-4">
              {bpmResult && bpmResult.bpm > 0 ? (
                <div className="space-y-4">
                  {/* Main BPM Display */}
                  <div className="text-center p-6 bg-gray-800 rounded-lg">
                    <div className="text-6xl font-bold text-white mb-2">
                      {bpmResult.bpm}
                    </div>
                    <div className="text-xl text-gray-400 mb-4">BPM</div>
                    
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <Badge variant="secondary" className="text-lg">
                        {bpmResult.timeSignature}
                      </Badge>
                      <Badge variant="outline">
                        {bpmResult.beats.length} beats detected
                      </Badge>
                    </div>
                    
                    {/* Confidence Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Confidence</span>
                        <span>{Math.round(bpmResult.confidence * 100)}%</span>
                      </div>
                      <Progress 
                        value={bpmResult.confidence * 100} 
                        className={`h-2 ${getConfidenceColor(bpmResult.confidence)}`}
                      />
                    </div>
                  </div>

                  {/* Tempo Classification */}
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <div className="text-sm text-gray-400 mb-2">Tempo Classification:</div>
                    <div className="text-lg font-semibold">
                      {bpmResult.bpm < 70 ? '🐢 Largo (Very Slow)' :
                       bpmResult.bpm < 90 ? '🚶 Andante (Walking Pace)' :
                       bpmResult.bpm < 110 ? '🏃 Moderato (Moderate)' :
                       bpmResult.bpm < 130 ? '💨 Allegro (Fast)' :
                       bpmResult.bpm < 160 ? '🔥 Vivace (Very Fast)' :
                       '⚡ Presto (Extremely Fast)'}
                    </div>
                  </div>

                  {/* Suggested Uses */}
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <div className="text-sm text-gray-400 mb-2">Suggested Genres:</div>
                    <div className="flex flex-wrap gap-2">
                      {bpmResult.bpm >= 60 && bpmResult.bpm <= 80 && (
                        <>
                          <Badge>Hip-Hop</Badge>
                          <Badge>R&B</Badge>
                          <Badge>Downtempo</Badge>
                        </>
                      )}
                      {bpmResult.bpm >= 80 && bpmResult.bpm <= 100 && (
                        <>
                          <Badge>Pop</Badge>
                          <Badge>Reggae</Badge>
                          <Badge>Soul</Badge>
                        </>
                      )}
                      {bpmResult.bpm >= 100 && bpmResult.bpm <= 120 && (
                        <>
                          <Badge>House</Badge>
                          <Badge>Pop</Badge>
                          <Badge>Disco</Badge>
                        </>
                      )}
                      {bpmResult.bpm >= 120 && bpmResult.bpm <= 140 && (
                        <>
                          <Badge>EDM</Badge>
                          <Badge>Techno</Badge>
                          <Badge>Trance</Badge>
                        </>
                      )}
                      {bpmResult.bpm >= 140 && bpmResult.bpm <= 180 && (
                        <>
                          <Badge>Drum & Bass</Badge>
                          <Badge>Dubstep</Badge>
                          <Badge>Hardcore</Badge>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Beat Visualization */}
                  {bpmResult.beats.length > 0 && (
                    <div className="p-4 bg-gray-800 rounded-lg">
                      <div className="text-sm text-gray-400 mb-2">Beat Positions (first 16):</div>
                      <div className="flex flex-wrap gap-1">
                        {bpmResult.beats.slice(0, 16).map((beat, i) => (
                          <div 
                            key={i}
                            className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-xs font-mono"
                            title={`${beat.toFixed(2)}s`}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  <Gauge className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Start listening or upload an audio file to detect BPM</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Status Indicator */}
          {isListening && (
            <div className="flex items-center justify-center gap-2 text-green-400">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span>Listening for audio...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AudioDetector;
