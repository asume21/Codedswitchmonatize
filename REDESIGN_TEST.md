# V2 Redesign Testing Guide

## Current Status
- Branch: `redesign-v2`
- Feature Flag: `VITE_USE_NEW_HERO=true`
- Server should be running on http://localhost:5173

## What Should Happen

### New Hero V2 (When Flag is ON)
You should see:
- **Animated particle field** with purple/cyan/orange dots
- **"Create Music with AI" title** with cyan gradient
- **Sparkle icon badge** that says "AI-Powered Music Production"
- **Two large buttons**: "Start Creating Free" and "Watch Demo"
- **5 circular avatars** at bottom
- **Dark background** (#0A0F1B - very dark blue/black)

### Old Hero V1 (When Flag is OFF)
You should see:
- Purple/blue square icon with music note
- "CodedSwitch" title
- Standard text and buttons
- Lighter background

## Troubleshooting

### If you see OLD hero when flag is ON:

1. **Check .env.local file exists**
   ```bash
   # Should exist: d:\Codedswitchmonatize\.env.local
   # Should contain: VITE_USE_NEW_HERO=true
   ```

2. **Restart dev server**
   ```bash
   # Kill all node processes
   taskkill /F /IM node.exe
   
   # Start fresh
   npm run dev
   ```

3. **Hard refresh browser**
   ```
   Ctrl + Shift + R (or Ctrl + F5)
   ```

4. **Check browser console (F12)**
   ```
   Should see: 🎨 Feature Flags: { useNewHero: true, ... }
   ```

5. **Check for errors**
   - Red errors in browser console?
   - Import errors?
   - CSS not loading?

### If nothing works:
The feature flag system might not be reading .env.local. 
We can test by REMOVING the flag check and always showing V2.

## Quick Test
Visit: http://localhost:5173/
Expected: Animated particles background with new hero
