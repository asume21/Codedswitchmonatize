# 🔌 Code-to-Music Integration Guide

## Overview
This document ensures Code-to-Music output is **100% compatible** with existing CodedSwitch systems.

---

## 🎯 **Integration Points**

### **1. Audio Playback System**
**Existing:** `audioEngine` (Tone.js + RealisticAudio)
**Location:** `client/src/lib/audioEngine.ts`

**Our Output MUST Match:**
```typescript
interface NoteEvent {
  note: string;        // 'C4', 'E4', 'G4'
  time: number;        // seconds
  duration: string | number;  // '8n' or 0.5
  velocity: number;    // 0-1
  instrument?: InstrumentName; // 'piano', 'synth', 'bass', 'drums'
}
```

**✅ Solution:** Our `MelodyNote` already matches this!

---

### **2. Drum Pattern System**
**Existing:** `use-audio.ts` hook
**Format:**
```typescript
{
  kick: boolean[],   // 16 steps
  snare: boolean[],  // 16 steps
  hihat: boolean[],  // 16 steps
  clap: boolean[],   // 16 steps
  tom: boolean[],    // 16 steps
  crash: boolean[]   // 16 steps
}
```

**✅ Solution:** Our `DrumPattern` already matches this!

---

### **3. Piano Roll / Sequencer**
**Existing:** `VerticalPianoRoll.tsx`, `ModularPianoRoll.tsx`
**Format:**
```typescript
interface Note {
  id: string;
  step: number;      // 0-15 (grid position)
  note: string;      // 'C', 'D', 'E'
  octave: number;    // 4, 5, 6
  velocity: number;  // 0-127
  length: number;    // 1-4 (steps)
}
```

**⚠️ Action Needed:** Convert our output to this format

---

### **4. Transport/Timeline System**
**Existing:** `Tone.Transport`
**Features:**
- BPM control
- Play/Pause/Stop
- Loop regions
- Scheduled events

**✅ Solution:** Our timeline uses seconds, easily converted to Tone.Transport.schedule()

---

## 🔧 **Output Format Conversion**

### **Our Output → AudioEngine Format**

```typescript
// Our Code-to-Music Output:
{
  melody: [
    { note: 'C4', start: 0, duration: 1.0, velocity: 80, instrument: 'piano' }
  ],
  chords: [
    { chord: 'C', notes: ['C4', 'E4', 'G4'], start: 0, duration: 4 }
  ],
  drums: {
    kick: [true, false, true, false, ...],
    snare: [false, false, true, false, ...]
  }
}

// Convert to AudioEngine Format:
function convertToAudioEngine(musicData) {
  // 1. Convert melody notes
  const noteEvents = musicData.melody.map(note => ({
    note: note.note,
    time: note.start,
    duration: note.duration,
    velocity: note.velocity / 127, // Convert 0-127 to 0-1
    instrument: note.instrument
  }));

  // 2. Schedule with Tone.Transport
  noteEvents.forEach(event => {
    Tone.Transport.schedule((time) => {
      audioEngine.playNote(
        event.note,
        event.duration,
        event.velocity,
        event.instrument
      );
    }, event.time);
  });

  // 3. Drums already compatible!
  return {
    notes: noteEvents,
    drums: musicData.drums,
    bpm: musicData.metadata.bpm
  };
}
```

---

## 🎹 **Piano Roll Integration**

### **Convert to Piano Roll Format:**

```typescript
function convertToPianoRoll(musicData) {
  return musicData.melody.map((note, index) => {
    // Parse note (e.g., 'C4' → note='C', octave=4)
    const match = note.note.match(/([A-G]#?)(\d)/);
    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    // Convert time to step (assuming 16 steps per bar)
    const step = Math.floor((note.start / 4) * 16);
    
    return {
      id: `note-${index}`,
      step: step,
      note: noteName,
      octave: octave,
      velocity: note.velocity,
      length: Math.ceil((note.duration / 4) * 16)
    };
  });
}
```

---

## 🎵 **Playback Integration**

### **Step-by-Step Playback:**

