# AI Perception Platform

> "Your AI can think. Now let it hear, see, and feel."

AI models are brains in a jar — high cognitive intelligence, zero real-time senses. The **AI Perception Platform** is an infrastructure layer that gives any AI model direct sensory access to a live browser session via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

Instead of describing what's on screen or in the mix to an AI, you let it listen, watch, and monitor for itself.

---

## Sensors

| Sensor | What it perceives | Status |
|---|---|---|
| **WebEar** | Audio — mix quality, rhythm, instruments, clipping | ✅ Shipped |
| **WebEye** | Visual — canvas, UI layout, animations, screenshots | ✅ Shipped |
| **WebSense** | Performance — frame rate, memory, audio latency | ✅ Shipped |
| **WebNerve** | Network — API latencies, connection quality, storage | ✅ Shipped |
| **WebShield** | Security — cookies, storage exposure, CSP, framing | ✅ Shipped |
| **WebLog** | Console — logs, warnings, errors, uncaught exceptions | ✅ Shipped |

---

## Architecture

Every sensor follows the same three-component pattern:

```
Browser Bridge ──SSE──▶ Relay Server ◀──MCP──▶ AI Model (Claude)
                ◀── capture command ──
                ──── blob POST ──────▶
                                      ──── analysis ──▶ AI response
```

1. **Browser Bridge** (`client/src/lib/{sensor}Bridge.ts`) — a script running inside the user's browser tab. It connects to the relay server over SSE, listens for capture commands, records media/data, and POSTs the result back as a blob.

2. **Relay Server** (`server/routes/webearRelay.ts`) — Express routes that:
   - Keep persistent SSE connections from active browser tabs (`/api/webeye/connect`, `/api/webear/connect`, etc.)
   - Store captured blobs in memory with TTL eviction
   - Expose all tools as a single MCP SSE endpoint at `/api/webear/mcp/sse`

3. **MCP Client** (Claude Code, Cursor, etc.) — connects to the MCP endpoint and calls tools like `capture_audio`, `describe_video`, `analyze_telemetry` etc.

---

## Activating Bridges (Opt-In)

Bridges are **off by default** for all users. Activate any sensor by adding URL params to the app:

```
https://yourapp.com/studio?webeye=1&webear=1&websense=1&webnerve=1&webshield=1&weblog=1
```

Each param independently boots its bridge:

| URL Param | Bridge File | Sensor Activated |
|---|---|---|
| `?webeye=1` | `webeyeBridge.ts` | WebEye (visual) |
| `?websense=1` | `websenseBridge.ts` | WebSense (telemetry) |
| `?webnerve=1` | `webnerveBridge.ts` | WebNerve (network) |
| `?webshield=1` | `webshieldBridge.ts` | WebShield (security) |
| `?weblog=1` | `weblogBridge.ts` | WebLog (console) |
| *(WebEar is always on for logged-in users)* | `webearBridge.ts` | WebEar (audio) |

---

## Connecting as an MCP Server

Add to your `claude_desktop_config.json` or Claude Code MCP settings:

```json
{
  "mcpServers": {
    "webear": {
      "url": "https://yourapp.com/api/webear/mcp/sse",
      "headers": {
        "Authorization": "Bearer wbr_YOUR_API_KEY"
      }
    }
  }
}
```

API keys are issued per-user and visible in Settings → WebEar. Keys start with `wbr_`.

---

## Tool Reference

### WebEar — Audio Tools

| Tool | Credits | Description |
|---|---|---|
| `capture_audio` | Free | Record live tab audio. Returns a `capture_id`. |
| `analyze_audio` | 1 | BPM, loudness (RMS/peak), frequency bands, clipping %, dynamic range, spectral centroid. |
| `describe_audio` | 2 | AI plain-English description — instruments, genre, mood, mixing notes (powered by Gemini multimodal). |
| `diff_audio` | 1 | Compare two captures. Reports deltas in loudness, peak, clipping, spectral balance, and groove tightness. |
| `groove_score` | 2 | Kick transient detection → grid alignment → deviation, swing factor, consistency score (0–100%). Pass `bpm` param for accuracy. |
| `capture_and_analyze` | 1 | Capture + signal analysis in one call. |
| `mix_coach` | 3 | Longer capture + structured mixing feedback: loudness, dynamic punch, low-end mud, clipping, DC offset. |

**Capture parameters:** `duration_ms` (500–30000, default 3000)

**Typical workflow:**
```
capture_audio → [analyze_audio | describe_audio | groove_score | diff_audio]
```

---

### WebEye — Visual Tools

