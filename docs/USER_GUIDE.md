# CodedSwitch User Guide

**Complete guide to using CodedSwitch's AI-powered music production platform**

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Song Upload & Library](#song-upload--library)
3. [AI Stem Separation](#ai-stem-separation)
4. [Astutely Mix Intelligence](#astutely-mix-intelligence)
5. [Audio Tools](#audio-tools)
6. [AI Studio Tools](#ai-studio-tools)
7. [Code to Music](#code-to-music)
8. [Lyric Lab](#lyric-lab)
9. [Complete Workflows](#complete-workflows)
10. [Security & Rate Limits](#security--rate-limits)

---

## 🚀 Getting Started

### Navigation
CodedSwitch has multiple tabs in the main studio:
- **Upload** - Upload and manage your song library
- **AI Studio** - AI-powered tools (Mastering, Arrangement, Vocal Melody, Stem Separation)
- **Audio Tools** - Professional audio processing (EQ, Compressor, Reverb, etc.)
- **Mixer** - Professional mixing console with Astutely AI
- **Lyric Lab** - Write, generate, and analyze lyrics
- **Code to Music** - Convert code into musical compositions
- **Piano Roll** - MIDI editing and melody creation
- **Multi-Track** - Multi-track recording and arrangement

---

## 📁 Song Upload & Library

### Uploading Songs

1. Navigate to the **Upload** tab
2. Click **"Choose File"** or drag & drop audio files
3. Supported formats: MP3, WAV, M4A, OGG, FLAC
4. Your song is automatically added to your library

### Song Library Features

Each song in your library has these actions:

**🎵 Play** - Listen to the song  
**🧠 Analyze** - AI analyzes the song structure, tempo, key  
**📝 Transcribe** - Convert vocals to text using AI  
**✨ Transcribe + Analyze** - Both transcription and lyric analysis  
**📊 Analyze Lyrics** - Detailed lyric quality analysis  
**🎚️ Add to Tracks** - Load into Multi-Track Studio  
**✂️ Separate Stems** - Route to AI Stem Separator  
**⬇️ Download** - Download the song file  
**🗑️ Delete** - Remove from library

### Privacy & Security
- ✅ Your songs are **private** - only you can see them
- ✅ Songs are tied to your user account
- ✅ Not visible to other users or public
- ✅ Stored securely in the database

---

## ✂️ AI Stem Separation

### What It Does
Separates a complete song into individual instrument/vocal tracks using AI.

### How to Use

**Method 1: From Song Library (Recommended)**
1. Go to **Upload** tab
2. Find your song in the library
3. Click **"Separate Stems"** button
4. Song automatically loads in Stem Separator
5. Choose stem count (2, 4, or 5 stems)
6. Click **"Separate Stems"**
7. Wait 1-3 minutes for AI processing

**Stem Options:**
- **2 Stems:** Vocals + Accompaniment (everything else)
- **4 Stems:** Vocals + Drums + Bass + Other
- **5 Stems:** Vocals + Drums + Bass + Piano + Other

### After Separation

Each stem has:
- **🔊 Play** - Listen to isolated stem
- **⬇️ Download** - Save stem as .wav file
- **🪄 Send to Astutely** - Route all stems for AI remixing

### Limitations
- Cannot separate individual instruments within "Other" category
- Cannot separate lead vocals from backing vocals
- Cannot separate individual drum sounds (kick, snare stay together)

---

## 🎛️ Astutely Mix Intelligence

### What It Does
AI-powered remixing and music generation based on text descriptions.

### Two Modes

**Mode 1: Generate from Scratch**
1. Go to **Mixer** tab → **AI Mixing** tab
2. Describe what you want: *"Create a dark trap beat with heavy 808s"*
3. Click **"Generate Master Mix"**
4. AI creates drums, bass, chords, and melody

**Mode 2: Remix Existing Stems**
1. Separate your song into stems (see above)
2. Click **"Send to Astutely for AI Remix"**
3. Stems automatically load in Astutely
4. Describe the remix: *"Add heavy reverb to vocals, make drums punchier"*
5. Click **"Remix Stems"**
6. AI processes and remixes your stems

### What AI Generates
- ✅ Drum patterns (kick, snare, hi-hats)
- ✅ Bass lines
- ✅ Chord progressions
- ✅ Melodic lines
- ✅ Complete arrangements

---

## 🎚️ Audio Tools

### Available Tools

**EQ (Equalizer)** - Shape frequency balance  
**Compressor** - Control dynamics  
**Deesser** - Remove harsh S sounds  
**Reverb** - Add space and depth  
**Limiter** - Prevent clipping  
**Noise Gate** - Remove background noise  
**Delay / Echo** - Add echo effects  
**Chorus / Flanger** - Add width and modulation  
**Saturation / Distortion** - Add warmth and grit

### How to Use

1. Go to **Audio Tools** tab
2. Click any tool card
3. Upload audio file (or use currently loaded song)
4. Adjust parameters with sliders
5. Click **"Export"** to save processed audio

### Workflow Integration
- Tools can be chained together
- Process the same file through multiple tools
- Export at any stage

---

## 🎤 AI Studio Tools

### 1. AI Mastering Assistant

**What it does:** Professional mastering for streaming platforms

**How to use:**
1. Select **Genre** (Pop, Hip-Hop, Rock, etc.)
2. Set **Target LUFS** (typically -14 for streaming)
3. Click **"Analyze Mix"**
4. AI applies EQ, compression, and limiting
5. Download mastered track

### 2. AI Arrangement Builder

**What it does:** Creates complete song structures

**How to use:**
1. Set **BPM** (tempo)
2. Choose **Key** (C, G, Am, etc.)
3. Select **Genre** and **Mood**
4. Set **Duration** (e.g., 3 minutes)
5. Click **"Generate Arrangement"**
6. AI creates: Intro → Verse → Chorus → Bridge → Outro

**Output:** Complete arrangement with chords, melody, bass, drums

### 3. AI Vocal Melody

**What it does:** Generates singable melodies for your lyrics

**How to use:**
1. Enter **Lyrics** (or use placeholder)
2. Set **Key** and **BPM**
3. Choose **Mood** (Uplifting, Melancholic, etc.)
4. Select **Vocal Range** (Tenor, Soprano, etc.)
5. Click **"Generate Vocal Melody"**

**Output:** MIDI melody (musical notes, not sung vocals)

**What to do with it:**
- Sing along yourself
- Use with vocal synthesizer
- Send to a vocalist as a guide track

---

## 💻 Code to Music

### What It Does
Converts programming code into musical compositions.

### How to Use

1. Go to **Code to Music** tab
2. Paste your code (any language)
3. Select **Language** (JavaScript, Python, etc.)
4. Choose **Genre** (Pop, Electronic, etc.)
5. Adjust **Variation** slider (0-10)
6. **Toggle AI-Enhanced** (ON for better results)
7. Click **"Generate Music"**

### AI-Enhanced Mode

**OFF:** Basic algorithm converts code structure to simple chords  
**ON:** AI (Grok/OpenAI) creates sophisticated chord progressions and melodies

**When to use AI-Enhanced:**
- ✅ When you want professional-quality output
- ✅ For more musical and complex arrangements
- ✅ When you need better melody lines

### Output
- Chord progression based on code structure
- Melody derived from code patterns
- Playable MIDI that can be exported

---

## ✍️ Lyric Lab

### Features

**Generate Lyrics** - AI writes lyrics based on theme/genre/mood  
**Analyze Lyrics** - Comprehensive quality analysis  
**Version Control** - Save multiple versions (snapshots)  
**Song Structure** - Organize by Intro, Verse, Chorus, Bridge, Outro

### How to Generate Lyrics

1. Open **Lyric Lab**
2. Click **"Generate Lyrics"**
3. Set parameters:
   - Theme (love, struggle, celebration, etc.)
   - Genre (Hip-Hop, Pop, Rock, etc.)
   - Mood (Uplifting, Dark, Energetic, etc.)
   - Complexity (Simple, Moderate, Complex)
4. Click **"Generate"**
5. AI creates complete lyrics

### Lyric Analysis

Click **"Analyze Lyrics"** to get:
- **Quality Score** (0-100)
- **Rhyme Scheme** detection (AABB, ABAB, etc.)
- **Syllable Analysis** and flow consistency
- **Theme Detection** (11 different themes)
- **Sentiment Analysis**
- **Vocabulary Complexity** scoring
- **Poetic Devices** (alliteration, metaphor, etc.)
- **Strengths & Weaknesses**
- **Commercial Viability** rating
- **AI Recommendations** for improvement

### Version Control

**Create Snapshot:**
1. Click the 📸 snapshot button
2. Version is saved automatically
3. Switch between versions using dropdown

**Why use versions:**
- Save different lyric variations
- Compare before/after edits
- Keep backup of original

---

## 🔄 Complete Workflows

### Workflow 1: Song Remix

```
1. Upload Song (Upload tab)
   ↓
2. Click "Separate Stems" on song
   ↓
3. AI separates into vocals, drums, bass, etc.
   ↓
4. Click "Send to Astutely for AI Remix"
   ↓
5. Describe remix style
   ↓
6. AI remixes your stems
   ↓
7. Export final mix
```

### Workflow 2: From Scratch Production

```
1. Generate Lyrics (Lyric Lab)
   ↓
2. Analyze & refine lyrics
   ↓
3. Generate Vocal Melody (AI Studio)
   ↓
4. Generate Arrangement (AI Studio)
   ↓
5. Mix in Astutely
   ↓
6. Master with AI Mastering Assistant
   ↓
7. Export final track
```

### Workflow 3: Audio Enhancement

```
1. Upload Song (Upload tab)
   ↓
2. Click "Analyze" for AI recommendations
   ↓
3. Click specific Audio Tool (EQ, Compressor, etc.)
   ↓
4. Process audio
   ↓
5. Chain multiple tools
   ↓
6. Export enhanced version
```

### Workflow 4: Code to Music

```
1. Write or paste code (Code to Music tab)
   ↓
2. Enable AI-Enhanced toggle
   ↓
3. Generate music
   ↓
4. Export MIDI or audio
   ↓
5. Import to Multi-Track Studio
   ↓
6. Add more layers
   ↓
7. Mix and master
```

---

## 🔒 Security & Rate Limits

### Why Rate Limits Exist
AI generation is expensive. Rate limits prevent abuse and control costs.

### Rate Limits by Tier

**Free Tier:**
- 5 AI generations per hour (Suno, MusicGen)
- 10 lyrics generations per hour
- 20 beat generations per hour
- 20 uploads per hour

**Pro Tier:**
- 30 AI generations per hour
- 50 lyrics generations per hour
- 100 beat generations per hour
- 100 uploads per hour

**Premium Tier:**
- 100 AI generations per hour
- 200 lyrics generations per hour
- 500 beat generations per hour
- 1000 uploads per hour

### Global Rate Limit
- 100 requests per 15 minutes across all API endpoints

### Input Validation
- Max prompt length: 10,000 characters
- Max file size: 100MB (varies by feature)
- XSS prevention (blocks malicious scripts)

### Tier Enforcement
Some features require Pro or Premium tier:
- ✅ Professional song generation (Suno) - **Pro required**
- ✅ All other features available on Free tier

---

## 💡 Tips & Best Practices

### General Tips
1. **Upload songs first** - Use Upload tab as your central hub
2. **Use routing buttons** - Avoid re-uploading the same file
3. **Save versions** - Use snapshots in Lyric Lab
4. **Chain tools** - Process audio through multiple Audio Tools
5. **Enable AI-Enhanced** - Better results in Code to Music

### Performance Tips
1. **Stem Separation** takes 1-3 minutes - be patient
2. **AI Generation** can take 30-60 seconds
3. **Large files** (>50MB) may take longer to upload
4. **Close unused tabs** for better performance

### Quality Tips
1. **Use high-quality source files** (WAV > MP3)
2. **Analyze before processing** - Let AI recommend tools
3. **Master last** - Always master after mixing
4. **Test different variations** - Try multiple AI generations

---

## 🆘 Troubleshooting

### "Rate limit exceeded"
**Solution:** Wait for the time window to reset (shown in error message)

### "No audio URL available"
**Solution:** Upload the song first in Upload tab

### "Stem separation failed"
**Solution:** 
- Check file format (MP3, WAV supported)
- Try smaller file (<100MB)
- Check internet connection

### "AI generation failed"
**Solution:**
- Check if API keys are configured (admin only)
- Try again (temporary API issue)
- Simplify your prompt

### Song not loading in tool
**Solution:**
- Use routing buttons instead of manual upload
- Check if song exists in library
- Refresh the page

---

## 📞 Support

For issues not covered in this guide:
1. Check the console (F12) for error messages
2. Try refreshing the page
3. Clear browser cache
4. Contact support with error details

---

## 🎯 Quick Reference

| Feature | Location | Purpose |
|---------|----------|---------|
| Upload Songs | Upload tab | Add songs to library |
| Stem Separation | AI Studio tab | Split song into parts |
| AI Remix | Mixer → AI Mixing | Remix stems with AI |
| Audio Tools | Audio Tools tab | EQ, Compress, etc. |
| Lyric Writing | Lyric Lab | Generate & analyze lyrics |
| Code to Music | Code to Music tab | Convert code to music |
| Mastering | AI Studio | Professional mastering |
| Arrangement | AI Studio | Generate song structure |
| Vocal Melody | AI Studio | Create singable melodies |

---

**Version:** 1.0  
**Last Updated:** January 2026  
**Platform:** CodedSwitch Music Production Suite
