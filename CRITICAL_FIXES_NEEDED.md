# CodedSwitch - Critical Fixes Audit

## CORE PROBLEM: No Single Source of Truth

The app has **57 studio components** and **21 pages** but they don't talk to each other properly.

---

## DATABASE ISSUES

### Missing Tables (in Railway but NOT in schema.ts):
- [ ] `jam_sessions` - Jam feature won't work
- [ ] `jam_contributions` - Jam feature won't work  
- [ ] `jam_likes` - Jam feature won't work
- [ ] **`tracks`** - CRITICAL: No table to store arrangement tracks!

### What's Missing from Schema:
The app generates audio (beats, vocals, loops, recordings) but has NO unified place to store them for mixing.

**Current state:**
- `songs` table = uploaded files only
- `samples` table = sample packs only
- `beat_patterns` table = pattern data, no audio
- `melodies` table = note data, no audio
- **NO `tracks` table** = nowhere to store generated audio for arrangement

---

## PERSISTENCE ISSUES

### What DOESN'T persist:
1. Generated beats from AI - gone on refresh
2. Generated loops - gone on refresh
3. Recorded vocals - gone on refresh
4. Piano roll compositions - partially saves to projects, but disconnected
5. Mixer settings - gone on refresh
6. Track arrangements - gone on refresh

### What DOES persist:
1. Uploaded songs (songs table)
2. Lyrics (lyrics table)
3. User accounts (users table)
4. Projects (projects table) - but only piano roll data

---

## MIXING/ARRANGEMENT ISSUES

### The Problem:
There is NO unified workflow to:
1. Take a beat
2. Add vocals
3. Add loops
4. Arrange them on a timeline
5. Mix them together
6. Export as one file

### Current Fragmented State:
- `UnifiedStudioWorkspace.tsx` - tries to be the main view
- `MixStudio.tsx` - separate mixer
- `MixerStudio.tsx` - another mixer?
- `ProfessionalMixer.tsx` - yet another mixer
- `Mixer.tsx` - and another one
- `ExportStudio.tsx` - export functionality

**5 different mixer components, none properly connected to a tracks database**

---

## FEATURE-BY-FEATURE STATUS

### ✅ WORKING:
- User authentication
- Song upload
- Basic playback
- Lyrics generation (Grok)
- Lyrics analysis
- Credit system
- Stripe payments

### ⚠️ PARTIALLY WORKING:
- Piano Roll - saves to projects but can't export audio
- Beat generation - generates but doesn't persist
- Transcription - works but display issues

### ❌ BROKEN/INCOMPLETE:
- Mixing workflow - no unified system
- Track arrangement - no persistence
- Voice cloning - on feature branch, not main
- Jam sessions - tables missing from schema
- Loop generation - no persistence
- Recording - no persistence
- Export mixed song - can't mix multiple tracks

---

## WHAT NEEDS TO BE BUILT

### 1. Tracks Table (CRITICAL)
```sql
CREATE TABLE tracks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL, -- 'beat', 'vocal', 'loop', 'recording', 'generated', 'uploaded'
  audio_url VARCHAR NOT NULL,
  position INTEGER DEFAULT 0, -- position in arrangement (samples/ms)
  duration INTEGER, -- in ms
  volume DECIMAL DEFAULT 1.0,
  pan DECIMAL DEFAULT 0,
  muted BOOLEAN DEFAULT false,
  solo BOOLEAN DEFAULT false,
  effects JSONB, -- reverb, delay, eq settings
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Unified Save Flow
Every audio generation must:
1. Generate audio
2. Save file to storage
3. Create track record in DB
4. Return track ID to frontend
5. Frontend adds to arrangement view

### 3. One Arrangement View
- Shows all tracks for a project
- Drag to reposition
- Volume/pan controls
- Mute/solo
- Export all tracks mixed

### 4. One Export Function
- Takes all tracks for a project
- Mixes them with ffmpeg
- Returns single audio file

---

## PRIORITY ORDER

1. **Add `tracks` table to schema**
2. **Create tracks API endpoints (CRUD)**
3. **Update all audio generators to save to tracks**
4. **Build unified arrangement view**
5. **Build export mixed function**
6. **Add missing jam session tables**
7. **Test complete workflow**

---

## FILES TO MODIFY

1. `shared/schema.ts` - Add tracks table
2. `server/storage.ts` - Add tracks CRUD methods
3. `server/routes.ts` - Add tracks API endpoints
4. All generator components - Save output to tracks
5. Create new `ArrangementView.tsx` component
6. `server/routes.ts` - Add mix/export endpoint

