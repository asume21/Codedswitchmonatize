# awesome-mcp-servers — Pull Request

## PR Title
Add webear — live Web Audio API capture and analysis for AI assistants

## PR Description

Adding **webear** to the list.

### What it does

An MCP server that gives AI coding assistants the ability to capture and analyze
live audio from a running web application via the Web Audio API — not a file
on disk, not the physical microphone.

**Tools:**
- `capture_audio` — record what the app is currently outputting (500ms–30s)
- `analyze_audio` — RMS, peak dB, spectral centroid, frequency bands, BPM, timing jitter, clipping
- `describe_audio` — plain-English AI description of the capture
- `diff_audio` — compare two captures and flag audio regressions

### Links
- **npm:** https://www.npmjs.com/package/webear
- **GitHub:** https://github.com/asume21/webear

### Checklist
- [x] The server is published to npm
- [x] README documents setup and all tools
- [x] MIT license
- [x] Works with Claude Code, Cursor, Windsurf

---

## Line to add to the README

Find the **Developer Tools** or **Audio** section and add:

```
- [webear](https://github.com/asume21/webear) - Give AI assistants ears: capture and analyze live Web Audio API output from any running web app. Tools: capture_audio, analyze_audio, describe_audio, diff_audio.
```

---

## Notes for maintainers

This fills a gap in the current list — all other audio MCPs analyze static files
or use the system microphone. This one bridges the browser's Web Audio graph to
the IDE via an Express middleware + SSE + MCP server architecture.
