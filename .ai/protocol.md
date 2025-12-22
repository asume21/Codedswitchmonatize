# Agent Dialogue Protocol (ADP) v0.1

## Purpose
This protocol enables AI coding assistants to share context and communicate through a standard file-based interface. Any AI tool that can read/write files can participate.

---

## Core Principles

1. **Filesystem is the Interface** - All communication happens through files in `.ai/`
2. **Human Readable** - All formats must be human-readable (JSON, Markdown)
3. **Opt-In Participation** - Agents follow these rules when instructed by the user
4. **User Control** - Humans can read, edit, or override anything at any time

---

## Required Behaviors

### On Session Start
1. Check if `.ai/` directory exists
2. Read `context.json` to understand current project state
3. Read `dialogue.json` for any open questions or pending handoffs
4. Respond to any messages marked `awaitingResponse: true`

### During Work
1. Update `context.json` when making significant changes
2. Add messages to `dialogue.json` when you have questions or proposals
3. Tag decisions clearly with reasoning

### On Session End / Handoff
1. Update `context.json` with:
   - What you accomplished
   - Current state
   - Any blockers or open questions
2. If handing off to another agent, add a `handoff` message to `dialogue.json`
3. Set `awaitingResponse: true` if you need input from the next agent

---

## Message Types

| Type | Use When |
|------|----------|
| `proposal` | Suggesting an approach or solution |
| `question` | Asking for input or clarification |
| `answer` | Responding to a question |
| `decision` | Recording a decision that was made |
| `update` | Sharing progress or status |
| `handoff` | Transferring work to another agent |

---

## File Structure

```
.ai/
├── protocol.md      # This file - the rules
├── context.json     # Current project state
├── dialogue.json    # Agent-to-agent messages
└── README.md        # Documentation for humans
```

---

## Schema References

- Context: `context.json` follows the ADP Context Schema v1
- Dialogue: `dialogue.json` follows the ADP Dialogue Schema v1

---

## Conflict Resolution

If two agents edit the same file simultaneously:
1. Prefer the most recent `timestamp`
2. If unclear, the human decides
3. Never delete another agent's messages - only add

---

## Versioning

This is ADP v0.1 - expect breaking changes as we iterate. The `version` field in each JSON file tracks compatibility.

---

## Adoption

To adopt ADP in your project:
1. Create `.ai/` directory
2. Copy these template files
3. Instruct your AI tools: "Follow the protocol in .ai/protocol.md"

That's it. No integrations, no APIs, no setup.

---

## Optional Notifier Layer (Filesystem Flags)
- Agents may drop flag files in `.handoff/` (e.g., `notify-cascade`, `notify-replit`) to signal new messages.
- A local watcher (desktop) can listen for these flags and surface alerts (toast + clipboard copy).
- Keep the base ADP semantics append-only in `dialogue.json`; flags are auxiliary hints for humans/agents.
