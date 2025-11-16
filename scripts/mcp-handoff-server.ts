import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

type HandoffStatus = "open" | "in_progress" | "done";

interface ConsensusIdeaInput {
  author?: string;
  proposal: string;
  pros?: string[];
  cons?: string[];
  files?: string[];
}

interface HistoryEntry {
  id: string;
  author?: string;
  message: string;
  createdAt: string;
}

interface AttachmentEntry {
  id: string;
  author?: string;
  name?: string;
  path?: string;
  note?: string;
  createdAt: string;
}

interface HandoffMessage {
  id: string;
  title: string;
  summary?: string;
  details?: string;
  author?: string;
  assignee?: string;
  files?: string[];
  status: HandoffStatus;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
  attachments: AttachmentEntry[];
}

const storagePath = process.env.MCP_HANDOFF_PATH
  ? path.resolve(process.env.MCP_HANDOFF_PATH)
  : path.resolve(process.cwd(), ".handoff", "messages.json");

async function ensureStorageDir() {
  const dir = path.dirname(storagePath);
  await fs.mkdir(dir, { recursive: true });
}

async function loadMessages(): Promise<HandoffMessage[]> {
  try {
    const raw = await fs.readFile(storagePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => ({
        history: [],
        attachments: [],
        ...entry,
        history: Array.isArray(entry.history) ? entry.history : [],
        attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
      }));
    }
    return [];
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return [];
    }
    console.error("Failed to read handoff file", error);
    throw error;
  }
}

async function saveMessages(messages: HandoffMessage[]) {
  await ensureStorageDir();
  await fs.writeFile(storagePath, JSON.stringify(messages, null, 2), "utf-8");
}

function createHistoryEntry(message: string, author?: string): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    message,
    author,
    createdAt: new Date().toISOString(),
  };
}

function addHistory(target: HandoffMessage, entry: HistoryEntry) {
  target.history.push(entry);
  target.updatedAt = entry.createdAt;
}

function matchesFilters(message: HandoffMessage, filters: { assignee?: string; status?: string }) {
  if (filters.assignee && message.assignee !== filters.assignee) {
    return false;
  }
  if (filters.status && message.status !== filters.status) {
    return false;
  }
  return true;
}

function tokenize(text?: string) {
  if (!text) return [] as string[];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

function analyzeIdeas(ideas: ConsensusIdeaInput[]) {
  const keywordFreq = new Map<string, number>();
  const ideaTokens = ideas.map((idea) => {
    const tokens = new Set(tokenize(idea.proposal));
    tokens.forEach((token) => {
      keywordFreq.set(token, (keywordFreq.get(token) || 0) + 1);
    });
    return tokens;
  });

  const sharedThemes = [...keywordFreq.entries()]
    .filter(([, count]) => count > 1)
    .map(([token]) => token)
    .slice(0, 10);

  const uniqueDirections = ideas.map((idea, index) => {
    const otherTokens = new Set(
      [...keywordFreq.entries()]
        .filter(([, count]) => count === 1)
        .map(([token]) => token)
    );
    const idTokens = ideaTokens[index];
    const uniques = [...idTokens].filter((token) => otherTokens.has(token));
    return {
      author: idea.author || `idea-${index + 1}`,
      tokens: uniques,
      summary: idea.proposal,
    };
  });

  const recommendedPlan = [] as string[];
  if (sharedThemes.length) {
    recommendedPlan.push(`Align around ${sharedThemes.join(", ")}.`);
  }
  ideas.forEach((idea) => {
    recommendedPlan.push(
      `${idea.author || "Contributor"}: ${idea.proposal}`
    );
  });

  const openQuestions = ideas
    .flatMap((idea) => idea.cons || [])
    .slice(0, 5);

  return {
    sharedThemes,
    uniqueDirections,
    recommendedPlan,
    openQuestions,
  };
}

const server = new McpServer({
  name: "handoff-bridge",
  version: "1.0.0",
});

server.registerTool(
  "handoff.write",
  {
    title: "Create or update a handoff message",
    description: "Store a note for teammates to pick up later.",
    inputSchema: z.object({
      title: z.string().min(1),
      summary: z.string().optional(),
      details: z.string().optional(),
      assignee: z.string().optional(),
      author: z.string().optional(),
      files: z.array(z.string()).optional(),
      status: z.enum(["open", "in_progress", "done"]).optional(),
      id: z.string().optional(),
    }),
    outputSchema: z.object({
      message: z.any(),
    }),
  },
  async ({ id, title, summary, details, assignee, author, files, status }) => {
    const now = new Date().toISOString();
    const messages = await loadMessages();

    let message: HandoffMessage;
    if (id) {
      const existingIndex = messages.findIndex((entry) => entry.id === id);
      if (existingIndex === -1) {
        throw new Error(`No handoff message found with id ${id}`);
      }
      const original = messages[existingIndex];
      const changes: string[] = [];
      if (title !== original.title) changes.push("title");
      if (summary !== undefined && summary !== original.summary) changes.push("summary");
      if (details !== undefined && details !== original.details) changes.push("details");
      if (assignee !== undefined && assignee !== original.assignee) changes.push("assignee");
      if (files && JSON.stringify(files) !== JSON.stringify(original.files)) changes.push("files");
      if (status && status !== original.status) changes.push("status");

      message = {
        ...original,
        title,
        summary,
        details,
        assignee,
        author,
        files,
        status: status || original.status,
        updatedAt: now,
      };
      messages[existingIndex] = message;

      if (changes.length > 0) {
        addHistory(
          message,
          createHistoryEntry(`Updated ${changes.join(", ")}`, author)
        );
      } else {
        addHistory(message, createHistoryEntry("Touched without changes", author));
      }
    } else {
      message = {
        id: crypto.randomUUID(),
        title,
        summary,
        details,
        assignee,
        author,
        files,
        status: status || "open",
        createdAt: now,
        updatedAt: now,
        history: [],
        attachments: [],
      };
      addHistory(message, createHistoryEntry("Created", author));
      messages.push(message);
    }

    await saveMessages(messages);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(message, null, 2),
        },
      ],
      structuredContent: { message },
    };
  }
);

