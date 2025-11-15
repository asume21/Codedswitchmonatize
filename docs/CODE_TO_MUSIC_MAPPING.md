# 🎵 Code-to-Music Conversion Rules

## Current Mapping (Basic)

### **Code Element → Instrument Mapping:**
```
classes      → piano
functions    → violin/guitar
variables    → bass
loops        → drums
```

---

## 🚀 Enhanced Mapping (Recommended)

### **1. Structural Elements:**
```
Classes/Objects     → Piano (foundation, chords)
Functions/Methods   → Lead instruments (violin, guitar, synth)
Variables           → Bass (rhythm section)
Loops               → Drums (repetitive patterns)
Conditionals (if)   → Cymbal hits (decision points)
Try/Catch           → Tension/Resolution (dissonance → consonance)
Comments            → Ambient pads (background texture)
```

### **2. Code Complexity → Musical Complexity:**
```
Lines of Code:
1-10 lines    → Simple melody (4-8 notes)
11-50 lines   → Moderate melody (8-16 notes)
50+ lines     → Complex composition (16+ notes, multiple instruments)

Nesting Depth:
Level 1       → Single instrument
Level 2-3     → 2-3 instruments
Level 4+      → Full orchestration
```

### **3. Data Types → Note Characteristics:**
```
Strings       → Sustained notes (longer duration)
Integers      → Staccato notes (short, punchy)
Floats        → Gliding notes (pitch bends)
Booleans      → On/off percussion hits
Arrays/Lists  → Arpeggios (note sequences)
Objects       → Chords (multiple notes together)
```

### **4. Code Patterns → Musical Patterns:**
```
Recursion          → Canon (repeating melody at different times)
Inheritance        → Theme and variations
Polymorphism       → Same melody, different instruments
Iteration          → Ostinato (repeating pattern)
Function Calls     → Call and response
Return Statements  → Cadence (musical resolution)
```

### **5. Variable Names → Musical Mood:**
```
error, fail, bug   → Minor key, dissonant
success, win, done → Major key, consonant
fast, quick, speed → Higher tempo
slow, wait, delay  → Lower tempo
big, large, max    → Louder dynamics
small, min, tiny   → Softer dynamics
```

---

## 📝 Example Conversion

### **Input Code:**
```python
class MusicPlayer:
    def __init__(self):
        self.volume = 50
    
    def play(self):
        for i in range(4):
            if self.volume > 0:
                print("Playing...")
```

### **Output Music:**
```json
{
  "structure": {
    "class_MusicPlayer": {
      "instrument": "piano",
      "notes": ["C4", "E4", "G4"],
      "type": "chord"
    },
    "function_init": {
      "instrument": "violin",
      "notes": ["E4", "G4"],
      "duration": 1.0
    },
    "variable_volume": {
      "instrument": "bass",
      "note": "C2",
      "value": 50,
      "velocity": 50
    },
    "function_play": {
      "instrument": "guitar",
      "notes": ["G4", "A4", "B4"],
      "duration": 1.5
    },
    "loop_range_4": {
      "instrument": "drums",
      "pattern": {
        "kick": [true, false, true, false],
        "snare": [false, true, false, true]
      },
      "iterations": 4
    },
    "conditional_if": {
      "instrument": "cymbal",
      "note": "crash",
      "trigger": "volume > 0"
    }
  },
  "timeline": [
    {"time": 0.0, "event": "piano_chord_C4_E4_G4"},
    {"time": 0.5, "event": "violin_E4"},
    {"time": 1.0, "event": "bass_C2"},
    {"time": 1.5, "event": "guitar_G4"},
    {"time": 2.0, "event": "drums_start_loop"},
    {"time": 2.5, "event": "cymbal_crash"}
  ],
  "metadata": {
    "bpm": 120,
    "key": "C Major",
    "mood": "Neutral",
    "complexity": 6
  }
}
```

---

## 🎯 Improved Prompt Template

```typescript
const prompt = `You are an expert code-to-music translator with deep knowledge of both programming and music theory.

TASK: Convert this ${language} code into a musical composition.

CODE:
${code}

CONVERSION RULES (MANDATORY):

1. STRUCTURAL MAPPING:
   - Classes/Objects → Piano chords (foundation)
   - Functions/Methods → Lead melodies (violin, guitar, synth)
   - Variables → Bass notes (values affect pitch/velocity)
   - Loops → Drum patterns (iterations = pattern length)
   - Conditionals → Cymbal hits (decision points)
   - Try/Catch → Tension/Resolution (dissonance → consonance)

2. MUSICAL PROPERTIES:
   - Code complexity → Musical complexity
   - Nesting depth → Number of instruments
   - Variable values → Note velocities (0-127)
   - Function length → Melody length
   - Loop count → Pattern repetitions

3. DATA TYPE MAPPING:
   - Strings → Sustained notes (duration: 1.0s)
   - Integers → Staccato notes (duration: 0.25s)
   - Floats → Gliding notes (pitch bends)
   - Booleans → Percussion hits (true=hit, false=rest)
   - Arrays → Arpeggios (note sequences)
   - Objects → Chords (simultaneous notes)

4. MOOD DETECTION:
   - Analyze variable/function names for mood keywords
   - error/fail/bug → Minor key, dissonant
   - success/win/done → Major key, consonant
   - fast/quick → Higher BPM (140+)
   - slow/wait → Lower BPM (80-)

5. TIMELINE CONSTRUCTION:
   - Order events by code execution flow
   - Simultaneous code blocks → Simultaneous notes
   - Sequential code → Sequential notes
   - Nested blocks → Layered instruments

REQUIRED OUTPUT FORMAT:
{
  "melody": [
    {
      "note": "C4",
      "start": 0.0,
      "duration": 1.0,
      "frequency": 261.63,
      "instrument": "piano",
      "velocity": 80,
      "source": "class ClassName"
    }
  ],
  "drumPattern": {
    "kick": [true,false,true,false,...],
    "snare": [false,false,true,false,...],
    "hihat": [true,true,true,true,...]
  },
  "chords": [
    {
      "notes": ["C4", "E4", "G4"],
      "start": 0.0,
      "duration": 2.0,
      "source": "class definition"
    }
  ],
  "metadata": {
    "bpm": 120,
    "key": "C Major",
    "mood": "energetic",
    "complexity": ${complexity},
    "totalDuration": 10.0
  },
  "title": "Descriptive title based on code",
  "description": "Explanation of musical choices"
}

EXAMPLE (for reference):
{
  "melody": [
    {"note": "C4", "start": 0, "duration": 1.0, "frequency": 261.63, "instrument": "piano", "velocity": 80, "source": "class User"}
  ],
  "drumPattern": {
    "kick": [true,false,true,false,true,false,true,false],
    "snare": [false,false,true,false,false,false,true,false]
  },
  "metadata": {"bpm": 120, "key": "C Major", "mood": "neutral", "complexity": 5}
}

CRITICAL: Return ONLY valid JSON. No markdown, no explanations outside the JSON.`;
```

---

## ✅ Summary

**Without Instructions:**
- AI makes up random rules ❌
- Inconsistent results ❌
- Often fails ❌
- Unusable output ❌

**With Basic Instructions:**
- AI follows simple rules ✓
- Somewhat consistent ✓
- Usually works ✓
- Basic output ✓

**With Enhanced Instructions:**
- AI follows detailed rules ✅
- Highly consistent ✅
- Always works ✅
- Professional output ✅

**You are 100% correct - without instructions, the AI would either fail or make up its own (probably bad) conversion rules!**
