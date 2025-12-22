/* eslint-env node */
/* global console */
// WebSocket bridge that proxies between a WS client and the MCP handoff server (stdio).
// Usage: node scripts/mcp-ws-bridge.js
// Env:
//   PORT (default 5050) - WS listen port (Replit injects PORT)
//   MCP_HANDOFF_PATH - path for handoff messages (defaults to ./.handoff/messages.json)
//   MCP_COMMAND / MCP_ARGS_JSON - override spawn command/args if needed

import { spawn } from "child_process";
import { WebSocketServer } from "ws";
import path from "path";
import process from "process";

const PORT = Number(process.env.PORT || 5050);

const defaultArgs = ["-y", "tsx", "scripts/mcp-handoff-server.ts"];
const MCP_CMD = process.env.MCP_COMMAND || "npx";
const MCP_ARGS =
  (process.env.MCP_ARGS_JSON && JSON.parse(process.env.MCP_ARGS_JSON)) ||
  defaultArgs;

const defaultHandoff = path.resolve(process.cwd(), ".handoff", "messages.json");
const MCP_HANDOFF_PATH = process.env.MCP_HANDOFF_PATH || defaultHandoff;

console.log(
  `[mcp-ws-bridge] starting: cmd=${MCP_CMD} args=${JSON.stringify(
    MCP_ARGS,
  )} PORT=${PORT} MCP_HANDOFF_PATH=${MCP_HANDOFF_PATH}`,
);

const mcp = spawn(MCP_CMD, MCP_ARGS, {
  env: { ...process.env, MCP_HANDOFF_PATH },
  stdio: ["pipe", "pipe", "pipe"],
});

mcp.on("exit", (code, signal) => {
  console.error(`[mcp-ws-bridge] MCP process exited code=${code} signal=${signal}`);
});
mcp.stderr.on("data", (d) =>
  console.error(`[mcp-ws-bridge] MCP stderr: ${d.toString()}`.trim()),
);

const wss = new WebSocketServer({ port: PORT });
console.log(`[mcp-ws-bridge] WebSocket listening on port ${PORT}`);

wss.on("connection", (ws) => {
  console.log("[mcp-ws-bridge] client connected");

  const forwardStdout = (data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  };

  mcp.stdout.on("data", forwardStdout);

  ws.on("message", (msg) => {
    mcp.stdin.write(msg);
  });

  ws.on("close", () => {
    mcp.stdout.off("data", forwardStdout);
    console.log("[mcp-ws-bridge] client disconnected");
  });

  ws.on("error", (err) => {
    console.error("[mcp-ws-bridge] WS error:", err);
  });
});

wss.on("error", (err) => {
  console.error("[mcp-ws-bridge] server error:", err);
});
