# awesome-mcp-servers — Pull Request

**Repo to submit to:** https://github.com/punkpeye/awesome-mcp-servers

## PR Title
Add webear — real-time browser perception suite for AI coding assistants (audio, visual, performance, network, security, console)

## PR Description

Adding **webear** to the list.

### What it does

An MCP server that gives AI coding assistants real-time perception of a running web application — not files on disk, not the physical microphone. Live signals from the browser itself via an Express middleware + SSE bridge.

**Six capture systems, 20+ tools:**

| System | Captures | What it sees |
|--------|----------|--------------|
| WebEar | Audio | RMS, peak, clipping, frequency bands, BPM, groove, mix coaching |
| WebEye | Canvas/Video | Visual layout, animations, design changes |
| WebSense | Telemetry | FPS, JS heap, layout shift, audio latency |
| WebNerve | Network | API timings, connection quality, storage |
| WebShield | Security | Cookie scope, CSP headers, storage exposure |
| WebLog | Console | Exceptions, rejections, app state snapshot |

Each system follows a `capture → analyze → diff` pattern.

### Links
- **npm:** https://www.npmjs.com/package/webear
- **GitHub:** https://github.com/asume21/webear

### Checklist
- [x] Published to npm (v1.2.4)
- [x] README documents setup and all tools
- [x] MIT license
- [x] Works with Claude Code, Cursor, Windsurf
- [x] Free tier available (50 analyses/day)

---

## Line to add to the README

Find the **Developer Tools** or **Browser** section and add:

```
- [webear](https://github.com/asume21/webear) - Real-time browser perception for AI assistants: capture and analyze live audio, visuals, performance telemetry, network activity, security attributes, and console output from any running web app. 20+ MCP tools across 6 sensor systems.
```

---

## Notes for maintainers

This fills a gap in the current list — existing audio MCPs analyze static files or use the system microphone. webear bridges the browser's live signals (Web Audio, Canvas, Performance API, Network Timing API, etc.) to the IDE via Express middleware + SSE + MCP server.
