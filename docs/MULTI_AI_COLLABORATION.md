# Multi-AI Collaboration System

This project has **two MCP servers** for enabling Cascade and Codex (or other AI agents) to collaborate in the same IDE.

## Overview

| Server | Language | Storage | Best For |
|--------|----------|---------|----------|
| **agent-bridge** | Python | File-based (`.agent-bridge/`) | Real-time messaging, task assignment, presence |
| **handoff** | TypeScript | File-based (`.handoff/`) | Detailed handoffs, history, consensus building |

Both are configured in your Windsurf MCP config at:
```
C:\Users\<you>\.codeium\windsurf\mcp_config.json
```

---

## Agent Bridge (Python)

**Storage:** `D:/Codedswitchmonatize/.agent-bridge/`

### Tools

| Tool | Description |
|------|-------------|
| `send_message` | Send a message to another AI agent |
| `get_messages` | Get messages sent to you |
| `mark_messages_read` | Mark messages as read |
| `create_task` | Create a task for another agent |
| `get_tasks` | Get tasks assigned to or created by you |
| `update_task` | Update a task status |
| `update_context` | Update shared context (branch, files, notes) |
| `get_context` | Get shared context |
| `announce_presence` | Announce you are online |

### Example Usage

**Cascade sends a message to Codex:**
```
send_message({
  from: "Cascade",
  to: "Codex",
  content: "I've finished the drum fallback patterns. Can you review?"
})
```

**Codex checks messages:**
```
get_messages({ agent: "Codex", unreadOnly: true })
```

**Create a task:**
```
create_task({
  title: "Add waveform trimming UI",
  description: "Implement trim sliders in the waveform editor dialog",
  assignedTo: "Codex",
  createdBy: "Cascade",
  priority: "high"
})
```

---

## Handoff Bridge (TypeScript)

**Storage:** `D:/Codedswitchmonatize/.handoff/messages.json`

### Tools

| Tool | Description |
|------|-------------|
| `handoff.write` | Create or update a handoff note |
| `handoff.list` | List stored notes (filter by assignee/status) |
| `handoff.clear` | Remove notes |
| `handoff.assign` | Quick-change assignee and/or status |
| `handoff.history` | Show the history log for a note |
| `handoff.attach` | Append file references/notes |
| `handoff.analyze` | Get heuristic suggestions for a task |
| `handoff.converge` | Compare proposals from multiple AIs |

### Example Usage

**Create a detailed handoff:**
```
handoff.write({
  title: "Implement audio waveform trimming",
  summary: "Add trim controls to the waveform editor dialog",
  details: "Use the existing TimelineWaveformCanvas component...",
  assignee: "Codex",
  author: "Cascade",
  files: ["client/src/components/studio/UnifiedStudioWorkspace.tsx"],
  status: "open"
})
```

**Check for tasks:**
```
handoff.list({ assignee: "Codex", status: "open" })
```

**Build consensus on a design decision:**
```
handoff.converge({
  topic: "Audio engine architecture",
  ideas: [
    { author: "Cascade", proposal: "Use Web Audio API with worklets" },
    { author: "Codex", proposal: "Use Tone.js wrapper for simplicity" }
  ]
})
```

---

## Recommended Workflow

### 1. Start of Session
Each AI announces presence:
```
announce_presence({ agent: "Cascade", status: "Starting work on AI fallbacks" })
```

### 2. Check for Pending Work
```
get_messages({ agent: "Cascade", unreadOnly: true })
get_tasks({ agent: "Cascade", filter: "assigned", status: "pending" })
handoff.list({ assignee: "Cascade", status: "open" })
```

### 3. During Work
Update context as you work:
```
update_context({
  currentBranch: "main",
  activeFiles: ["server/routes.ts"],
  recentChanges: ["Added fallback drum pattern generator"],
  notes: "Working on AI generation fallbacks"
})
```

### 4. Handoff
When switching to the other AI:
```
handoff.write({
  title: "Continue AI fallback implementation",
  summary: "Drums and melody done, bass endpoint needs fallback",
  assignee: "Codex",
  files: ["server/routes.ts"],
  status: "open"
})
```

### 5. Complete Task
```
update_task({ taskId: "...", status: "completed", notes: "All fallbacks implemented" })
handoff.assign({ id: "...", status: "done", author: "Cascade" })
```

---

## Restart Required

After modifying `mcp_config.json`, **restart Windsurf** to load the MCP servers.

---

## Troubleshooting

**Server not responding:**
- Check if the server process is running
- Verify paths in `mcp_config.json` are correct
- Check Python/Node.js is installed

**Data not persisting:**
- Verify storage directories exist:
  - `D:/Codedswitchmonatize/.agent-bridge/`
  - `D:/Codedswitchmonatize/.handoff/`

**Tools not appearing:**
- Restart Windsurf after config changes
- Check MCP server logs in Windsurf output panel
