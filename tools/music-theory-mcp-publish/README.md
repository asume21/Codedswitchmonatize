# Music Theory MCP 🎵

**Give your AI coding assistant musical knowledge.**

Scales, chords, progressions, key detection, genre-aware composition intelligence, and rhythm patterns.

**4 free tools** work instantly. **9 pro tools** unlock with a free `CODEDSWITCH_API_KEY` (50 calls/day). Unlimited plans at [codedswitch.com/pricing](https://www.codedswitch.com/pricing).

Works with **Claude Code**, **Cursor**, **Windsurf**, and any MCP-compatible IDE.

> **Companion to [WebEar](https://github.com/asume21/webear)** — WebEar gives your AI ears, Music Theory MCP gives it a brain for music.

---

## 13 Tools

### Free (no key needed)

| Tool | Description |
|------|-------------|
| `get_scale` | Notes & intervals for 20+ scale types (major, minor, pentatonic, blues, dorian, etc.) |
| `get_chord` | Notes for 22+ chord types (triads, 7ths, 9ths, sus, aug, dim, etc.) |
| `transpose_note` | Shift a note by semitones |
| `get_interval` | Interval between two notes |

### Pro (requires `CODEDSWITCH_API_KEY`)

| Tool | Description |
|------|-------------|
| `identify_chord` | Name a chord from its notes |
| `detect_key` | Detect the key from observed notes with confidence scores |
| `resolve_progression` | Roman numerals → actual chords in any key |
| `suggest_next_chord` | "What chord comes next?" with voice leading intelligence |
| `get_diatonic_chords` | All 7 chords in any key |
| `get_genre_profile` | Full genre intel: progressions, instruments, BPM, mood, swing |
| `suggest_genre` | Match genre from BPM / key / mood / scale |
| `get_genre_rhythms` | Drum patterns (kick/snare/hat step arrays) per genre |
| `transpose_progression` | Shift an entire chord progression |

> Get a free key at [codedswitch.com/developer](https://www.codedswitch.com/developer) — 50 pro calls/day included.

## 11 Genres

Trap · Boom Bap · Drill · Lo-Fi Hip Hop · R&B · Pop · Afrobeats · Reggaeton · Jazz · EDM · Gospel

Each genre includes: chord progressions, recommended scales, BPM range, instruments, rhythmic feel, swing amount, common keys, and mood descriptors.

---

## Quick Start

### Option 1: npx (no install)

```bash
npx music-theory-mcp
```

### Option 2: Global install

```bash
npm install -g music-theory-mcp
```

---

## IDE Configuration

### Claude Code

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "music-theory": {
      "command": "npx",
      "args": ["music-theory-mcp"],
      "env": { "CODEDSWITCH_API_KEY": "csk_your_key_here" }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "music-theory": {
      "command": "npx",
      "args": ["music-theory-mcp"],
      "env": { "CODEDSWITCH_API_KEY": "csk_your_key_here" }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "music-theory": {
      "command": "npx",
      "args": ["music-theory-mcp"],
      "env": { "CODEDSWITCH_API_KEY": "csk_your_key_here" }
    }
  }
}
```

> Omit the `env` block to use free tools only.

---

## Example Usage

Once configured, your AI assistant can use the tools naturally:

**"What chords are in the key of F minor?"**
```
→ get_diatonic_chords({ key: "F", mode: "minor" })
→ Fm, Gdim, Ab, Bbm, Cm, Db, Eb
```

**"Give me a trap beat in C minor"**
```
→ get_genre_profile({ genre: "trap" })
→ Progressions: i-iv-VI-v, scales: minor/phrygian, BPM: 130-170
→ get_genre_rhythms({ genre: "trap" })
→ Kick/snare/hat patterns ready for a sequencer
```

**"What key is this melody in? C, D, E, F#, G, A, B"**
```
→ detect_key({ notes: ["C", "D", "E", "F#", "G", "A", "B"] })
→ G major (100% confidence)
```

**"I'm on a V chord in Bb major, what should come next?"**
```
→ suggest_next_chord({ current_numeral: "V", key: "Bb", mode: "major" })
→ I (Bb), vi (Gm), IV (Eb) — ranked by voice leading tendency
```

---

## Use Cases

- **AI music apps** — give your AI composer harmonic intelligence
- **Beat makers & DAWs** — auto-suggest progressions, detect keys, genre-match rhythms
- **Music education** — interactive scale/chord/theory lookup
- **Songwriting tools** — intelligent chord suggestions and key detection
- **MIDI processors** — transpose, identify, and analyze musical content
- **Any AI agent** — add musical reasoning to any MCP-compatible agent

---

## Pairs With WebEar

| | WebEar | Music Theory MCP |
|---|--------|-----------------|
| **What** | Captures & analyzes live audio | Reasons about music theory |
| **Analogy** | Ears | Brain |
| **API keys** | Required (CodedSwitch) | Free tier: none / Pro: CodedSwitch key |
| **Together** | Hear what's playing → analyze if it's harmonically correct → suggest fixes |

---

## Built by [CodedSwitch](https://www.codedswitch.com)

Part of the CodedSwitch Studio ecosystem — AI-powered music creation.

## License

MIT