| Tool | Credits | Description |
|---|---|---|
| `capture_video` | Free | Record canvas/video stream from the browser tab. Returns a `capture_id`. Optional: `selector` for a specific DOM element. |
| `describe_video` | 2 | AI visual description — layout, animations, contrast, color, visual bugs (powered by Gemini Vision). |
| `diff_visuals` | 2 | Compare two visual captures. Reports layout changes, element movements, design shifts. |

**Requires:** `?webeye=1` URL param (or WebEye bridge manually imported)

**Typical workflow:**
```
capture_video → describe_video
capture_video (before) → [change something] → capture_video (after) → diff_visuals
```

---

### WebSense — Performance Telemetry Tools

| Tool | Credits | Description |
|---|---|---|
| `capture_telemetry` | Free | Record frame rate, JS heap memory, layout shifts, and audio latency over a time window. |
| `analyze_telemetry` | 1 | Report on frame drops, memory pressure, layout instability, audio underruns. |

**Requires:** `?websense=1` URL param

---

### WebNerve — Network Tools

| Tool | Credits | Description |
|---|---|---|
| `capture_nerve` | Free | Record API request timings, connection quality indicators, and local/session storage size. |
| `analyze_nerve` | 1 | Report slow API calls, connection quality, storage bloat. |
| `diff_nerve` | 1 | Compare two nerve captures to track latency regressions or improvements. |

**Requires:** `?webnerve=1` URL param

---

### WebShield — Security Tools

| Tool | Credits | Description |
|---|---|---|
| `capture_shield` | Free | Snapshot cookie scopes, storage key exposure, CSP policies, and iframe framing status. |
| `analyze_shield` | 1 | Flag CORS wildcarding, non-HttpOnly cookies, sensitive key names in storage, missing CSP. |
| `diff_shield` | 1 | Compare two security snapshots to verify patch effectiveness or detect regressions. |

**Requires:** `?webshield=1` URL param

---

### WebLog — Console Tools

| Tool | Credits | Description |
|---|---|---|
| `capture_logs` | Free | Record `console.log/warn/error`, uncaught exceptions, and unhandled rejections over a time window. |
| `analyze_logs` | 1 | Surface error patterns, repeated warnings, exception stack traces, and active app state at capture time. |
| `diff_logs` | 1 | Compare two log captures to identify new errors introduced by a code change. |

**Requires:** `?weblog=1` URL param

---

## Credit Pricing Summary

| Cost | Tools |
|---|---|
| **Free** | `capture_audio`, `capture_video`, `capture_telemetry`, `capture_nerve`, `capture_shield`, `capture_logs` |
| **1 credit** | `analyze_audio`, `diff_audio`, `capture_and_analyze`, `analyze_telemetry`, `analyze_nerve`, `diff_nerve`, `analyze_shield`, `diff_shield`, `analyze_logs`, `diff_logs` |
| **2 credits** | `describe_audio`, `groove_score`, `describe_video`, `diff_visuals` |
| **3 credits** | `mix_coach` |

---

## Vision: Complete AI Sensory Stack

The goal is a complete sensory stack for AI agents operating in browser environments:

```
WebEar   — hears what users hear
WebEye   — sees what users see
WebSense — feels performance pressure users feel
WebNerve — measures latency users experience
WebShield— audits the security surface users are exposed to
WebLog   — reads the error stream developers debug with
```

Combined, an AI model can understand a live app session the way a human expert sitting beside the user would — without the user having to describe anything.

---

## File Map

```
server/routes/webearRelay.ts      ← All MCP tools + SSE relay + blob store (single file)
client/src/lib/webeyeBridge.ts    ← WebEye browser bridge
client/src/lib/websenseBridge.ts  ← WebSense browser bridge
client/src/lib/webnerveBridge.ts  ← WebNerve browser bridge
client/src/lib/webshieldBridge.ts ← WebShield browser bridge
client/src/lib/weblogBridge.ts    ← WebLog browser bridge
client/src/main.tsx               ← URL-param opt-in loader (all bridges)
server/services/videoDescribe.ts  ← Gemini Vision wrapper for describe_video
docs/ai-perception.md             ← This file
```

---

## Roadmap

- [ ] Persistent blob storage (currently in-memory, lost on Railway redeploy)
- [ ] WebEar MCP registry listing on mcp.so
- [ ] AI Perception landing page for external developers
- [ ] WebEye: `ui_critique` tool — accessibility, contrast, spacing analysis
- [ ] WebSense: streaming telemetry (real-time feed vs. capture-then-analyze)
- [ ] Multi-sensor correlation: audio clipping + CPU spike + API timeout = one diagnosis
