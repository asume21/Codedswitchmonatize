# Contributing to webear

Thanks for your interest in contributing! This is a focused tool — please keep PRs small and scoped.

## Project Structure

```
src/
  index.ts           — MCP server entry point (registers all tools)
  client.ts          — HTTP client that talks to the Express middleware
  middleware.ts      — Express router (SSE + capture store)
  tools/
    captureAudio.ts  — capture_audio tool
    analyzeAudio.ts  — analyze_audio tool
    describeAudio.ts — describe_audio tool
    diffAudio.ts     — diff_audio tool
  analysis/
    pcmAnalyzer.ts   — signal analysis (RMS, spectral, BPM, etc.)
client-snippet.js    — Browser-side bridge (taps AudioContext → HTTP upload)
```

## Dev Setup

```bash
git clone https://github.com/asume21/webear
cd webear
npm install
npm run build      # compiles TypeScript → dist/
```

To run the MCP server in dev mode (without building):
```bash
npm run dev
```

## Testing Your Changes

### 1. Build and verify dist
```bash
npm run build
node dist/index.js < /dev/null   # should start and exit cleanly
```

### 2. Integration test against a real dev server

Start any Express app with the middleware mounted:
```bash
node -e "
  const express = require('express');
  const { webearMiddleware } = require('./dist/middleware.js');
  const app = express();
  app.use(express.json());
  app.use('/api/webear', webearMiddleware({ devOnly: false }));
  app.listen(4000, () => console.log('running on :4000'));
"
```

Then check health:
```bash
curl http://localhost:4000/api/webear/health
```

### 3. End-to-end with Claude Code

Add to your `.mcp.json`:
```json
{
  "mcpServers": {
    "webear": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "WEBEAR_BASE_URL": "http://localhost:4000" }
    }
  }
}
```

Then use Claude Code to call the tools and verify output.

## Submitting a PR

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your changes — keep diffs small and focused
3. Build and test: `npm run build`
4. Commit with a clear message: `fix: handle empty captures in analyzeAudio`
5. Open a PR against `main`

### PR Guidelines

- One thing per PR
- Update the README if you change behavior or add options
- Don't bump the version — maintainer handles releases
- For new tools: follow the existing pattern in `src/tools/`

## Reporting Bugs

Open a GitHub issue with:
- Node.js version
- IDE + MCP client version
- Exact error message / unexpected output
- Minimal steps to reproduce

## Ideas / Feature Requests

Open a GitHub Discussion before starting work on a large feature. Small improvements (better error messages, new analysis metrics, new client init options) are welcome as direct PRs.
