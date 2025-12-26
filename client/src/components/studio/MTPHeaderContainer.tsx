import { ChangeEvent } from "react";
import StudioMenuBar from "./StudioMenuBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StopCircle, Upload, Plus, Layers, Mic, Headphones, Library, Music, Drum, Piano, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface MTPHeaderContainerProps {
  projectName: string;
  setProjectName: (n: string) => void;
  tempo: number;
  setTempo: (n: number) => void;
  projectKey: string;
  setProjectKey: (k: string) => void;
  timeSignature: string;
  setTimeSignature: (ts: string) => void;
  metronomeOn: boolean;
  setMetronomeOn: (v: boolean) => void;
  isRecording: boolean;
  recordingTimeLabel: string;
  startRecording: () => void;
  stopRecording: () => void;
  showMixer: boolean;
  onToggleMixer: () => void;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  applyTemplate: (t: 'band' | 'podcast') => void;
  showAddTrack: boolean;
  setShowAddTrack: (v: boolean) => void;
  activeSourceTab: 'library' | 'beatlab' | 'melody' | 'pianoroll';
  setActiveSourceTab: (v: 'library' | 'beatlab' | 'melody' | 'pianoroll') => void;
  librarySongs: any[];
  loadFromLibrary: (song: any) => void;
  onAddEmptyTrack: (name: string, type: 'beat' | 'melody' | 'vocal' | 'audio') => void;
  onOpenBeatLab: () => void;
  onOpenMelody: () => void;
  onOpenPianoRoll: () => void;
  menuHandlers: Parameters<typeof StudioMenuBar>[0];
}