server.registerTool(
  "handoff.list",
  {
    title: "List handoff messages",
    description: "Show stored handoff notes filtered by assignee or status.",
    inputSchema: z.object({
      assignee: z.string().optional(),
      status: z.enum(["open", "in_progress", "done"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    outputSchema: z.object({
      messages: z.any(),
    }),
  },
  async ({ assignee, status, limit }) => {
    const messages = await loadMessages();
    const filtered = messages
      .filter((message) => matchesFilters(message, { assignee, status }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit || 50);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(filtered, null, 2),
        },
      ],
      structuredContent: { messages: filtered },
    };
  }
);

server.registerTool(
  "handoff.clear",
  {
    title: "Clear handoff messages",
    description: "Remove specific or all handoff notes.",
    inputSchema: z.object({
      id: z.string().optional(),
      assignee: z.string().optional(),
      status: z.enum(["open", "in_progress", "done"]).optional(),
    }),
    outputSchema: z.object({
      removed: z.number(),
    }),
  },
  async ({ id, assignee, status }) => {
    const messages = await loadMessages();

    let remaining: HandoffMessage[];
    if (id) {
      remaining = messages.filter((message) => message.id !== id);
    } else if (assignee || status) {
      remaining = messages.filter((message) => !matchesFilters(message, { assignee, status }));
    } else {
      remaining = [];
    }

    const removed = messages.length - remaining.length;
    await saveMessages(remaining);

    return {
      content: [
        {
          type: "text",
          text: `Removed ${removed} handoff messages`,
        },
      ],
      structuredContent: { removed },
    };
  }
);

server.registerTool(
  "handoff.assign",
  {
    title: "Assign or update status",
    description: "Quickly change assignee or status for an existing handoff entry.",
    inputSchema: z.object({
      id: z.string(),
      assignee: z.string().optional(),
      status: z.enum(["open", "in_progress", "done"]).optional(),
      author: z.string().optional(),
    }),
    outputSchema: z.object({ message: z.any() }),
  },
  async ({ id, assignee, status, author }) => {
    const messages = await loadMessages();
    const index = messages.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new Error(`No handoff message found with id ${id}`);
    }

    const message = messages[index];
    const updates: string[] = [];
    if (assignee !== undefined && assignee !== message.assignee) {
      message.assignee = assignee;
      updates.push(`assignee → ${assignee || "unassigned"}`);
    }
    if (status && status !== message.status) {
      message.status = status;
      updates.push(`status → ${status}`);
    }

    if (updates.length === 0) {
      updates.push("no changes");
    }

    addHistory(message, createHistoryEntry(`Assignment update: ${updates.join(", ")}`, author));
    await saveMessages(messages);

    return {
      content: [{ type: "text", text: JSON.stringify(message, null, 2) }],
      structuredContent: { message },
    };
  }
);

server.registerTool(
  "handoff.history",
  {
    title: "Show history",
    description: "View the change log for a handoff entry.",
    inputSchema: z.object({ id: z.string(), limit: z.number().int().min(1).max(50).optional() }),
    outputSchema: z.object({ history: z.any() }),
  },
  async ({ id, limit }) => {
    const messages = await loadMessages();
    const message = messages.find((entry) => entry.id === id);
    if (!message) {
      throw new Error(`No handoff message found with id ${id}`);
    }
    const entries = [...message.history]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit || 25);

    return {
      content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
      structuredContent: { history: entries },
    };
  }
);

