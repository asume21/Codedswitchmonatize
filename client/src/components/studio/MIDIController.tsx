import { useState } from 'react';
import { useMIDI } from '@/hooks/use-midi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AVAILABLE_INSTRUMENTS } from './types/pianoRollTypes';
import { useInstrumentOptional } from '@/contexts/InstrumentContext';

export function MIDIController() {
  const { 
    isSupported, 
    isConnected, 
    connectedDevices, 
    lastNote, 
    activeNotes,
    initializeMIDI,
    refreshDevices,
    settings,
    updateSettings,
    // MIDI Learn
    isLearning,
    learningParameter,
    startLearning,
    stopLearning,
    customMappings,
    removeMapping,
    clearAllMappings,
    // CC Monitor
    lastCC,
    ccHistory,
    clearCCHistory,
    getAISuggestion,
  } = useMIDI();
  
  const globalInstrument = useInstrumentOptional();
  
  const [showDetails, setShowDetails] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMidiLearn, setShowMidiLearn] = useState(false);
  const [showCCMonitor, setShowCCMonitor] = useState(false);
  
  // Handle instrument change - update both MIDI settings and global context
  const handleInstrumentChange = (instrument: string) => {
    updateSettings({ currentInstrument: instrument });
    // Also update global instrument context so Piano Roll stays in sync
    if (globalInstrument?.setCurrentInstrument) {
      globalInstrument.setCurrentInstrument(instrument);
    }
  };
  
  // Learnable parameters
  const learnableParams = [
    { id: 'volume', label: '🔊 Volume', description: 'Master volume control' },
    { id: 'filter', label: '🎛️ Filter Cutoff', description: 'Low-pass filter' },
    { id: 'reverb', label: '🌊 Reverb', description: 'Reverb wet/dry mix' },
    { id: 'attack', label: '📈 Attack', description: 'Note attack time' },
    { id: 'release', label: '📉 Release', description: 'Note release time' },
    { id: 'pan', label: '🔄 Pan', description: 'Stereo panning' },
    { id: 'pitch', label: '🎵 Pitch Bend', description: 'Pitch bend amount' },
    { id: 'modulation', label: '〰️ Modulation', description: 'Vibrato/tremolo' },
  ];
  
  if (!isSupported) {
    return (
      <Card className="bg-studio-panel border-gray-600">
        <CardHeader>
          <CardTitle className="text-gray-200 flex items-center">
            <i className="fas fa-keyboard mr-2"></i>
            MIDI Controller
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <i className="fas fa-exclamation-triangle text-yellow-500 text-2xl mb-2"></i>
            <p className="text-gray-400 mb-3">
              Web MIDI API not supported in this browser
            </p>
            <p className="text-sm text-gray-500">
              Try using Chrome, Edge, or Opera for MIDI support
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-studio-panel border-gray-600">
      <CardHeader>
        <CardTitle className="text-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <i className="fas fa-keyboard mr-2"></i>
            MIDI Controller
            {isConnected && (
              <Badge variant="secondary" className="ml-2 bg-green-600 text-white">
                Connected
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Quick Setup Guide */}
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4 mb-4">
          <h3 className="text-green-400 font-semibold mb-2 flex items-center">
            <i className="fas fa-check-circle mr-2"></i>
            Controller Connected! Quick Setup Guide:
          </h3>
          <div className="text-sm text-green-200 space-y-1">
            <p><strong>1. Play Notes:</strong> Your controller is already playing piano - try pressing keys!</p>
            <p><strong>2. Change Instrument:</strong> Click the gear ⚙️ button below, then use "Current Instrument" dropdown</p>
            <p><strong>3. Record Melodies:</strong> Go to "Melody Composer" tab to record your playing</p>
            <p><strong>4. Control Beats:</strong> Use "Beat Maker" tab - some controllers can trigger drums</p>
            <p><strong>5. Live Performance:</strong> All tabs work with your controller for real-time control</p>
          </div>
        </div>
        {/* Control Buttons */}
        <div className="flex items-center space-x-2">
          {!isConnected ? (
            <Button onClick={initializeMIDI} className="flex-1 bg-studio-accent hover:bg-blue-500">
              <i className="fas fa-plug mr-2"></i>
              Connect MIDI
            </Button>
          ) : (
            <Button onClick={refreshDevices} variant="outline" className="flex-1">
              <i className="fas fa-sync mr-2"></i>
              Refresh
            </Button>
          )}
          <Button 
            onClick={() => setShowMidiLearn(!showMidiLearn)} 
            variant={showMidiLearn ? "default" : "outline"}
            className={`px-3 ${isLearning ? 'bg-yellow-600 animate-pulse' : ''}`}
            title="MIDI Learn"
          >
            <i className="fas fa-graduation-cap"></i>
          </Button>
          <Button 
            onClick={() => setShowCCMonitor(!showCCMonitor)} 
            variant={showCCMonitor ? "default" : "outline"}
            className="px-3"
            title="CC Monitor"
          >
            <i className="fas fa-chart-line"></i>
          </Button>
          <Button 
            onClick={() => setShowSettings(!showSettings)} 
            variant="outline"
            className="px-3"
          >
            <i className="fas fa-cog"></i>
          </Button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Status:</span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">
              {isConnected ? `Ready (${connectedDevices.length} devices)` : 'Not connected'}
            </span>
          </div>
        </div>
        
        {/* Connected Devices */}
        {connectedDevices.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Connected Devices ({connectedDevices.length})
            </h4>
            <ScrollArea className="h-24">
              <div className="space-y-1">
                {connectedDevices.map((device) => (
                  <div 
                    key={device.id} 
                    className="flex items-center justify-between p-2 bg-gray-800 rounded text-xs"
                  >
                    <div>
                      <div className="font-medium text-gray-200">{device.name}</div>
                      <div className="text-gray-400">{device.manufacturer}</div>
                    </div>
                    <Badge 
                      variant={device.state === 'connected' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {device.state}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Real-time Activity */}
        {isConnected && (
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Activity</h4>
            
            {/* Active Notes */}
            {activeNotes.size > 0 && (
              <div className="mb-2">
                <div className="text-xs text-gray-400 mb-1">Playing Notes:</div>
                <div className="flex flex-wrap gap-1">
                  {[...activeNotes].map((note) => (
                    <Badge key={note} variant="default" className="bg-studio-accent text-xs">
                      {note}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Last Note Info */}
            {lastNote && (
              <div className="p-2 bg-gray-800 rounded text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Last Note:</span>
                  <span className="text-gray-200">
                    Note {lastNote.note} • Ch {lastNote.channel + 1} • Vel {lastNote.velocity}
                  </span>
                </div>
              </div>
            )}
            
            {activeNotes.size === 0 && !lastNote && (
              <div className="text-center py-3 text-gray-500 text-sm">
                <i className="fas fa-music mb-1"></i>
                <div>Play your MIDI controller to see activity</div>
              </div>
            )}
          </div>
        )}
        
        {/* Channel Mapping Info */}
        {showDetails && isConnected && (
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Channel Mapping</h4>
            <ScrollArea className="h-32">
              <div className="space-y-1 text-xs">
                {[
                  { ch: 1, instrument: 'Piano' },
                  { ch: 2, instrument: 'Guitar' },
                  { ch: 3, instrument: 'Bass' },
                  { ch: 4, instrument: 'Violin' },
                  { ch: 5, instrument: 'Flute' },
                  { ch: 6, instrument: 'Trumpet' },
                  { ch: 7, instrument: 'Organ' },
                  { ch: 8, instrument: 'Synth' },
                  { ch: 10, instrument: 'Drums' },
                ].map((mapping) => (
                  <div key={mapping.ch} className="flex justify-between p-1 bg-gray-800 rounded">
                    <span className="text-gray-400">Channel {mapping.ch}:</span>
                    <span className="text-gray-200">{mapping.instrument}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-2 text-xs text-gray-500">
              Set your MIDI controller to different channels to play different instruments
            </div>
          </div>
        )}
        
        {/* MIDI Settings */}
        {showSettings && (
          <div className="space-y-4 border-t border-gray-600 pt-4">
            <h4 className="text-sm font-medium text-gray-300 flex items-center">
              <i className="fas fa-cog mr-2"></i>
              MIDI Settings
            </h4>
            
            {/* Input Device Selection */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Input Device</Label>
              <Select value={settings?.inputDevice} onValueChange={(value) => updateSettings({ inputDevice: value })}>
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue placeholder="Select MIDI input device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Connected Devices</SelectItem>
                  {connectedDevices.filter(d => d.connection === 'input' || d.connection === 'input/output').map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.manufacturer})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Velocity Sensitivity */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">
                Velocity Sensitivity: {settings?.velocitySensitivity?.[0] || 100}%
              </Label>
              <Slider
                value={settings?.velocitySensitivity || [100]}
                onValueChange={(value) => updateSettings({ velocitySensitivity: value })}
                max={200}
                min={50}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Less sensitive</span>
                <span>More sensitive</span>
              </div>
            </div>
            
            {/* Current Instrument */}
            <div className="space-y-2 bg-blue-900/20 border border-blue-600 rounded-lg p-3">
              <Label className="text-sm text-blue-300 font-semibold">🎹 Current Instrument</Label>
              <Select 
                value={settings?.currentInstrument || globalInstrument?.currentInstrument || 'piano'} 
                onValueChange={handleInstrumentChange}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {AVAILABLE_INSTRUMENTS.map((inst) => (
                    <SelectItem key={inst.value} value={inst.value}>
                      {inst.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-blue-200">
                Synced with Piano Roll - same instruments, same sounds
              </div>
            </div>

            {/* Channel Settings */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">MIDI Channel Mode</Label>
              <Select value={settings?.channelMode} onValueChange={(value) => updateSettings({ channelMode: value })}>
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="omni">Omni (All Channels)</SelectItem>
                  <SelectItem value="multi">Multi-Channel Instruments</SelectItem>
                  <SelectItem value="single">Single Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {settings?.channelMode === 'single' && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-300">
                  Active Channel: {settings?.activeChannel || 1}
                </Label>
                <Slider
                  value={[settings?.activeChannel || 1]}
                  onValueChange={(value) => updateSettings({ activeChannel: value[0] })}
                  max={16}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
            )}
            
            {/* Note Range */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Note Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-400">Lowest Note</Label>
                  <Slider
                    value={[settings?.noteRange?.min || 21]}
                    onValueChange={(value) => updateSettings({ noteRange: { min: value[0], max: settings?.noteRange?.max || 108 } })}
                    max={127}
                    min={0}
                    step={1}
                    className="w-full"
                    aria-label="Lowest MIDI note range"
                  />
                  <div className="text-xs text-gray-400 text-center">Note {settings?.noteRange?.min || 21}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-400">Highest Note</Label>
                  <Slider
                    value={[settings?.noteRange?.max || 108]}
                    onValueChange={(value) => updateSettings({ noteRange: { min: settings?.noteRange?.min || 21, max: value[0] } })}
                    max={127}
                    min={0}
                    step={1}
                    className="w-full"
                    aria-label="Highest MIDI note range"
                  />
                  <div className="text-xs text-gray-400 text-center">Note {settings?.noteRange?.max || 108}</div>
                </div>
              </div>
            </div>
            
            {/* Advanced Settings */}
            <Separator className="bg-gray-600" />
            
            <div className="space-y-3">
              <Label className="text-sm text-gray-300">Advanced Options</Label>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-400">Enable Sustain Pedal</Label>
                <Switch
                  checked={settings?.sustainPedal !== false}
                  onCheckedChange={(checked) => updateSettings({ sustainPedal: checked })}
                  aria-label="Enable sustain pedal support"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-400">Enable Pitch Bend</Label>
                <Switch
                  checked={settings?.pitchBend !== false}
                  onCheckedChange={(checked) => updateSettings({ pitchBend: checked })}
                  aria-label="Enable pitch bend support"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-400">Enable Modulation</Label>
                <Switch
                  checked={settings?.modulation !== false}
                  onCheckedChange={(checked) => updateSettings({ modulation: checked })}
                  aria-label="Enable modulation wheel support"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-400">Auto-connect New Devices</Label>
                <Switch
                  checked={settings?.autoConnect !== false}
                  onCheckedChange={(checked) => updateSettings({ autoConnect: checked })}
                  aria-label="Auto-connect new MIDI devices"
                />
              </div>
            </div>
            
            {/* Reset Settings */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => updateSettings({})}
              className="w-full text-xs"
            >
              <i className="fas fa-undo mr-2"></i>
              Reset to Default Settings
            </Button>
          </div>
        )}
        
        {/* MIDI Learn Section */}
        {showMidiLearn && isConnected && (
          <div className="space-y-4 border-t border-yellow-600 pt-4 bg-yellow-900/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-yellow-300 flex items-center">
                <i className="fas fa-graduation-cap mr-2"></i>
                MIDI Learn {isLearning && <span className="ml-2 text-yellow-500 animate-pulse">● Learning...</span>}
              </h4>
              {customMappings.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearAllMappings} className="text-xs text-red-400">
                  <i className="fas fa-trash mr-1"></i>
                  Clear All
                </Button>
              )}
            </div>
            
            {isLearning ? (
              <div className="bg-yellow-800/30 border border-yellow-600 rounded p-3 text-center">
                <p className="text-yellow-200 text-sm mb-2">Move a knob/slider on your controller...</p>
                <p className="text-yellow-400 text-xs">Learning: <strong>{learningParameter}</strong></p>
                <Button size="sm" variant="outline" onClick={stopLearning} className="mt-2 text-xs">Cancel</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Click "Learn" then move a control on your MIDI device.</p>
                {learnableParams.map((param) => {
                  const mapping = customMappings.find(m => m.parameter === param.id);
                  return (
                    <div key={param.id} className="flex items-center justify-between p-2 bg-gray-800 rounded text-xs">
                      <span className="text-gray-200">{param.label}</span>
                      {mapping && <span className="text-green-400 mx-2">→ CC{mapping.cc}</span>}
                      {mapping ? (
                        <Button size="sm" variant="ghost" onClick={() => removeMapping(param.id)} className="text-red-400 h-6 px-2">✕</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => startLearning(param.id)} className="h-6 px-2">Learn</Button>
                      )}
                    </div>
                  );
                })}
                {customMappings.length > 0 && <div className="text-xs text-green-400">✓ {customMappings.length} mapping(s) saved</div>}
              </div>
            )}
          </div>
        )}
        
        {/* CC Monitor Section */}
        {showCCMonitor && isConnected && (
          <div className="space-y-3 border-t border-purple-600 pt-4 bg-purple-900/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-purple-300 flex items-center">
                <i className="fas fa-chart-line mr-2"></i>
                CC Monitor
              </h4>
              <Button size="sm" variant="ghost" onClick={clearCCHistory} className="text-xs text-gray-400">Clear</Button>
            </div>
            
            {lastCC && (
              <div className="bg-purple-800/30 border border-purple-600 rounded p-2">
                <div className="flex justify-between text-sm">
                  <span className="text-purple-200">CC{lastCC.cc}</span>
                  <span className="text-purple-400">Val: {lastCC.value}</span>
                </div>
                <div className="text-xs text-purple-300 mt-1">
                  🤖 {getAISuggestion(lastCC.cc).name} - {getAISuggestion(lastCC.cc).suggestion}
                </div>
              </div>
            )}
            
            <ScrollArea className="h-20">
              {ccHistory.length === 0 ? (
                <div className="text-center py-2 text-gray-500 text-xs">Move knobs/sliders to see CC messages</div>
              ) : (
                <div className="space-y-1">
                  {ccHistory.slice(0, 10).map((cc, idx) => (
                    <div key={idx} className="flex justify-between p-1 bg-gray-800 rounded text-xs">
                      <span className="text-gray-400">CC{cc.cc}</span>
                      <span className="text-gray-200">{cc.value}</span>
                      <span className="text-gray-500">Ch{cc.channel + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}