export function MTPHeaderContainer(props: MTPHeaderContainerProps) {
  const {
    tempo,
    setTempo,
    projectName,
    setProjectName,
    projectKey,
    setProjectKey,
    timeSignature,
    setTimeSignature,
    metronomeOn,
    setMetronomeOn,
    handleFileUpload,
    applyTemplate,
    showAddTrack,
    setShowAddTrack,
    activeSourceTab,
    setActiveSourceTab,
    librarySongs,
    loadFromLibrary,
    startRecording,
    stopRecording,
    isRecording,
    recordingTimeLabel,
    showMixer,
    onToggleMixer,
    onAddEmptyTrack,
    onOpenBeatLab,
    onOpenMelody,
    onOpenPianoRoll,
    menuHandlers,
  } = props;

  return (
    <div className="bg-gray-900 text-white">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <StudioMenuBar {...menuHandlers} />
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <Input className="w-48 h-8 bg-gray-800 border-gray-700" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <span>BPM:</span>
          <Input type="number" className="w-16 h-8 bg-gray-800 border-gray-700" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
          <span>Key:</span>
          <Input className="w-16 h-8 bg-gray-800 border-gray-700" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
          <span>TS:</span>
          <Input className="w-16 h-8 bg-gray-800 border-gray-700" value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)} />
          <Button size="sm" variant={metronomeOn ? 'default' : 'outline'} onClick={() => setMetronomeOn(!metronomeOn)}>
            {metronomeOn ? 'Metronome On' : 'Metronome Off'}
          </Button>
        </div>
      </div>

      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Music className="w-6 h-6" />
              Master Multi-Track Player
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Load and mix multiple audio files together
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isRecording ? (
              <Button onClick={stopRecording} className="bg-red-600 hover:bg-red-500 animate-pulse">
                <StopCircle className="w-4 h-4 mr-2" />
                Stop ({recordingTimeLabel})
              </Button>
            ) : (
              <Button onClick={startRecording} variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/20">
                <Mic className="w-4 h-4 mr-2" />
                Record
              </Button>
            )}

            <Button variant={showMixer ? "default" : "outline"} onClick={onToggleMixer}>
              <Layers className="w-4 h-4 mr-2" />
              Mixer
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Professional Multi-Track Mixing</span>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <label htmlFor="audio-upload" className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Load Audio Files
                </span>
              </Button>
            </label>
            <input id="audio-upload" type="file" accept="audio/*" multiple onChange={handleFileUpload} className="hidden" />
            <Button variant="outline" onClick={() => setShowAddTrack(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Track
            </Button>
            <Button variant="outline" onClick={() => applyTemplate('band')}>
              <Layers className="w-4 h-4 mr-2" />
              Band Template
            </Button>
            <Button variant="outline" onClick={() => applyTemplate('podcast')}>
              <Mic className="w-4 h-4 mr-2" />
              Podcast Template
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showAddTrack} onOpenChange={setShowAddTrack}>
        <DialogTrigger asChild>
          <Button variant="default" className="bg-green-600 hover:bg-green-500 ml-4 mt-2">
            <Plus className="w-4 h-4 mr-2" />
            Add Track
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Add Track to Multi-Track Player
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" className="justify-start" onClick={() => applyTemplate('band')}>
              Band Template (Drums, Bass, Melody, Vocal)
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => applyTemplate('podcast')}>
              Podcast Template (Host, Guest, Bed)
            </Button>
          </div>
          
          <Tabs value={activeSourceTab} onValueChange={(v) => setActiveSourceTab(v as any)} className="mt-4">
            <TabsList className="grid grid-cols-4 bg-gray-800">
              <TabsTrigger value="library" className="data-[state=active]:bg-blue-600">
                <Library className="w-4 h-4 mr-1" />
                Library
              </TabsTrigger>
              <TabsTrigger value="beatlab" className="data-[state=active]:bg-amber-600">
                <Drum className="w-4 h-4 mr-1" />
                Beat Lab
              </TabsTrigger>
              <TabsTrigger value="melody" className="data-[state=active]:bg-purple-600">
                <Piano className="w-4 h-4 mr-1" />
                Melody
              </TabsTrigger>
              <TabsTrigger value="pianoroll" className="data-[state=active]:bg-blue-500">
                <Music className="w-4 h-4 mr-1" />
                Piano Roll
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="library" className="mt-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {librarySongs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No songs in library yet.</p>
                    <p className="text-sm">Upload songs in the Song Uploader tab first.</p>
                  </div>
                ) : (
                  librarySongs.map((song: any) => (
                    <div key={song.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                      <div className="flex items-center gap-3">
                        <Music className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="font-medium text-white">{song.name}</p>
                          <p className="text-xs text-gray-400">
                            {song.format?.toUpperCase()} | {song.duration ? `${Math.round(song.duration)}s` : 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => { loadFromLibrary(song); setShowAddTrack(false); }} className="bg-green-600 hover:bg-green-500">
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="beatlab" className="mt-4">
              <div className="text-center py-8">
                <Drum className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                <h3 className="text-lg font-semibold mb-2">Import from Beat Lab</h3>
                <p className="text-gray-300 mb-4">Create beats in Beat Lab and export them here</p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => {
                      onAddEmptyTrack('Beat Track', 'beat');
                      setShowAddTrack(false);
                    }}
                    className="bg-amber-600 hover:bg-amber-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Empty Beat Track
                  </Button>
                  <Button variant="outline" onClick={() => { onOpenBeatLab(); setShowAddTrack(false); }}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Open Beat Lab
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="melody" className="mt-4">
              <div className="text-center py-8">
                <Piano className="w-16 h-16 mx-auto mb-4 text-purple-500" />
                <h3 className="text-lg font-semibold mb-2">Import from Melody Composer</h3>
                <p className="text-gray-300 mb-4">Create melodies and export them here</p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => {
                      onAddEmptyTrack('Melody Track', 'melody');
                      setShowAddTrack(false);
                    }}
                    className="bg-purple-600 hover:bg-purple-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Empty Melody Track
                  </Button>
                  <Button variant="outline" onClick={() => { onOpenMelody(); setShowAddTrack(false); }}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Open Melody Composer
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="pianoroll" className="mt-4">
              <div className="text-center py-8">
                <Music className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                <h3 className="text-lg font-semibold mb-2">Import from Piano Roll</h3>
                <p className="text-gray-300 mb-4">Create MIDI sequences in Piano Roll and export them here</p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => {
                      onAddEmptyTrack('Piano Roll Track', 'audio');
                      setShowAddTrack(false);
                    }}
                    className="bg-blue-600 hover:bg-blue-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Empty Track
                  </Button>
                  <Button variant="outline" onClick={() => { onOpenPianoRoll(); setShowAddTrack(false); }}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Open Piano Roll
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-3">Quick Add:</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onAddEmptyTrack('Vocal Track', 'vocal');
                  setShowAddTrack(false);
                }}
              >
                <Mic className="w-4 h-4 mr-1" />
                Vocal Track
              </Button>
              <label htmlFor="quick-upload" className="cursor-pointer">
                <Button size="sm" variant="outline" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-1" />
                    Upload Audio File
                  </span>
                </Button>
              </label>
              <input
                id="quick-upload"
                type="file"
                accept="audio/*"
                multiple
                onChange={(e) => {
                  handleFileUpload(e);
                  setShowAddTrack(false);
                }}
                className="hidden"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
