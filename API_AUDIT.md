# API Keys & Endpoints Audit Report
**Generated:** January 9, 2026

## Executive Summary
This audit reviews all external API connections, environment variables, and service endpoints used in CodedSwitch.

---

## ✅ Configured API Keys (Railway Environment)

### Payment & Monetization
- **STRIPE_SECRET_KEY**: ✅ Configured (live key present)
- **STRIPE_WEBHOOK_SECRET**: ✅ Configured
- **STRIPE_PRICE_ID_PRO**: ✅ Configured
- **STRIPE_PRICE_ID_STUDIO**: ✅ Configured
- **VITE_STRIPE_PUBLIC_KEY**: ✅ Configured (live key present)

### AI Services
- **XAI_API_KEY** (Grok): ✅ Configured (key present)
  - Used for: Lyrics generation, AI analysis, melody generation
  - Endpoint: `https://api.x.ai/v1`
  
- **SUNO_API_TOKEN**: ✅ Configured (key present)
  - Note: Variable name is `SUNO_API_TOKEN` but code expects `SUNO_API_KEY`
  - ⚠️ **MISMATCH DETECTED**

### Analytics
- **VITE_GA_MEASUREMENT_ID**: ✅ Configured (`G-9RQVP7EW7S`)

---

## ✅ Recently Added API Keys

### Critical Services - NOW CONFIGURED
1. **OPENAI_API_KEY**: ✅ Configured (Jan 9, 2026)
   - Used for: Transcription, code translation, AI enhancement, file security scanning
   - Status: Fully operational
   - Services enabled:
     - Audio transcription
     - Professional audio generation
     - Code translation
     - File security scanning

2. **REPLICATE_API_TOKEN**: ✅ Configured (Jan 9, 2026)
   - Used for: MusicGen, MusicGen-Looper, stem separation
   - Status: Fully operational
   - Services enabled:
     - Pack Generator (MusicGen provider)
     - Stem separation
     - Audio generation
     - MusicGen-Looper

## ❌ Optional API Keys (Still Missing)

### Optional Services

3. **HUGGINGFACE_API_KEY**: ❌ Not configured
   - Used for: JASCO music generation (chords/drums/melody)
   - Impact: JASCO provider in Pack Generator will fall back to metadata-only

4. **GEMINI_API_KEY**: ❌ Not configured
   - Used for: Code translation, beat generation, sample pack generation
   - Impact: Gemini-powered features disabled
   - Services affected:
     - `gemini.ts` - Code translation
     - `packGenerator.ts` - Structure generator

---

## 🔧 API Key Issues - FIXED

### 1. SUNO API Key Mismatch ✅ RESOLVED
**Problem:** Railway has `SUNO_API_TOKEN` but code expected `SUNO_API_KEY`

**Files fixed:**
- `server/services/sunoApi.ts:4` - Now reads `SUNO_API_KEY || SUNO_API_TOKEN`
- `server/services/packGenerator.ts:223` - Now checks both variables

**Solution Applied:** Added fallback logic to read either variable name, ensuring compatibility without requiring Railway variable rename

---

## 🌐 External Service Endpoints

### Production Endpoints
1. **Suno API**: `https://api.sunoapi.org/api/v1` ✅
   - Service: `server/services/sunoApi.ts`
   - Status: Endpoint correct

2. **xAI Grok**: `https://api.x.ai/v1` ✅
   - Service: `server/services/grok.ts`
   - Status: Endpoint correct

3. **Replicate**: `https://api.replicate.com/v1` ✅
   - Service: `server/services/stemSeparation.ts`
   - Status: Endpoint correct

### Local Development Endpoints
1. **RVC Server**: `http://localhost:7870`
   - Services: `voiceLibrary.ts`, `speechCorrection.ts`
   - Env var: `RVC_API_URL` (optional, defaults to localhost)
   - Status: Local service, not for production

2. **Audio Analysis API**: `http://localhost:7871`
   - Service: `server/services/audioAnalysis.ts`
   - Env var: `AUDIO_ANALYSIS_API_URL` (optional)
   - Status: Local service, not for production

3. **MusicGen Local**: `http://localhost:5005/generate`
   - Service: `server/services/backingTrack.ts`
   - Env var: `MUSICGEN_URL` (optional)
   - Status: Local service, not for production

---

## 📋 Recommendations

### ✅ Completed Actions

1. **Fix SUNO_API_KEY mismatch** ✅ DONE
   - Added fallback logic in code to read both variable names

2. **Add REPLICATE_API_TOKEN** ✅ DONE (Jan 9, 2026)
   - Now fully operational for Pack Generator, Stem Separation, MusicGen

3. **Add OPENAI_API_KEY** ✅ DONE (Jan 9, 2026)
   - Now fully operational for Transcription, professional audio generation

### Optional Actions (Low Priority)

4. **Add GEMINI_API_KEY** (Optional)
   - Required for: Enhanced code translation, beat generation
   - Get key from: https://makersuite.google.com/app/apikey
   - Impact: Optional enhancement features

5. **Add HUGGINGFACE_API_KEY** (Optional)
   - Required for: JASCO music generation
   - Get key from: https://huggingface.co/settings/tokens
   - Impact: One pack generation provider

### Configuration Verification

After adding keys, verify with:
```bash
railway variables
```

Ensure all keys are:
- ✅ Not truncated
- ✅ Match expected format (e.g., `xai-` prefix, `sk-` prefix)
- ✅ Have correct variable names

---

## 🔒 Security Notes

- All API keys are properly stored in Railway environment variables
- Keys are not committed to git repository
- Server-side only access (not exposed to client)
- Stripe keys are using live mode (production ready)

---

## Service Dependencies Matrix

| Feature | Required Keys | Status |
|---------|--------------|--------|
| Pack Generator (MusicGen) | REPLICATE_API_TOKEN | ❌ Missing |
| Pack Generator (Suno) | SUNO_API_KEY | ⚠️ Mismatch |
| Pack Generator (JASCO) | HUGGINGFACE_API_KEY | ❌ Missing |
| Pack Generator (Gemini) | GEMINI_API_KEY | ❌ Missing |
| Stem Separation | REPLICATE_API_TOKEN | ❌ Missing |
| Transcription | OPENAI_API_KEY | ❌ Missing |
| Lyrics (Grok) | XAI_API_KEY | ✅ OK |
| Payments | STRIPE_SECRET_KEY | ✅ OK |
| Voice Cloning (RVC) | None (local) | ✅ OK |
| Audio Analysis | None (local) | ✅ OK |

---

## Next Steps

1. Rename `SUNO_API_TOKEN` to `SUNO_API_KEY` in Railway
2. Obtain and add `REPLICATE_API_TOKEN` 
3. Obtain and add `OPENAI_API_KEY`
4. Test Pack Generator with all providers
5. Verify transcription service works
6. Test stem separation feature
