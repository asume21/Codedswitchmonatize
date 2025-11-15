# MCP Handoff Bridge

This repo now ships with a tiny MCP server (`scripts/mcp-handoff-server.ts`) that stores
lightweight handoff notes so multiple agents can coordinate inside Windsurf.

The server exposes three tools:

| Tool | Description | Sample Input |
| --- | --- | --- |
| `handoff.write` | Create or update a handoff note | `{ "title": "Finish Pack Generator docs", "summary": "Need screenshots", "assignee": "Cascade" }` |
| `handoff.list` | List stored notes (optionally filtered by `assignee`, `status`, or `limit`) | `{ "assignee": "Cascade", "status": "open" }` |
| `handoff.clear` | Remove one note (`id`) or a filtered subset | `{ "status": "done" }` |
| `handoff.assign` | Quick-change assignee and/or status | `{ "id": "…", "assignee": "Codex", "status": "in_progress" }` |
| `handoff.history` | Show the history log for a note | `{ "id": "…", "limit": 10 }` |
| `handoff.attach` | Append attachment references/notes | `{ "id": "…", "attachments": [{ "path": "client/src/foo.tsx", "note": "needs refactor" }] }` |
| `handoff.analyze` | Heuristic suggestions/next steps (no external AI) | `{ "id": "…" }` or `{ "summary": "Bug in BeatMaker", "files": ["client/src/...ts"] }` |

Messages are saved in `.handoff/messages.json` by default. Set `MCP_HANDOFF_PATH` if you want to
put the queue somewhere else (for example on a shared volume).

## Running the server locally

```bash
npx tsx scripts/mcp-handoff-server.ts
```

The process listens on stdio, so Windsurf (or any MCP-aware IDE) can spawn it as needed.

## Adding it to Windsurf’s MCP config

Append an entry similar to the following inside
`C:\Users\<you>\.codeium\windsurf\mcp_config.json`:

```json
{
  "mcpServers": {
    "handoff": {
      "command": "npx",
      "args": ["-y", "tsx", "scripts/mcp-handoff-server.ts"],
      "env": {
        "MCP_HANDOFF_PATH": "D:/Codedswitchmonatize/.handoff/messages.json"
      }
    }
  }
}
```

> Tip: point `MCP_HANDOFF_PATH` to a shared directory if you want multiple workspaces to see the
> same queue.

After restarting Windsurf, both agents can call the new tools (e.g. `handoff.write`) to leave notes
for each other, and `handoff.list` to pick up outstanding work.