server.registerTool(
  "handoff.attach",
  {
    title: "Attach references",
    description: "Add file paths, notes, or links to a handoff entry.",
    inputSchema: z.object({
      id: z.string(),
      attachments: z
        .array(
          z.object({
            name: z.string().optional(),
            path: z.string().optional(),
            note: z.string().optional(),
          })
        )
        .min(1),
      author: z.string().optional(),
    }),
    outputSchema: z.object({ message: z.any() }),
  },
  async ({ id, attachments, author }) => {
    const messages = await loadMessages();
    const index = messages.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new Error(`No handoff message found with id ${id}`);
    }

    const message = messages[index];
    const timestamp = new Date().toISOString();
    const createdAttachments = attachments.map((item) => ({
      id: crypto.randomUUID(),
      author,
      name: item.name,
      path: item.path,
      note: item.note,
      createdAt: timestamp,
    }));

    message.attachments.push(...createdAttachments);
    addHistory(
      message,
      createHistoryEntry(`Added ${createdAttachments.length} attachment(s)`, author)
    );
    await saveMessages(messages);

    return {
      content: [{ type: "text", text: JSON.stringify(message, null, 2) }],
      structuredContent: { message },
    };
  }
);

server.registerTool(
  "handoff.analyze",
  {
    title: "Analyze a task",
    description: "Provide lightweight suggestions and next steps (heuristic, no external AI).",
    inputSchema: z.object({
      id: z.string().optional(),
      summary: z.string().optional(),
      details: z.string().optional(),
      files: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({ analysis: z.any() }),
  },
  async ({ id, summary, details, files }) => {
    let context = { summary, details, files };
    if (id) {
      const messages = await loadMessages();
      const message = messages.find((entry) => entry.id === id);
      if (!message) {
        throw new Error(`No handoff message found with id ${id}`);
      }
      context = {
        summary: summary ?? message.summary ?? message.title,
        details: details ?? message.details,
        files: files ?? message.files,
      };
    }

    const suggestions: string[] = [];
    const summaryText = (context.summary || "").toLowerCase();
    const detailText = (context.details || "").toLowerCase();
    const combined = `${summaryText} ${detailText}`;

    if (combined.includes("test")) {
      suggestions.push("Add or update automated tests for the mentioned behavior.");
    }
    if (combined.includes("bug") || combined.includes("error")) {
      suggestions.push("Reproduce the issue locally before making fixes.");
      suggestions.push("Capture logs or stack traces to confirm the root cause.");
    }
    if ((context.files || []).some((file) => file.endsWith(".ts") || file.endsWith(".tsx"))) {
      suggestions.push("Run `npm run check` or relevant linters after changes.");
    }
    if (suggestions.length === 0) {
      suggestions.push("Break the task into smaller steps and confirm acceptance criteria.");
    }

    const analysis = {
      summary: context.summary || "No summary provided",
      suggestedSteps: suggestions,
      referencedFiles: context.files || [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }],
      structuredContent: { analysis },
    };
  }
);

server.registerTool(
  "handoff.converge",
  {
    title: "Unify ideas",
    description: "Compare proposals from multiple agents and produce a consensus summary.",
    inputSchema: z.object({
      topic: z.string().min(1),
      ideas: z
        .array(
          z.object({
            author: z.string().optional(),
            proposal: z.string(),
            pros: z.array(z.string()).optional(),
            cons: z.array(z.string()).optional(),
            files: z.array(z.string()).optional(),
          })
        )
        .min(2),
      id: z.string().optional(),
      author: z.string().optional(),
    }),
    outputSchema: z.object({
      consensus: z.any(),
      message: z.any().optional(),
    }),
  },
  async ({ topic, ideas, id, author }) => {
    const consensus = analyzeIdeas(ideas);
    const summary = {
      topic,
      sharedThemes: consensus.sharedThemes,
      recommendedPlan: consensus.recommendedPlan,
      openQuestions: consensus.openQuestions,
      contributors: ideas.map((idea, index) => ({
        author: idea.author || `idea-${index + 1}`,
        proposal: idea.proposal,
        files: idea.files,
      })),
    };

    let message: HandoffMessage | undefined;
    if (id) {
      const messages = await loadMessages();
      const index = messages.findIndex((entry) => entry.id === id);
      if (index === -1) {
        throw new Error(`No handoff message found with id ${id}`);
      }
      message = messages[index];
      const note = `Consensus for ${topic}: ${consensus.sharedThemes.join(", ") || "no shared themes"}`;
      addHistory(message, createHistoryEntry(note, author));
      message.attachments.push({
        id: crypto.randomUUID(),
        author,
        name: `Consensus summary (${new Date().toLocaleString()})`,
        note: JSON.stringify(summary),
        createdAt: new Date().toISOString(),
      });
      await saveMessages(messages);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: {
        consensus: summary,
        message,
      },
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("handoff-bridge encountered an error", error);
  process.exit(1);
});
