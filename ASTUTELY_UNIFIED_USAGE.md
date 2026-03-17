# 🎵 Astutely Unified Generation - Usage Guide

## What is Unified Generation?

Unified generation combines **pattern generation** (MIDI notes) and **professional audio generation** into a single function call. This gives users:

✅ **Professional AI-generated audio** to listen to  
✅ **Editable MIDI patterns** in Piano Roll  
✅ **Instrument assignments** for each track  
✅ **Same musical output** in both forms  

---

## How to Use

### Option 1: Using AstutelyCoreContext (Recommended)

```typescript
import { useAstutelyCore } from '@/contexts/AstutelyCoreContext';

function MyComponent() {
  const { generateComplete } = useAstutelyCore();

  const handleGenerate = async () => {
    try {
      const result = await generateComplete({
        style: 'Travis Scott rage',
        prompt: 'dark atmospheric trap beat',
        tempo: 150,
        key: 'C',
      });

      // Result contains:
      // - result.pattern: MIDI pattern data
      // - result.audio: { audioUrl, duration, provider }
      // - result.instruments: { bass, chords, melody, drumKit }
      // - result.notes: Array of notes ready for track store

      console.log('Generated!', result);
      // Audio auto-plays
      // Pattern auto-broadcasts to Piano Roll
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  return <button onClick={handleGenerate}>Generate Complete Music</button>;
}
```

### Option 2: Direct Function Call

```typescript
import { astutelyGenerateComplete } from '@/lib/astutelyEngine';

const result = await astutelyGenerateComplete({
  style: 'The Weeknd dark',
  tempo: 108,
  key: 'Ab',
});

// Play the audio
import { astutelyPlayAudio } from '@/lib/astutelyEngine';
await astutelyPlayAudio(result.audio.audioUrl);

// Add pattern to Piano Roll
import { astutelyToNotes } from '@/lib/astutelyEngine';
const notes = result.notes; // Already converted!
```

---

## What You Get Back

```typescript
interface AstutelyCompleteResult {
  pattern: AstutelyResult;           // Full pattern data
  audio: {
    audioUrl: string;                // Professional audio URL
    duration: number;                // Duration in seconds
    provider: string;                // 'suno' or 'musicgen'
  };
  instruments: {
    bass: string;                    // e.g., 'synth_bass_1'
    chords: string;                  // e.g., 'acoustic_grand_piano'
    melody: string;                  // e.g., 'flute'
    drumKit: string;                 // e.g., '808'
  };
  notes: Array<{                     // Ready for track store
    id: string;
    pitch: number;
    startStep: number;
    duration: number;
    velocity: number;
    trackType: 'drums' | 'bass' | 'chords' | 'melody';
  }>;
}
```

---

## Migration Guide

### Before (Separate Calls):

```typescript
// Old way - pattern only
const pattern = await generatePattern({ style: 'Travis Scott rage' });
const notes = astutelyToNotes(pattern);
// No audio, just MIDI sounds

// OR

// Old way - audio only
const audio = await generateRealAudio('Travis Scott rage');
// Professional audio but no pattern to edit
```

### After (Unified):

```typescript
// New way - both at once!
const result = await generateComplete({ style: 'Travis Scott rage' });
// Has BOTH professional audio AND editable pattern
// Same BPM, same key, same musical content
```

---

## Benefits

1. **No Disconnect**: Audio and pattern match perfectly
2. **Better UX**: Users get professional sound + editing capability
3. **Efficiency**: One call instead of two
4. **Consistency**: Same BPM, key, and style across both outputs

---

## Example: Full Integration

```typescript
import { useAstutelyCore } from '@/contexts/AstutelyCoreContext';
import { useTrackStore } from '@/contexts/TrackStoreContext';

function AstutelyPanel() {
  const { generateComplete, isGeneratingPattern, isGeneratingAudio } = useAstutelyCore();
  const { addNotes } = useTrackStore();

  const handleGenerate = async () => {
    const result = await generateComplete({
      style: 'Drake smooth',
      tempo: 130,
      key: 'G',
    });

    // Audio auto-plays via context
    // Pattern auto-broadcasts to Piano Roll

    // Optionally add to specific tracks manually:
    const drumNotes = result.notes.filter(n => n.trackType === 'drums');
    const bassNotes = result.notes.filter(n => n.trackType === 'bass');
    
    addNotes('drums-track-id', drumNotes);
    addNotes('bass-track-id', bassNotes);
  };

  const isGenerating = isGeneratingPattern || isGeneratingAudio;

  return (
    <button onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating ? 'Generating...' : 'Generate Complete Music'}
    </button>
  );
}
```

---

## Status

✅ **Backend**: Both endpoints working (`/api/astutely` + `/api/astutely/generate-audio`)  
✅ **Frontend**: Unified function created (`astutelyGenerateComplete`)  
✅ **Context**: Integrated into `AstutelyCoreContext`  
✅ **Kill Switch**: Audio player registered with global kill switch  

**Next Steps**: Update existing components to use `generateComplete` instead of separate calls.
