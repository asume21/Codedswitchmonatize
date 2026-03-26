# Launch Checklist

Everything Claude prepared is done. Here's what **you** need to do manually, in order.

---

## Step 1 — Create the GitHub repo

1. Go to https://github.com/new
2. Name it `webear` (matches package.json `repository.url`)
3. Set to **Public**, MIT license already included — skip GitHub's license option
4. Don't initialize with README (we have one)

Then from this folder:
```bash
cd tools/webear-publish
git init
git add .
git commit -m "feat: initial release of webear v1.0.0"
git remote add origin https://github.com/asume21/webear.git
git push -u origin main
```

> **Important:** the `.gitignore` already excludes `node_modules/` and `dist/`.
> The `.npmignore` keeps `src/` and `tsconfig.json` out of the npm package but
> includes `dist/`. Both are correct — don't change them.

---

## Step 2 — Record the demo GIF

This single GIF will do more for adoption than everything else combined.

**What to record (15–20 seconds):**
1. Your browser open with a music app playing audio (CodedSwitch works perfectly)
2. Split-screen or switch to Claude Code / Cursor
3. Type: *"Capture 3 seconds of audio and tell me why the bass sounds muddy"*
4. Show the AI calling `capture_audio` then `analyze_audio`
5. Show the analysis output with frequency bands and the AI's interpretation

**Tools for recording:**
- Windows: Xbox Game Bar (`Win + G`) → screen clip, then convert to GIF with ScreenToGif (free)
- Or use LICEcap (free, records directly to GIF)
- Aim for < 5 MB so GitHub renders it inline

**Once recorded:**
- Save as `demo.gif` in the repo root
- Remove the `<!-- DEMO GIF -->` comment block in README.md and replace with:
  ```markdown
  ![Demo: AI capturing and analyzing Web Audio output](./demo.gif)
  ```

---

## Step 3 — Publish to npm

```bash
cd tools/webear-publish
npm login          # if not already logged in
npm run build      # compiles TypeScript → dist/
npm publish --access public
```

Verify it's live:
```bash
npm view webear
```

---

## Step 4 — Submit to Smithery.ai

1. Go to https://smithery.ai
2. Click "Submit a server"
3. Enter your npm package name: `webear`
4. Smithery reads `smithery.yaml` automatically — everything is already set up

---

## Step 5 — Submit to awesome-mcp-servers

1. Go to https://github.com/punkpeye/awesome-mcp-servers
2. Fork the repo
3. Add the line from `posts/awesome-mcp-servers-pr.md` to the relevant section
4. Open a PR using the title and description from that file

This list has very high traffic — getting listed here drives consistent inbound.

---

## Step 6 — Post to communities

All posts are ready in `posts/`. Copy-paste in this order (space them out by a day or two):

| Day | Post | File |
|-----|------|------|
| Day 1 | Hacker News Show HN | `posts/hackernews.md` |
| Day 1 | MCP Discord #show-and-tell | `posts/mcp-discord.md` |
| Day 2 | Twitter/X thread | `posts/twitter-thread.md` |
| Day 3 | r/webdev | `posts/reddit-webdev.md` |
| Day 4 | r/WeAreTheMusicMakers | `posts/reddit-music-makers.md` |
| Day 4 | r/edmproduction | same as music makers post |

> **Tip for HN:** Post on a weekday between 8–10am Eastern for best visibility.
> "Show HN" posts do best Tuesday–Thursday.

---

## Step 7 — Set up the CodedSwitch API endpoints

The MCP tools route analysis through `https://www.codedswitch.com/api/mcp/analyze`
and `/api/mcp/describe`. Make sure these are live and accepting `CODEDSWITCH_API_KEY`
auth before you publish and people start trying it.

Check the untracked files in your repo:
- `server/routes/mcpApi.ts`
- `server/services/mcpAudioAnalysis.ts`

These need to be committed and deployed.

---

## Optional: npm provenance + 2FA

For extra trust signals:
```bash
npm publish --access public --provenance
```

This links the npm package to the GitHub repo via SLSA provenance — shows up as
a green checkmark on npmjs.com.

---

## What Claude already did

- ✅ Updated README (correct env vars, badges, free tier info, npx support)
- ✅ Created `smithery.yaml` (Smithery registry manifest)
- ✅ Created `.github/workflows/ci.yml` (GitHub Actions: build + smoke test on Node 18/20/22)
- ✅ Created `CONTRIBUTING.md`
- ✅ All community posts written and ready in `posts/`
