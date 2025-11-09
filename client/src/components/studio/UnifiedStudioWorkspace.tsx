import { useState, useContext, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { StudioAudioContext } from '@/pages/studio';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, MessageSquare, Music } from 'lucide-react';
import FloatingAIAssistant from './FloatingAIAssistant';
import MusicGenerationPanel from './MusicGenerationPanel';
import LyricsFocusMode from './LyricsFocusMode';

interface Track {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'lyrics';
  instrument?: string;
  data: any;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export default function UnifiedStudioWorkspace() {
  const studioContext = useContext(StudioAudioContext);
  
  // Section expansion states
  const [instrumentsExpanded, setInstrumentsExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [pianoRollExpanded, setPianoRollExpanded] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);

  // Track management
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: 'track-1',
      name: 'Piano 1',
      type: 'midi',
      instrument: 'piano',
      data: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    },
  ]);
  
  const [selectedTrack, setSelectedTrack] = useState<string | null>('track-1');
  const [zoom, setZoom] = useState([50]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // UI State
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [showMusicGen, setShowMusicGen] = useState(false);
  const [showLyricsFocus, setShowLyricsFocus] = useState(false);

  // Instrument categories
  const instrumentCategories = {
    Piano: ['Grand Piano', 'Electric Piano', 'Synth Piano', 'Harpsichord'],
    Bass: ['808 Bass', 'Synth Bass', 'Electric Bass', 'Upright Bass', 'Sub Bass'],
    Guitar: ['Acoustic Guitar', 'Electric Guitar', 'Classical Guitar', 'Bass Guitar'],
    Strings: ['Violin', 'Viola', 'Cello', 'Double Bass', 'String Ensemble'],
    Winds: ['Flute', 'Clarinet', 'Saxophone', 'Trumpet', 'Horn', 'Trombone'],
    Drums: ['Kick', 'Snare', 'Hi-Hat', 'Tom', 'Cymbal', 'Full Kit'],
    Synth: ['Lead Synth', 'Pad Synth', 'Arp Synth', 'Bass Synth'],
    Other: ['Percussion', 'Sound Effects', 'Vocal', 'Samples'],
  };

  const addTrack = (instrument: string, type: 'midi' | 'audio') => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `${instrument} ${tracks.length + 1}`,
      type,
      instrument,
      data: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    setPianoRollExpanded(true);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    // Actual playback logic will be implemented
  };

  const handleMusicGenerated = (audioUrl: string, metadata: any) => {
    // Add generated music as a new track
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Generated - ${metadata.genre}`,
      type: 'audio',
      instrument: metadata.provider,
      data: { audioUrl, metadata },
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    setShowMusicGen(false);
  };

  const handleLyricsSaved = (lyrics: string, sections: any[]) => {
    // Add or update lyrics track
    const lyricsTrack = tracks.find(t => t.type === 'lyrics');
    if (lyricsTrack) {
      setTracks(tracks.map(t =>
        t.type === 'lyrics' ? { ...t, data: { lyrics, sections } } : t
      ));
    } else {
      const newTrack: Track = {
        id: `track-${Date.now()}`,
        name: 'Lyrics',
        type: 'lyrics',
        data: { lyrics, sections },
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
      };
      setTracks([...tracks, newTrack]);
    }
    setShowLyricsFocus(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">🎵 Unified Studio</h1>
          <div className="flex space-x-2">
            <Button variant="ghost" size="sm">File</Button>
            <Button variant="ghost" size="sm">Edit</Button>
            <Button variant="ghost" size="sm">View</Button>
            <Button variant="ghost" size="sm">Mix</Button>
            <Button variant="ghost" size="sm">Master</Button>
          </div>
        </div>
        
        {/* Transport Controls */}
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowMusicGen(!showMusicGen)}
            className="bg-purple-600 hover:bg-purple-500"
          >
            <Music className="w-4 h-4 mr-2" />
            Generate Music
          </Button>
          <Button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className="bg-blue-600 hover:bg-blue-500"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            AI Assistant
          </Button>
          <Button
            onClick={togglePlay}
            className={isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}
          >
            <i className={`fas ${isPlaying ? 'fa-stop' : 'fa-play'} mr-2`}></i>
            {isPlaying ? 'Stop' : 'Play'}
          </Button>
          <Button variant="outline" size="sm">
            <i className="fas fa-undo mr-2"></i>
            Undo
          </Button>
          <Button variant="outline" size="sm">
            <i className="fas fa-redo mr-2"></i>
            Redo
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Instrument Library */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-700">
            <Input
              placeholder="Search instruments..."
              className="w-full"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {Object.entries(instrumentCategories).map(([category, instruments]) => (
                <div key={category}>
                  <button
                    className="w-full text-left px-2 py-1.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 rounded flex items-center"
                    onClick={() => {
                      // Toggle category expansion
                    }}
                  >
                    <ChevronRight className="w-4 h-4 mr-1" />
                    {category}
                  </button>
                  <div className="ml-4 space-y-0.5">
                    {instruments.map((inst) => (
                      <button
                        key={inst}
                        onClick={() => addTrack(inst, 'midi')}
                        className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-blue-600 hover:text-white rounded"
                        title={`Click to add ${inst} track`}
                      >
                        + {inst}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
            >
              <span className="font-medium">
                {timelineExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
                TIMELINE - ALL TRACKS
              </span>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <span>Zoom:</span>
                <Slider
                  value={zoom}
                  onValueChange={setZoom}
                  max={100}
                  min={10}
                  step={1}
                  className="w-24"
                  onClick={(e) => e.stopPropagation()}
                />
                <span>{zoom[0]}%</span>
              </div>
            </button>
            
            {timelineExpanded && (
              <div className="bg-gray-900 p-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {tracks.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => {
                        setSelectedTrack(track.id);
                        if (track.type === 'midi') {
                          setPianoRollExpanded(true);
                        } else if (track.type === 'lyrics') {
                          setLyricsExpanded(true);
                        }
                      }}
                      className={`border rounded p-3 cursor-pointer transition ${
                        selectedTrack === track.id
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{track.name}</span>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTracks(tracks.map(t =>
                                t.id === track.id ? { ...t, muted: !t.muted } : t
                              ));
                            }}
                            className={track.muted ? 'text-red-500' : ''}
                          >
                            M
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTracks(tracks.map(t =>
                                t.id === track.id ? { ...t, solo: !t.solo } : t
                              ));
                            }}
                            className={track.solo ? 'text-yellow-500' : ''}
                          >
                            S
                          </Button>
                        </div>
                      </div>
                      
                      {/* Visual waveform placeholder */}
                      <div className="h-16 bg-gray-800 rounded flex items-center justify-center text-xs text-gray-500">
                        [Waveform visualization - {track.type}]
                      </div>
                    </div>
                  ))}
                  
                  {tracks.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No tracks yet. Add instruments from the left panel.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Piano Roll Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setPianoRollExpanded(!pianoRollExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center"
            >
              {pianoRollExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
              PIANO ROLL {selectedTrack && `(${tracks.find(t => t.id === selectedTrack)?.name})`}
            </button>
            
            {pianoRollExpanded && selectedTrack && (
              <div className="bg-gray-900 p-4">
                <div className="border border-gray-700 rounded p-4 min-h-64">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">Draw</Button>
                      <Button size="sm" variant="outline">Select</Button>
                      <Button size="sm" variant="outline">Erase</Button>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <span>Scale:</span>
                      <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1">
                        <option>C Major</option>
                        <option>A Minor</option>
                        <option>G Major</option>
                        <option>D Minor</option>
                      </select>
                      <Button size="sm" variant="outline">Chord Builder</Button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded h-48 flex items-center justify-center text-gray-500">
                    [Piano Roll Grid - Click to add notes, drag to create chords]
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lyrics Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setLyricsExpanded(!lyricsExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
            >
              <span>
                {lyricsExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
                LYRICS EDITOR
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLyricsFocus(true);
                }}
              >
                <Maximize2 className="w-4 h-4 mr-1" />
                Focus Mode
              </Button>
            </button>
            
            {lyricsExpanded && (
              <div className="bg-gray-900 p-4">
                <div className="border border-gray-700 rounded p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Song Lyrics</h3>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <i className="fas fa-magic mr-1"></i>
                        AI Suggest (Grok)
                      </Button>
                      <Button size="sm" variant="outline">
                        Rhyme Help
                      </Button>
                    </div>
                  </div>
                  
                  <textarea
                    className="w-full h-48 bg-gray-800 border border-gray-700 rounded p-3 text-sm resize-none"
                    placeholder="Write your lyrics here...

[Verse 1]
Your lyrics will sync with the timeline

[Chorus]
..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mixer Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setMixerExpanded(!mixerExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center"
            >
              {mixerExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
              MIXER & EFFECTS {selectedTrack && `(${tracks.find(t => t.id === selectedTrack)?.name})`}
            </button>
            
            {mixerExpanded && selectedTrack && (
              <div className="bg-gray-900 p-4">
                <div className="border border-gray-700 rounded p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Volume</label>
                      <Slider
                        value={[tracks.find(t => t.id === selectedTrack)?.volume || 0.8]}
                        onValueChange={(val) => {
                          setTracks(tracks.map(t =>
                            t.id === selectedTrack ? { ...t, volume: val[0] } : t
                          ));
                        }}
                        max={1}
                        min={0}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Pan</label>
                      <Slider
                        value={[tracks.find(t => t.id === selectedTrack)?.pan || 0]}
                        onValueChange={(val) => {
                          setTracks(tracks.map(t =>
                            t.id === selectedTrack ? { ...t, pan: val[0] } : t
                          ));
                        }}
                        max={1}
                        min={-1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Effects Chain</label>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline">EQ</Button>
                        <Button size="sm" variant="outline">Comp</Button>
                        <Button size="sm" variant="outline">Reverb</Button>
                        <Button size="sm" variant="outline">+ Add</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating/Overlay Components */}
      {showAIAssistant && (
        <FloatingAIAssistant onClose={() => setShowAIAssistant(false)} />
      )}

      {showMusicGen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <Button
              onClick={() => setShowMusicGen(false)}
              variant="ghost"
              className="mb-2"
            >
              <i className="fas fa-times mr-2"></i>
              Close
            </Button>
            <MusicGenerationPanel onMusicGenerated={handleMusicGenerated} />
          </div>
        </div>
      )}

      {showLyricsFocus && (
        <LyricsFocusMode
          onClose={() => setShowLyricsFocus(false)}
          onSave={handleLyricsSaved}
        />
      )}
    </div>
  );
}
