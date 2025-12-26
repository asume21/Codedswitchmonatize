import { useState, useEffect, useCallback, useRef } from "react";
import { useAudio } from "./use-audio";
import { realisticAudio } from "@/lib/realisticAudio";
import { useInstrumentOptional } from "@/contexts/InstrumentContext";

// Global drum mode flag - shared across all useMIDI instances
// When true, MIDI notes only trigger drums (no instrument sounds)
let globalDrumMode = false;

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
  midiVolume?: number; // 0 to 1
}

// CC Message for monitoring
interface CCMessage {
  cc: number;
  value: number;
  channel: number;
  timestamp: number;
}

// MIDI Learn mapping
interface MIDIMapping {
  cc: number;
  parameter: string;
  label: string;
  min?: number;
  max?: number;
}

// Common controller profiles for AI suggestions
const COMMON_CC_MAPPINGS: Record<number, { name: string; typical: string }> = {
  1: { name: 'Modulation Wheel', typical: 'vibrato' },
  7: { name: 'Volume', typical: 'volume' },
  10: { name: 'Pan', typical: 'pan' },
  11: { name: 'Expression', typical: 'expression' },
  64: { name: 'Sustain Pedal', typical: 'sustain' },
  71: { name: 'Resonance/Timbre', typical: 'filter' },
  74: { name: 'Brightness/Cutoff', typical: 'filter' },
  91: { name: 'Reverb', typical: 'reverb' },
  93: { name: 'Chorus', typical: 'chorus' },
  // Common slider/knob ranges
  16: { name: 'General Purpose 1', typical: 'custom' },
  17: { name: 'General Purpose 2', typical: 'custom' },
  18: { name: 'General Purpose 3', typical: 'custom' },
  19: { name: 'General Purpose 4', typical: 'custom' },
  20: { name: 'Slider/Knob', typical: 'custom' },
  21: { name: 'Slider/Knob', typical: 'custom' },
  22: { name: 'Slider/Knob', typical: 'custom' },
  23: { name: 'Slider/Knob', typical: 'custom' },
};

