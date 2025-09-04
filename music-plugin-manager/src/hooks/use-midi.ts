import { useState, useEffect, useCallback } from 'react';
import { useAudio } from './use-audio';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  connection: string;
  state: string;
}

interface MIDINote {
  note: number;
  velocity: number;
  channel: number;
}

interface MIDISettings {
  inputDevice?: string;
  velocitySensitivity?: number[];
  channelMode?: string;
  activeChannel?: number;
  noteRange?: { min: number; max: number };
  sustainPedal?: boolean;
  pitchBend?: boolean;
  modulation?: boolean;
  autoConnect?: boolean;
  currentInstrument?: string;
}

export function useMIDI() {
  const [midiAccess, setMidiAccess] = useState<any | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<MIDIDevice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastNote, setLastNote] = useState<MIDINote | null>(null);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [settings, setSettings] = useState<MIDISettings>({
    inputDevice: 'all',
    velocitySensitivity: [100],
    channelMode: 'multi',
    activeChannel: 1,
    noteRange: { min: 21, max: 108 },
    sustainPedal: true,
    pitchBend: true,
    modulation: true,
    autoConnect: true,
    currentInstrument: 'piano'
  });
  
  const { playNote } = useAudio();
  
  // Update settings
  const updateSettings = useCallback((newSettings: Partial<MIDISettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);
  
  // MIDI note number to note name conversion
  const noteNumberToName = useCallback((noteNumber: number) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return { note: noteName, octave };
  }, []);

  // Map MIDI channels to instruments
  const getMIDIChannelInstrument = useCallback((channel: number): string => {
    // Use the selected instrument from settings
    const instrumentMap: { [key: string]: string } = {
      'piano': 'piano-keyboard',
      'guitar': 'strings-guitar',
      'bass': 'bass-electric',
      'violin': 'strings-violin',
      'flute': 'flute-concert',
      'trumpet': 'horns-trumpet',
      'organ': 'piano-organ'
    };
    
    return instrumentMap[settings.currentInstrument || 'piano'] || 'piano-keyboard';
  }, [settings.currentInstrument]);

  // Handle note on events
  const handleNoteOn = useCallback((midiNote: number, velocity: number, channel: number) => {
    const { note, octave } = noteNumberToName(midiNote);
    const normalizedVelocity = velocity / 127;
    
    setActiveNotes(prev => new Set(Array.from(prev).concat(midiNote)));
    setLastNote({ note: midiNote, velocity, channel });
    
    const instrument = getMIDIChannelInstrument(channel);
    const duration = 2.0;
    
    playNote(note, octave, duration, instrument, normalizedVelocity, true);
  }, [noteNumberToName, playNote, getMIDIChannelInstrument]);

  // Handle note off events
  const handleNoteOff = useCallback((midiNote: number, channel: number) => {
    setActiveNotes(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.delete(midiNote);
      return newSet;
    });
  }, []);

  // Handle MIDI messages
  const handleMIDIMessage = useCallback((message: any) => {
    const [status, data1, data2] = message.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;
    
    // Note On/Off Messages
    if (messageType === 0x90 || messageType === 0x80) {
      const isNoteOn = messageType === 0x90 && data2 > 0;
      
      if (isNoteOn) {
        handleNoteOn(data1, data2, channel);
      } else {
        handleNoteOff(data1, channel);
      }
    }
    // Control Change Messages (CC) - for sliders, knobs, modulation, etc.
    else if (messageType === 0xB0) {
      const controlNumber = data1;
      const controlValue = data2;
      
      console.log(`🎛️ MIDI Control Change: CC${controlNumber} = ${controlValue} (Channel ${channel + 1})`);
      
      // Common MIDI CC mappings
      switch (controlNumber) {
        case 1:   // Modulation Wheel
          console.log(`🎵 Modulation: ${Math.round((controlValue / 127) * 100)}%`);
          break;
        case 7:   // Volume
          console.log(`🔊 Volume: ${Math.round((controlValue / 127) * 100)}%`);
          break;
        case 10:  // Pan
          console.log(`🔄 Pan: ${Math.round((controlValue / 127) * 100)}%`);
          break;
        case 11:  // Expression
          console.log(`🎭 Expression: ${Math.round((controlValue / 127) * 100)}%`);
          break;
        case 64:  // Sustain Pedal
          console.log(`🦶 Sustain: ${controlValue > 63 ? 'ON' : 'OFF'}`);
          break;
        case 74:  // Filter Cutoff (often mapped to sliders)
          console.log(`🎚️ Filter: ${Math.round((controlValue / 127) * 100)}%`);
          break;
        default:
          console.log(`🎛️ Custom Control CC${controlNumber}: ${controlValue}`);
          break;
      }
    }
    // Pitch Bend Messages
    else if (messageType === 0xE0) {
      const pitchValue = (data2 << 7) | data1; // Combine 14-bit pitch bend value
      const pitchBendSemitones = ((pitchValue - 8192) / 8192) * 2; // ±2 semitones typical range
      console.log(`🎵 Pitch Bend: ${pitchBendSemitones.toFixed(2)} semitones`);
    }
  }, [handleNoteOn, handleNoteOff]);

  // Setup MIDI input listeners
  const setupMIDIInputs = useCallback((access: any) => {
    for (const input of access.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
    }
  }, [handleMIDIMessage]);

  // Update connected devices list
  const updateDeviceList = useCallback((access: any) => {
    const devices: MIDIDevice[] = [];
    
    for (const input of access.inputs.values()) {
      devices.push({
        id: input.id!,
        name: input.name || 'Unknown Input',
        manufacturer: input.manufacturer || 'Unknown',
        connection: 'input',
        state: input.state!
      });
    }
    
    for (const output of access.outputs.values()) {
      devices.push({
        id: output.id!,
        name: output.name || 'Unknown Output',
        manufacturer: output.manufacturer || 'Unknown',
        connection: 'output',
        state: output.state!
      });
    }
    
    setConnectedDevices(devices);
  }, []);

  // Initialize MIDI access
  const initializeMIDI = useCallback(async () => {
    if (!(navigator as any).requestMIDIAccess) {
      setIsSupported(false);
      return;
    }
    
    try {
      setIsSupported(true);
      const access = await (navigator as any).requestMIDIAccess();
      setMidiAccess(access);
      setIsConnected(true);
      
      access.onstatechange = () => {
        updateDeviceList(access);
      };
      
      updateDeviceList(access);
      setupMIDIInputs(access);
      
    } catch (error) {
      setIsSupported(false);
    }
  }, [updateDeviceList, setupMIDIInputs]);

  // Refresh devices
  const refreshDevices = useCallback(() => {
    if (midiAccess) {
      updateDeviceList(midiAccess);
    }
  }, [midiAccess, updateDeviceList]);

  // Initialize on mount
  useEffect(() => {
    initializeMIDI();
  }, [initializeMIDI]);

  return {
    isSupported,
    isConnected,
    connectedDevices,
    lastNote,
    activeNotes,
    initializeMIDI,
    refreshDevices,
    settings,
    updateSettings
  };
}