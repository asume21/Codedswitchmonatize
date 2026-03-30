import React, { useState, useRef, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Save, Mic, MicOff, Play, Pause, Square } from 'lucide-react';
import { StudioAudioContext } from '@/pages/studio';

interface ExportOptions {
  format: 'wav' | 'mp3' | 'midi';
  quality: 'high' | 'medium' | 'low';
  sampleRate: number;
  bitDepth: number;
}

interface SaveData {
  name: string;
  description?: string;
  tracks: any[];
  bpm: number;
  key: string;
}

// ─── MIDI File Builder (Standard MIDI File Format 1) ────────────────
// Builds a real .mid binary file from track note data.

function writeVarLen(value: number): number[] {
  const bytes: number[] = [];
  let v = value & 0x0FFFFFFF;
  bytes.unshift(v & 0x7F);
  while ((v >>= 7) > 0) {
    bytes.unshift((v & 0x7F) | 0x80);
  }
  return bytes;
}

function noteNameToMidi(note: string, octave: number): number {
  const map: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
  };
  return (map[note] ?? 0) + (octave + 1) * 12;
}

function buildMidiFile(tracks: any[], bpm: number): Blob {
  const ticksPerBeat = 480;
  const trackChunks: Uint8Array[] = [];

  // Tempo track (track 0)
  const tempoTrack: number[] = [];
  // Set tempo meta event: FF 51 03 tt tt tt
  const microsecondsPerBeat = Math.round(60_000_000 / bpm);
  tempoTrack.push(0x00); // delta time
  tempoTrack.push(0xFF, 0x51, 0x03);
  tempoTrack.push((microsecondsPerBeat >> 16) & 0xFF);
  tempoTrack.push((microsecondsPerBeat >> 8) & 0xFF);
  tempoTrack.push(microsecondsPerBeat & 0xFF);
  // End of track
  tempoTrack.push(0x00, 0xFF, 0x2F, 0x00);
  trackChunks.push(buildTrackChunk(tempoTrack));

  // Note tracks
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    const notes: Array<{ note: string; octave: number; step: number; length: number; velocity: number }> =
      track.notes || track.data?.notes || [];
    if (notes.length === 0) continue;

    // Sort by step
    const sorted = [...notes].sort((a, b) => a.step - b.step);
    const events: Array<{ tick: number; data: number[] }> = [];

    // Track name meta event
    const nameBytes = Array.from(new TextEncoder().encode(track.name || `Track ${t + 1}`));
    events.push({ tick: 0, data: [0xFF, 0x03, nameBytes.length, ...nameBytes] });

    for (const n of sorted) {
      const startTick = Math.round(n.step * (ticksPerBeat / 4)); // step = 16th note
      const durationTicks = Math.max(1, Math.round((n.length || 1) * (ticksPerBeat / 4)));
      const midiNote = noteNameToMidi(n.note, n.octave ?? 4);
      const vel = Math.min(127, Math.max(1, n.velocity ?? 100));

      events.push({ tick: startTick, data: [0x90 | (t % 16), midiNote, vel] }); // note on
      events.push({ tick: startTick + durationTicks, data: [0x80 | (t % 16), midiNote, 0] }); // note off
    }

    // Sort all events by tick
    events.sort((a, b) => a.tick - b.tick);

    // Convert to delta-time bytes
    const trackBytes: number[] = [];
    let lastTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - lastTick);
      trackBytes.push(...writeVarLen(delta), ...ev.data);
      lastTick = ev.tick;
    }
    // End of track
    trackBytes.push(0x00, 0xFF, 0x2F, 0x00);
    trackChunks.push(buildTrackChunk(trackBytes));
  }

  // If no note tracks were generated, add an empty track
  if (trackChunks.length === 1) {
    trackChunks.push(buildTrackChunk([0x00, 0xFF, 0x2F, 0x00]));
  }

  // Header chunk: MThd
  const numTracks = trackChunks.length;
  const header = new Uint8Array([
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // chunk length = 6
    0x00, 0x01,             // format 1 (multi-track)
    (numTracks >> 8) & 0xFF, numTracks & 0xFF,
    (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF,
  ]);

  // Concatenate header + all track chunks
  const totalLength = header.length + trackChunks.reduce((s, c) => s + c.length, 0);
  const file = new Uint8Array(totalLength);
  let offset = 0;
  file.set(header, offset); offset += header.length;
  for (const chunk of trackChunks) {
    file.set(chunk, offset); offset += chunk.length;
  }

  return new Blob([file], { type: 'audio/midi' });
}