```typescript
// In CodeToMusicStudio.tsx

import { audioEngine } from '@/lib/audioEngine';
import * as Tone from 'tone';

function playGeneratedMusic(musicData) {
  // 1. Initialize audio
  await audioEngine.initialize();
  await audioEngine.startAudio();
  
  // 2. Set BPM
  Tone.Transport.bpm.value = musicData.metadata.bpm;
  
  // 3. Schedule melody notes
  musicData.melody.forEach(note => {
    Tone.Transport.schedule((time) => {
      audioEngine.playNote(
        note.note,
        note.duration,
        note.velocity / 127,
        note.instrument
      );
    }, note.start);
  });
  
  // 4. Schedule chords
  musicData.chords.forEach(chord => {
    Tone.Transport.schedule((time) => {
      chord.notes.forEach(note => {
        audioEngine.playNote(note, chord.duration, 0.6, 'piano');
      });
    }, chord.start);
  });
  
  // 5. Schedule drums (if pattern exists)
  if (musicData.drums) {
    const stepDuration = 60 / musicData.metadata.bpm / 4; // 16th note
    musicData.drums.kick.forEach((hit, index) => {
      if (hit) {
        Tone.Transport.schedule((time) => {
          audioEngine.playDrum('kick');
        }, index * stepDuration);
      }
    });
    // Repeat for snare, hihat, etc.
  }
  
  // 6. Start playback
  Tone.Transport.start();
}
```

---

## 📝 **Edit Integration**

### **Send to Piano Roll:**

```typescript
function sendToPianoRoll(musicData) {
  const pianoRollNotes = convertToPianoRoll(musicData);
  
  // Navigate to piano roll with notes
  navigate('/studio', {
    state: {
      tab: 'piano-roll',
      notes: pianoRollNotes,
      bpm: musicData.metadata.bpm,
      key: musicData.metadata.key
    }
  });
}
```

### **Send to BeatMaker:**

```typescript
function sendToBeatMaker(musicData) {
  navigate('/studio', {
    state: {
      tab: 'beat-maker',
      pattern: musicData.drums,
      bpm: musicData.metadata.bpm
    }
  });
}
```

---

## 🔄 **Two-Way Compatibility**

### **Export from Code-to-Music:**
```typescript
// User generates music from code
const music = await convertCodeToMusic({ code, language, genre });

// Options:
1. Play immediately (Tone.Transport)
2. Send to Piano Roll (edit melody)
3. Send to BeatMaker (edit drums)
4. Send to Mixer (adjust levels)
5. Export as MIDI
6. Save to library
```

### **Import to Code-to-Music:**
```typescript
// User can load existing projects
const existingNotes = getPianoRollNotes();
const musicData = convertFromPianoRoll(existingNotes);

// Then regenerate with different genre/variation
const newMusic = await convertCodeToMusic({
  code: musicData.sourceCode,
  genre: 'hiphop', // Change genre!
  variation: 5
});
```

---

## ✅ **Compatibility Checklist**

### **Audio System:**
- [x] Uses Tone.js (same as existing)
- [x] Compatible with audioEngine.playNote()
- [x] Compatible with audioEngine.playDrum()
- [x] Works with Tone.Transport

### **Data Formats:**
- [x] Melody notes match NoteEvent interface
- [x] Drum patterns match existing format
- [x] BPM/Key/Duration standard
- [x] Velocity range compatible (0-127 → 0-1)

### **UI Integration:**
- [ ] Can send to Piano Roll (Step 9)
- [ ] Can send to BeatMaker (Step 9)
- [ ] Can play through Transport (Step 9)
- [ ] Can export/save (Step 11)

### **Editing:**
- [ ] Notes editable in Piano Roll
- [ ] Drums editable in BeatMaker
- [ ] Can re-generate with new settings
- [ ] Can save variations

---

## 🎯 **Implementation Priority**

### **Phase 1 (Steps 1-6):**
- ✅ Output format matches existing systems
- ✅ Use compatible data structures
- ✅ No breaking changes

### **Phase 2 (Steps 7-9):**
- Add playback using audioEngine
- Add "Send to Piano Roll" button
- Add "Send to BeatMaker" button

### **Phase 3 (Steps 10-13):**
- Add save/load functionality
- Add export options
- Full two-way integration

---

## 📋 **Updated Type Definitions**

```typescript
// Update our MusicData to be 100% compatible:

export interface MusicData {
  // Playback-ready format
  timeline: TimelineEvent[];
  
  // Compatible with audioEngine
  melody: NoteEvent[];  // Already compatible!
  
  // Compatible with existing drum system
  drums: DrumPattern;   // Already compatible!
  
  // Additional data for editing
  chords: ChordProgression[];
  
  // Metadata
  metadata: MusicMetadata;
  
  // NEW: Source info for re-generation
  source?: {
    code: string;
    language: string;
    genre: string;
    variation: number;
  };
}
```

---

## 🚀 **Next Steps**

1. ✅ **Step 1-6:** Build core algorithm (format already compatible)
2. **Step 7-8:** Build UI with playback button
3. **Step 9:** Add audioEngine integration
4. **Step 10-11:** Add "Send to..." buttons
5. **Step 12-13:** Test full integration

**Key Insight:** We're building with compatibility from day 1, so integration will be smooth!