export function useMIDI() {
  const [midiAccess, setMidiAccess] = useState<any | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<MIDIDevice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastNote, setLastNote] = useState<MIDINote | null>(null);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [currentPitchBend, setCurrentPitchBend] = useState<number>(0);
  const [currentModulation, setCurrentModulation] = useState<number>(0);
  const [activeOscillators, setActiveOscillators] = useState<Map<number, any>>(
    new Map(),
  );
  const [sliderDuration, setSliderDuration] = useState<number>(2.0);
  const [knobSettings, setKnobSettings] = useState({
    reverb: 0,
    filter: 0.5,
    attack: 0.1,
    release: 0.5,
  });
  
  // MIDI Learn state
  const [isLearning, setIsLearning] = useState(false);
  const [learningParameter, setLearningParameter] = useState<string | null>(null);
  const [ccHistory, setCcHistory] = useState<CCMessage[]>([]);
  const [customMappings, setCustomMappings] = useState<MIDIMapping[]>(() => {
    // Load saved mappings from localStorage
    try {
      const saved = localStorage.getItem('midi-custom-mappings');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [lastCC, setLastCC] = useState<CCMessage | null>(null);
  
  const audioInitializedRef = useRef<boolean>(false);
  
  // Drum mode state (local for React reactivity, but uses global flag for actual checks)
  const [drumMode, setDrumModeState] = useState(globalDrumMode);
  
  const setDrumMode = useCallback((enabled: boolean) => {
    globalDrumMode = enabled; // Update global flag (shared across all useMIDI instances)
    setDrumModeState(enabled); // Update local state for React
    console.log(`🥁 MIDI Drum Mode (GLOBAL): ${enabled ? 'ON' : 'OFF'}`);
  }, []);
  
  const globalInstrument = useInstrumentOptional();
  
  const settingsRef = useRef<MIDISettings>({
    inputDevice: "all",
    velocitySensitivity: [100],
    channelMode: "multi",
    activeChannel: 1,
    noteRange: { min: 21, max: 108 },
    sustainPedal: true,
    pitchBend: true,
    modulation: true,
    autoConnect: true,
    currentInstrument: "piano",
    midiVolume: 0.3,
  });
  
  const [settings, setSettings] = useState<MIDISettings>({
    inputDevice: "all",
    velocitySensitivity: [100],
    channelMode: "multi",
    activeChannel: 1,
    noteRange: { min: 21, max: 108 },
    sustainPedal: true,
    pitchBend: true,
    modulation: true,
    autoConnect: true,
    currentInstrument: "piano",
    midiVolume: 0.3,
  });
  const [autoConnectionEnabled, setAutoConnectionEnabled] = useState(true);

  const { playNote, playDrum } = useAudio();

  useEffect(() => {
    if (globalInstrument?.currentInstrument) {
      setSettings(prev => ({ ...prev, currentInstrument: globalInstrument.currentInstrument }));
    }
  }, [globalInstrument?.currentInstrument]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<MIDISettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Update master volume
  const setMasterVolume = useCallback((volume: number) => {
    // realisticAudio handles volume internally
    console.log(`🔊 Master volume set to ${Math.round(volume * 100)}%`);
  }, []);

  // MIDI Learn functions
  const startLearning = useCallback((parameter: string) => {
    setIsLearning(true);
    setLearningParameter(parameter);
    console.log(`🎓 MIDI Learn started for: ${parameter}`);
  }, []);

  const stopLearning = useCallback(() => {
    setIsLearning(false);
    setLearningParameter(null);
    console.log('🎓 MIDI Learn stopped');
  }, []);

  const addMapping = useCallback((cc: number, parameter: string, label: string) => {
    const newMapping: MIDIMapping = { cc, parameter, label };
    setCustomMappings(prev => {
      // Remove existing mapping for this parameter
      const filtered = prev.filter(m => m.parameter !== parameter);
      const updated = [...filtered, newMapping];
      // Save to localStorage
      localStorage.setItem('midi-custom-mappings', JSON.stringify(updated));
      return updated;
    });
    console.log(`✅ Mapped CC${cc} to ${parameter}`);
  }, []);

  const removeMapping = useCallback((parameter: string) => {
    setCustomMappings(prev => {
      const updated = prev.filter(m => m.parameter !== parameter);
      localStorage.setItem('midi-custom-mappings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAllMappings = useCallback(() => {
    setCustomMappings([]);
    localStorage.removeItem('midi-custom-mappings');
    console.log('🗑️ All MIDI mappings cleared');
  }, []);

  // Get AI suggestion for a CC number
  const getAISuggestion = useCallback((cc: number): { name: string; suggestion: string } => {
    const known = COMMON_CC_MAPPINGS[cc];
    if (known) {
      return { name: known.name, suggestion: known.typical };
    }
    // AI heuristics for unknown CCs
    if (cc >= 0 && cc <= 31) {
      return { name: `Controller ${cc}`, suggestion: 'Likely a slider or knob - try mapping to volume, filter, or effect' };
    }
    if (cc >= 32 && cc <= 63) {
      return { name: `LSB for CC${cc - 32}`, suggestion: 'Fine control for another parameter' };
    }
    if (cc >= 102 && cc <= 119) {
      return { name: `Undefined ${cc}`, suggestion: 'Custom control - map to any parameter' };
    }
    return { name: `CC ${cc}`, suggestion: 'Unknown - move the control again to identify' };
  }, []);

  // Clear CC history
  const clearCCHistory = useCallback(() => {
    setCcHistory([]);
  }, []);

  // MIDI note number to note name conversion
  const noteNumberToName = useCallback((noteNumber: number) => {
    const noteNames = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return { note: noteName, octave };
  }, []);

  // Map MIDI channels to instruments
  const getMIDIChannelInstrument = useCallback(
    (channel: number): string => {
      // Use the selected instrument from settings
      const instrumentMap: { [key: string]: string } = {
        piano: "piano-keyboard",
        guitar: "strings-guitar",
        bass: "bass-electric",
        violin: "strings-violin",
        flute: "flute-concert",
        trumpet: "horns-trumpet",
        organ: "piano-organ",
      };

      return (
        instrumentMap[settings.currentInstrument || "piano"] || "piano-keyboard"
      );
    },
    [settings.currentInstrument],
  );

  // DIRECT AUDIO NOTE HANDLER - Immediate sound playback
  // Uses settingsRef to always get current settings (prevents stale closure issues)
  const handleNoteOn = useCallback(
    async (midiNote: number, velocity: number, channel: number) => {
      const { note, octave } = noteNumberToName(midiNote);
      const normalizedVelocity = velocity / 127;

      console.log(
        `🎵 DIRECT AUDIO: ${note}${octave} (MIDI ${midiNote}) velocity ${velocity}`,
      );

      setActiveNotes((prev) => new Set(Array.from(prev).concat(midiNote)));
      setLastNote({ note: midiNote, velocity, channel });

      // If in drum mode, skip instrument sounds (let beat maker handle it)
      if (globalDrumMode) {
        console.log(`🥁 Drum mode active - skipping instrument sound for MIDI ${midiNote}`);
        return;
      }

      // Use realisticAudio - same audio system as Piano Roll for consistent sound
      try {
        // Initialize realisticAudio if needed
        if (!audioInitializedRef.current) {
          await realisticAudio.initialize();
          audioInitializedRef.current = true;
          console.log('🎵 MIDI using realisticAudio (same as Piano Roll)!');
        }

        // Get instrument name from settingsRef (always current, no stale closure)
        const currentSettings = settingsRef.current;
        // Use the exact instrument name - no mapping needed since we use same system as Piano Roll
        const instrument = currentSettings.currentInstrument || 'piano';
        
        // Apply MIDI volume (multiply with velocity)
        const midiVolume = currentSettings.midiVolume ?? 0.5;
        const adjustedVelocity = normalizedVelocity * midiVolume;
        
        // Play note using realisticAudio - same API as Piano Roll
        // realisticAudio.playNote(note, octave, duration, instrument, velocity)
        await realisticAudio.playNote(
          note,
          octave,
          0.5, // shorter duration for snappier MIDI response
          instrument,
          adjustedVelocity
        );

        console.log(
          `✅ MIDI [${instrument}]: ${note}${octave} vel=${adjustedVelocity.toFixed(2)}`,
        );
      } catch (error) {
        console.error(`❌ realisticAudio playNote failed for ${note}${octave}:`, error);
      }
    },
    [noteNumberToName],
  );

  // Handle note off events
  const handleNoteOff = useCallback((midiNote: number, channel: number) => {
    setActiveNotes((prev) => {
      const newSet = new Set(Array.from(prev));
      newSet.delete(midiNote);
      return newSet;
    });
  }, []);

  // Handle MIDI messages
  const handleMIDIMessage = useCallback(
    (message: any) => {
      const [status, data1, data2] = message.data;
      const channel = status & 0x0f;
      const messageType = status & 0xf0;

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
      else if (messageType === 0xb0) {
        const controlNumber = data1;
        const controlValue = data2;

        console.log(
          `🎛️ MIDI Control Change: CC${controlNumber} = ${controlValue} (Channel ${channel + 1})`,
        );

        // Record CC to history for monitoring
        const ccMsg: CCMessage = {
          cc: controlNumber,
          value: controlValue,
          channel,
          timestamp: Date.now(),
        };
        setLastCC(ccMsg);
        setCcHistory(prev => {
          const updated = [ccMsg, ...prev].slice(0, 50); // Keep last 50
          return updated;
        });

        // MIDI Learn mode - capture CC for mapping
        if (isLearning && learningParameter) {
          const suggestion = getAISuggestion(controlNumber);
          addMapping(controlNumber, learningParameter, suggestion.name);
          stopLearning();
          // Dispatch event for UI notification
          window.dispatchEvent(new CustomEvent('midi-learn-complete', {
            detail: { cc: controlNumber, parameter: learningParameter, name: suggestion.name }
          }));
        }

        // Check custom mappings first
        const customMapping = customMappings.find(m => m.cc === controlNumber);
        if (customMapping) {
          const normalizedValue = controlValue / 127;
          window.dispatchEvent(new CustomEvent('midi-cc-mapped', {
            detail: { parameter: customMapping.parameter, value: normalizedValue, cc: controlNumber }
          }));
        }

        // Common MIDI CC mappings
        switch (controlNumber) {
          case 1: // Modulation Wheel
            const modAmount = controlValue / 127;
            setCurrentModulation(modAmount);
            console.log(`🎵 Modulation: ${Math.round(modAmount * 100)}%`);

            // Apply vibrato effect to all active oscillators
            activeOscillators.forEach((oscData, noteNumber) => {
              if (
                oscData.oscillator &&
                oscData.baseFrequency &&
                oscData.audioContext
              ) {
                // Create or update LFO for vibrato
                if (!oscData.lfo) {
                  oscData.lfo = oscData.audioContext.createOscillator();
                  oscData.lfoGain = oscData.audioContext.createGain();
                  oscData.lfo.frequency.setValueAtTime(
                    5,
                    oscData.audioContext.currentTime,
                  ); // 5Hz vibrato
                  oscData.lfo.connect(oscData.lfoGain);
                  oscData.lfoGain.connect(oscData.oscillator.frequency);
                  oscData.lfo.start();
                }
                // Modulation depth: 0 to 10 cents (0.1 semitone)
                const vibratoDepth = modAmount * oscData.baseFrequency * 0.006; // ~10 cents max
                oscData.lfoGain.gain.setValueAtTime(
                  vibratoDepth,
                  oscData.audioContext.currentTime,
                );
              }
            });
            break;
          case 7: // Volume
            console.log(
              `🔊 Volume: ${Math.round((controlValue / 127) * 100)}%`,
            );
            break;
          case 10: // Pan
            console.log(`🔄 Pan: ${Math.round((controlValue / 127) * 100)}%`);
            break;
          case 11: // Expression
            console.log(
              `🎭 Expression: ${Math.round((controlValue / 127) * 100)}%`,
            );
            break;
          case 64: // Sustain Pedal
            console.log(`🦶 Sustain: ${controlValue > 63 ? "ON" : "OFF"}`);
            break;
          case 71: // Filter/Resonance (Common knob)
          case 74: // Filter Cutoff (often mapped to sliders)
            const filterVal = controlValue / 127;
            setKnobSettings((prev) => ({ ...prev, filter: filterVal }));
            console.log(`🎚️ Filter: ${Math.round(filterVal * 100)}%`);
            break;
          case 72: // Release Time
          case 73: // Attack Time
          case 75: // Sound Control 6 (often a slider)
          case 76: // Sound Control 7 (often a slider)
          case 77: // Sound Control 8 (often a slider)
          case 78: // Sound Control 9 (often a slider)
          case 79: // Sound Control 10 (often a slider)
            // Map sliders to note duration (0.1 to 5 seconds)
            const duration = 0.1 + (controlValue / 127) * 4.9;
            setSliderDuration(duration);
            console.log(
              `⏱️ Note Duration: ${duration.toFixed(1)}s (CC${controlNumber})`,
            );
            break;
          case 91: // Reverb/Effects (common knob)
            const reverbVal = controlValue / 127;
            setKnobSettings((prev) => ({ ...prev, reverb: reverbVal }));
            console.log(`🌊 Reverb: ${Math.round(reverbVal * 100)}%`);
            break;
          case 93: // Chorus (common knob)
            const attackVal = (controlValue / 127) * 0.5; // 0 to 0.5 seconds
            setKnobSettings((prev) => ({ ...prev, attack: attackVal }));
            console.log(`📈 Attack: ${attackVal.toFixed(2)}s`);
            break;
          case 94: // Detune/Release
            const releaseVal = (controlValue / 127) * 2; // 0 to 2 seconds
            setKnobSettings((prev) => ({ ...prev, release: releaseVal }));
            console.log(`📉 Release: ${releaseVal.toFixed(2)}s`);
            break;
          default:
            // Map any unmapped CC to duration for flexibility
            if (controlNumber >= 20 && controlNumber <= 31) {
              // Common slider range
              const duration = 0.1 + (controlValue / 127) * 4.9;
              setSliderDuration(duration);
              console.log(
                `⏱️ Note Duration: ${duration.toFixed(1)}s (CC${controlNumber})`,
              );
            } else {
              console.log(
                `🎛️ Custom Control CC${controlNumber}: ${controlValue}`,
              );
            }
            break;
        }
      }
      // Pitch Bend Messages
      else if (messageType === 0xe0) {
        const pitchValue = (data2 << 7) | data1; // Combine 14-bit pitch bend value
        const pitchBendSemitones = ((pitchValue - 8192) / 8192) * 2; // ±2 semitones typical range
        setCurrentPitchBend(pitchBendSemitones);
        console.log(
          `🎵 Pitch Bend: ${pitchBendSemitones.toFixed(2)} semitones`,
        );

        // Apply pitch bend to all active oscillators
        activeOscillators.forEach((oscData, noteNumber) => {
          if (oscData.oscillator && oscData.baseFrequency) {
            const bendFactor = Math.pow(2, pitchBendSemitones / 12); // Convert semitones to frequency multiplier
            const newFrequency = oscData.baseFrequency * bendFactor;
            oscData.oscillator.frequency.setValueAtTime(
              newFrequency,
              oscData.audioContext.currentTime,
            );
          }
        });
      }
    },
    [
      handleNoteOn,
      handleNoteOff,
      activeOscillators,
      setCurrentPitchBend,
      setCurrentModulation,
      setKnobSettings,
      setSliderDuration,
    ],
  );

  // SIMPLE MIDI INPUT SETUP
  const setupMIDIInputs = useCallback(
    (access: any) => {
      console.log("🔌 Simple MIDI setup...");

      for (const input of access.inputs.values()) {
        if (input.state === "connected") {
          input.onmidimessage = (msg: any) => {
            const [status, note, velocity] = msg.data;
            if ((status & 0xf0) === 0x90 && velocity > 0) {
              console.log(`🎵 NOTE ON: ${note}`);
              handleNoteOn(note, velocity, status & 0x0f);
            } else if (
              (status & 0xf0) === 0x80 ||
              ((status & 0xf0) === 0x90 && velocity === 0)
            ) {
              console.log(`🎵 NOTE OFF: ${note}`);
              handleNoteOff(note, status & 0x0f);
            }
          };
          console.log(`✅ Setup: ${input.name}`);
        }
      }
    },
    [handleNoteOn, handleNoteOff],
  );

  // Update connected devices list
  const updateDeviceList = useCallback((access: any) => {
    const devices: MIDIDevice[] = [];

    for (const input of access.inputs.values()) {
      devices.push({
        id: input.id!,
        name: input.name || "Unknown Input",
        manufacturer: input.manufacturer || "Unknown",
        connection: "input",
        state: input.state!,
      });
    }

    for (const output of access.outputs.values()) {
      devices.push({
        id: output.id!,
        name: output.name || "Unknown Output",
        manufacturer: output.manufacturer || "Unknown",
        connection: "output",
        state: output.state!,
      });
    }

    setConnectedDevices(devices);
  }, []);

  // Auto-detect new MIDI devices
  const handleDeviceStateChange = useCallback(
    (e: any) => {
      console.log("🔄 MIDI device state changed:", e.port.name, e.port.state);

      if (e.port.state === "connected") {
        console.log(
          "✨ NEW MIDI DEVICE CONNECTED:",
          e.port.name,
          e.port.manufacturer,
        );

        // Show user notification
        if (typeof window !== "undefined" && window.dispatchEvent) {
          window.dispatchEvent(
            new CustomEvent("midi-device-connected", {
              detail: {
                name: e.port.name,
                manufacturer: e.port.manufacturer,
                type: e.port.type,
              },
            }),
          );
        }

        // Automatically setup input if it's an input device
        if (e.port.type === "input" && autoConnectionEnabled) {
          e.port.onmidimessage = handleMIDIMessage;
          console.log("✅ Auto-connected to MIDI input:", e.port.name);
        }
      } else if (e.port.state === "disconnected") {
        console.log("⚠️ MIDI DEVICE DISCONNECTED:", e.port.name);
      }

      // Update device list
      if (midiAccess) {
        updateDeviceList(midiAccess);
      }
    },
    [handleMIDIMessage, autoConnectionEnabled, midiAccess, updateDeviceList],
  );

  // SIMPLIFIED MIDI INITIALIZATION - Direct connection approach
  const initializeMIDI = useCallback(async () => {
    console.log("🎹 === SIMPLE MIDI INIT STARTING ===");

    if (!(navigator as any).requestMIDIAccess) {
      console.log("❌ Web MIDI API not supported");
      setIsSupported(false);
      return;
    }

    try {
      console.log("🔑 Requesting basic MIDI access...");
      setIsSupported(true);

      // Simple, basic MIDI access request
      const access = await (navigator as any).requestMIDIAccess();

      console.log("✅ MIDI ACCESS SUCCESS!");
      console.log("Inputs:", access.inputs.size);
      console.log("Outputs:", access.outputs.size);

      setMidiAccess(access);

      // Simple device listing
      console.log("💵 MIDI DEVICES FOUND:");
      for (const input of access.inputs.values()) {
        console.log(`🎹 INPUT: ${input.name} (${input.state})`);
      }

      // DIRECT MESSAGE HANDLER SETUP
      console.log("🔌 Setting up direct MIDI listeners...");
      for (const input of access.inputs.values()) {
        if (input.state === "connected") {
          input.onmidimessage = (msg: any) => {
            console.log(`✨ MIDI from ${input.name}:`, msg.data);
            const [status, note, velocity] = msg.data;

            // SIMPLE NOTE ON (144 + channel, or 0x90)
            if ((status & 0xf0) === 0x90 && velocity > 0) {
              console.log(`🎵 NOTE ON: ${note} velocity ${velocity}`);
              handleNoteOn(note, velocity, status & 0x0f);
            }
            // SIMPLE NOTE OFF (128 + channel, or 0x80, or note on with velocity 0)
            else if (
              (status & 0xf0) === 0x80 ||
              ((status & 0xf0) === 0x90 && velocity === 0)
            ) {
              console.log(`🎵 NOTE OFF: ${note}`);
              handleNoteOff(note, status & 0x0f);
            }
          };
          console.log(`✅ Connected to: ${input.name}`);
        }
      }

      // Set connection status
      const hasInputs = access.inputs.size > 0;
      setIsConnected(hasInputs);

      if (hasInputs) {
        console.log("✨ MIDI SYSTEM READY! Press keys on your controller.");
      } else {
        console.log("⚠️ No MIDI controllers found. Connect one and refresh.");
      }

      // Update device list
      updateDeviceList(access);

      // Simple state change handler
      access.onstatechange = (e: any) => {
        console.log(`🔄 MIDI device ${e.port.state}: ${e.port.name}`);
        if (e.port.state === "connected") {
          console.log("✨ New device connected - setting up listener...");
          e.port.onmidimessage = (msg: any) => {
            console.log(`✨ MIDI from ${e.port.name}:`, msg.data);
            const [status, note, velocity] = msg.data;
            if ((status & 0xf0) === 0x90 && velocity > 0) {
              handleNoteOn(note, velocity, status & 0x0f);
            } else if (
              (status & 0xf0) === 0x80 ||
              ((status & 0xf0) === 0x90 && velocity === 0)
            ) {
              handleNoteOff(note, status & 0x0f);
            }
          };
        }
        updateDeviceList(access);
        setIsConnected(access.inputs.size > 0);
      };
    } catch (error) {
      console.error("❌ MIDI FAILED:", error);
      setIsSupported(false);
      setIsConnected(false);
    }
  }, [updateDeviceList, handleNoteOn, handleNoteOff]);

  // Enhanced device refresh with forced reconnection
  const refreshDevices = useCallback(() => {
    console.log("🔄 REFRESHING MIDI DEVICES...");

    if (midiAccess) {
      console.log("Rescanning connected devices...");
      updateDeviceList(midiAccess);
      setupMIDIInputs(midiAccess);

      const inputCount = midiAccess.inputs.size;
      const outputCount = midiAccess.outputs.size;

      console.log(
        `📊 Device refresh complete: ${inputCount} inputs, ${outputCount} outputs`,
      );
      setIsConnected(inputCount > 0 || outputCount > 0);
    } else {
      console.log(
        "⚠️ No MIDI access available - attempting reinitialization...",
      );
      initializeMIDI();
    }
  }, [midiAccess, updateDeviceList, setupMIDIInputs, initializeMIDI]);

  // Enhanced auto-initialization with multiple detection methods
  // Use ref to prevent infinite initialization loop
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    // Only initialize once
    if (!hasInitialized.current) {
      console.log("🚀 MIDI HOOK INITIALIZING...");
      hasInitialized.current = true;
      
      // Immediate initialization
      initializeMIDI();

      // Additional detection after delay (for devices that connect slowly)
      const delayedDetection = setTimeout(() => {
        console.log("🔍 Secondary MIDI device scan...");
        if (midiAccess) {
          refreshDevices();
        }
      }, 2000);

      // Cleanup delayed detection on unmount
      return () => {
        clearTimeout(delayedDetection);
      };
    }
  }, []); // Empty dependency array - only run once on mount

  // Separate effect for visibility/focus handlers
  useEffect(() => {
    // Enhanced visibility change handler
    const handleVisibilityChange = () => {
      if (!document.hidden && autoConnectionEnabled && hasInitialized.current) {
        console.log("🔄 Tab became visible - forcing MIDI rescan...");
        setTimeout(() => {
          refreshDevices();
        }, 500);
      }
    };

    // Focus handler for additional detection
    const handleWindowFocus = () => {
      if (autoConnectionEnabled && hasInitialized.current) {
        console.log("🎯 Window focused - checking MIDI devices...");
        setTimeout(() => {
          refreshDevices();
        }, 200);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnectionEnabled]); // Removed refreshDevices to prevent infinite loop

  return {
    isSupported,
    isConnected,
    connectedDevices,
    lastNote,
    activeNotes,
    initializeMIDI,
    refreshDevices,
    settings,
    updateSettings,
    setMasterVolume,
    autoConnectionEnabled,
    setAutoConnectionEnabled,
    currentPitchBend,
    currentModulation,
    knobSettings,
    sliderDuration,
    drumMode,
    setDrumMode,
    // MIDI Learn exports
    isLearning,
    learningParameter,
    startLearning,
    stopLearning,
    addMapping,
    removeMapping,
    clearAllMappings,
    customMappings,
    // CC Monitoring exports
    lastCC,
    ccHistory,
    clearCCHistory,
    getAISuggestion,
  };
}