function buildTrackChunk(data: number[]): Uint8Array {
  const len = data.length;
  const chunk = new Uint8Array(8 + len);
  // "MTrk"
  chunk[0] = 0x4D; chunk[1] = 0x54; chunk[2] = 0x72; chunk[3] = 0x6B;
  // Length (big-endian 32-bit)
  chunk[4] = (len >> 24) & 0xFF;
  chunk[5] = (len >> 16) & 0xFF;
  chunk[6] = (len >> 8) & 0xFF;
  chunk[7] = len & 0xFF;
  chunk.set(data, 8);
  return chunk;
}

export default function ExportStudio() {
  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);

  // Export state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'wav',
    quality: 'high',
    sampleRate: 44100,
    bitDepth: 16
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Save state
  const [saveData, setSaveData] = useState<SaveData>({
    name: '',
    description: '',
    tracks: [],
    bpm: 120,
    key: 'C'
  });
  const [savedProjects, setSavedProjects] = useState<SaveData[]>([]);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Export functionality — REAL audio rendering via OfflineAudioContext
  const handleExport = async () => {
    if (!studioContext?.currentTracks || studioContext.currentTracks.length === 0) {
      toast({
        title: "Nothing to Export",
        description: "Please add some tracks to your project first.",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const tracks = studioContext.currentTracks;
      const bpm = studioContext.bpm || 120;

      if (exportOptions.format === 'midi') {
        // MIDI export — generate a real Standard MIDI File (SMF)
        setExportProgress(20);
        const midiBlob = buildMidiFile(tracks, bpm);
        setExportProgress(90);

        const url = URL.createObjectURL(midiBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codedswitch-project.mid`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportProgress(100);
      } else {
        // WAV / MP3 — Real audio rendering using stemExport
        setExportProgress(10);

        // Dynamic import to avoid circular deps
        const { renderMasterMix } = await import('@/lib/stemExport');
        setExportProgress(30);

        const wavBlob = await renderMasterMix(tracks, {
          sampleRate: exportOptions.sampleRate,
          bpm,
          normalize: true,
        });
        setExportProgress(90);

        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codedswitch-project.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportProgress(100);
      }

      toast({
        title: "Export Complete",
        description: `Your project has been exported as ${exportOptions.format.toUpperCase()}`
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting your project.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Save functionality
  const handleSave = () => {
    if (!saveData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your project.",
        variant: "destructive"
      });
      return;
    }

    const projectData = {
      ...saveData,
      tracks: studioContext?.currentTracks || [],
      bpm: studioContext?.bpm || 120,
      key: studioContext?.currentKey || 'C',
      savedAt: new Date().toISOString()
    };

    // Save to localStorage for demonstration
    const existingProjects = JSON.parse(localStorage.getItem('codedswitch_projects') || '[]');
    existingProjects.push(projectData);
    localStorage.setItem('codedswitch_projects', JSON.stringify(existingProjects));

    setSavedProjects(existingProjects);

    toast({
      title: "Project Saved",
      description: `"${saveData.name}" has been saved successfully.`
    });
  };

  const handleLoad = (project: SaveData) => {
    if (studioContext?.setCurrentTracks) {
      studioContext.setCurrentTracks(project.tracks);
    }
    if (studioContext?.setBpm) {
      studioContext.setBpm(project.bpm);
    }
    if (studioContext?.setCurrentKey) {
      studioContext.setCurrentKey(project.key);
    }

    toast({
      title: "Project Loaded",
      description: `"${project.name}" has been loaded.`
    });
  };

  // Recording functionality
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(recordingChunksRef.current, { type: 'audio/wav' });
        setRecordedAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());

        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({
        title: "Recording Started",
        description: "Audio recording has begun. Click stop when finished."
      });
    } catch (error) {
      toast({
        title: "Recording Failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      toast({
        title: "Recording Stopped",
        description: "Audio recording has been saved."
      });
    }
  };

  const downloadRecording = () => {
    if (recordedAudio) {
      const url = URL.createObjectURL(recordedAudio);
      const a = document.createElement('a');
      a.href = url;
      a.download = `codedswitch-recording-${new Date().toISOString().split('T')[0]}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Project
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="format">Format</Label>
              <Select
                value={exportOptions.format}
                onValueChange={(value: 'wav' | 'mp3' | 'midi') =>
                  setExportOptions({...exportOptions, format: value})
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wav">WAV (Lossless)</SelectItem>
                  <SelectItem value="mp3">MP3 (Compressed)</SelectItem>
                  <SelectItem value="midi">MIDI (Instrumental)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quality">Quality</Label>
              <Select
                value={exportOptions.quality}
                onValueChange={(value: 'high' | 'medium' | 'low') =>
                  setExportOptions({...exportOptions, quality: value})
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High (Studio)</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low (Web)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sampleRate">Sample Rate</Label>
              <Select
                value={exportOptions.sampleRate.toString()}
                onValueChange={(value) =>
                  setExportOptions({...exportOptions, sampleRate: parseInt(value)})
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="44100">44.1 kHz (CD)</SelectItem>
                  <SelectItem value="48000">48 kHz (Pro)</SelectItem>
                  <SelectItem value="96000">96 kHz (Hi-Res)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bitDepth">Bit Depth</Label>
              <Select
                value={exportOptions.bitDepth.toString()}
                onValueChange={(value) =>
                  setExportOptions({...exportOptions, bitDepth: parseInt(value)})
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16">16-bit</SelectItem>
                  <SelectItem value="24">24-bit</SelectItem>
                  <SelectItem value="32">32-bit (Float)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Exporting...</span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} />
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Project'}
          </Button>
        </CardContent>
      </Card>

      {/* Save/Load Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save & Load Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={saveData.name}
                onChange={(e) => setSaveData({...saveData, name: e.target.value})}
                placeholder="Enter project name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={saveData.description}
                onChange={(e) => setSaveData({...saveData, description: e.target.value})}
                placeholder="Project description"
              />
            </div>
          </div>

          <Button onClick={handleSave} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Project
          </Button>

          {/* Saved Projects */}
          {savedProjects.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Saved Projects</h4>
              <div className="space-y-2">
                {savedProjects.map((project, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-gray-500">
                        {project.description || 'No description'}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLoad(project)}
                    >
                      Load
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recording Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isRecording ? (
              <Mic className="h-5 w-5 text-red-500 animate-pulse" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
            Audio Recording Studio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-mono mb-2">
              {formatTime(recordingTime)}
            </div>
            <Badge variant={isRecording ? "destructive" : "secondary"}>
              {isRecording ? "RECORDING" : "READY"}
            </Badge>
          </div>

          <div className="flex justify-center gap-4">
            {!isRecording ? (
              <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700">
                <Mic className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            )}
          </div>

          {recordedAudio && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-green-600 font-medium mb-2">Recording Complete!</div>
                <div className="text-sm text-gray-500">
                  Duration: {formatTime(recordingTime)}
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <Button onClick={downloadRecording}>
                  <Download className="h-4 w-4 mr-2" />
                  Download WAV
                </Button>
                <Button variant="outline" onClick={() => setRecordedAudio(null)}>
                  Clear Recording
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 text-center">
            Recording captures all audio from your system. Make sure your speakers/headphones are set as the input source.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
