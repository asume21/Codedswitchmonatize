import { useState, useEffect, useCallback, useRef } from "react";
import { useAudio } from "./use-audio";
import { AudioEngine } from "@/lib/audio";

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

export function useMIDI() {
  const [midiAccess, setMidiAccess] = useState<any | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<MIDIDevice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastNote, setLastNote] = useState<MIDINote | null>(null);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [currentPitchBend, setCurrentPitchBend] = useState<number>(0); // -2 to +2 semitones
  const [currentModulation, setCurrentModulation] = useState<number>(0); // 0 to 1
  const [activeOscillators, setActiveOscillators] = useState<Map<number, any>>(
    new Map(),
  ); // Track active oscillators for pitch bend
  const [sliderDuration, setSliderDuration] = useState<number>(2.0); // Note duration from sliders
  const [knobSettings, setKnobSettings] = useState({
    reverb: 0,
    filter: 0.5,
    attack: 0.1,
    release: 0.5,
  });
  
  // Use the REAL AudioEngine (the one that already works!)
  const audioEngineRef = useRef<AudioEngine | null>(null);
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
    midiVolume: 0.3, // Default to 30% volume
  });
  const [autoConnectionEnabled, setAutoConnectionEnabled] = useState(true);

  const { playNote, playDrum } = useAudio();

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<MIDISettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Update master volume
  const setMasterVolume = useCallback((volume: number) => {
    if (audioEngineRef.current?.masterGain) {
      audioEngineRef.current.masterGain.gain.value = volume;
      console.log(`🔊 Master volume set to ${Math.round(volume * 100)}%`);
    }
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
  const handleNoteOn = useCallback(
    async (midiNote: number, velocity: number, channel: number) => {
      const { note, octave } = noteNumberToName(midiNote);
      const normalizedVelocity = velocity / 127;

      console.log(
        `🎵 DIRECT AUDIO: ${note}${octave} (MIDI ${midiNote}) velocity ${velocity}`,
      );

      setActiveNotes((prev) => new Set(Array.from(prev).concat(midiNote)));
      setLastNote({ note: midiNote, velocity, channel });

      // Use the REAL AudioEngine - the one that already works perfectly!
      try {
        // Initialize AudioEngine if needed
        if (!audioEngineRef.current) {
          audioEngineRef.current = new AudioEngine();
          await audioEngineRef.current.initialize();
          console.log('🎵 MIDI using real AudioEngine with all instruments!');
        }

        // Calculate frequency from MIDI note
        const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
        
        // Get instrument name from settings
        const instrument = settings.currentInstrument || 'piano';
        
        // Apply MIDI volume (multiply with velocity)
        const midiVolume = settings.midiVolume ?? 0.3;
        const adjustedVelocity = normalizedVelocity * midiVolume;
        
        // Play note using the REAL AudioEngine with all the synthesis magic!
        await audioEngineRef.current.playNote(
          frequency,
          1.0, // duration
          adjustedVelocity,
          instrument,
          true // sustain
        );

        console.log(
          `✅ MIDI ${instrument.toUpperCase()}: ${note}${octave} (${frequency.toFixed(1)}Hz) vel=${adjustedVelocity.toFixed(2)}`,
        );
      } catch (error) {
        console.error(`❌ AudioEngine playNote failed for ${note}${octave}:`, error);
      }
    },
    [noteNumberToName, playNote, settings.midiVolume, settings.currentInstrument],
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
  };
}
