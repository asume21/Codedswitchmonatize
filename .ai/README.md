# Agent Dialogue Protocol (ADP)

> A file-based standard for AI coding assistants to share context and communicate.

## The Problem

Developers use multiple AI coding tools (Cursor, Copilot, Replit Agent, Windsurf, Claude, ChatGPT, etc.). Each tool has its own context that gets lost when you switch. There's no standard way for AI assistants to "hand off" work to each other.

## The Solution

**The filesystem is the universal interface.** Every AI coding tool can read and write files. ADP defines a standard structure and format for context sharing.

## Quick Start

### 1. Create the structure
```
.ai/
├── protocol.md      # Rules for agents
├── context.json     # Project state
├── dialogue.json    # Agent messages
└── README.md        # This file
```

### 2. Tell your AI tools
> "Follow the protocol in .ai/protocol.md"

### 3. That's it
No integrations. No APIs. No setup.

---

## How It Works

### context.json
Structured data about your project:
- Current task and status
- Recent changes
- Key files
- Decisions made

### dialogue.json
Messages between AI agents:
- Questions and answers
- Proposals and decisions
- Handoff notes

### protocol.md
The rules agents agree to follow:
- Check context on start
- Respond to open questions
- Update context on finish

---

## Example Workflow

1. **You work with Cursor** on a feature
2. Cursor updates `context.json` with progress
3. You switch to **Replit Agent**
4. Replit reads `context.json`, knows exactly where you left off
5. Replit adds a question to `dialogue.json`
6. You switch to **Claude** to brainstorm
7. Claude reads the question, adds an answer
8. Back to Cursor - it sees the full conversation

**No copy-pasting. No re-explaining. Seamless handoffs.**

---

## Key Insight

This already works in practice. Replit Agent talks to its "Architect" agent using a similar pattern. We're just making it:
- **Open** - anyone can implement it
- **Cross-platform** - works between any tools
- **Visible** - users can see and steer the conversation

---

## Adoption

Zero cost to adopt:
1. Copy the `.ai/` directory template
2. Tell your AI tools to follow `protocol.md`
3. Start working

The protocol is human-readable, git-trackable, and requires no special tooling.

---

## Contributing

This is v0.1. We're iterating in the open. Ideas? Improvements? Add them to `dialogue.json` and let's discuss.

---

## License

Open standard. Use it however you want.
