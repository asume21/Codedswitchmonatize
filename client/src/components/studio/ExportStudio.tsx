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

  // Export functionality
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
      // Simulate export process
      for (let i = 0; i <= 100; i += 10) {
        setExportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Create a dummy file for demonstration
      const dummyData = JSON.stringify({
        tracks: studioContext.currentTracks,
        bpm: studioContext.bpm || 120,
        format: exportOptions.format,
        timestamp: new Date().toISOString()
      });

      const blob = new Blob([dummyData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `codedswitch-project.${exportOptions.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Your project has been exported as ${exportOptions.format.toUpperCase()}`
      });
    } catch (error) {
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
