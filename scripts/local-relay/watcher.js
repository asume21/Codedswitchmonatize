/* eslint-env node */
/* global console, setTimeout, clearTimeout, setInterval, process */
/*
  Cross-platform flag watcher for agent relay notifications.
  - Watches .handoff/notify-replit and .handoff/notify-cascade
  - On change/create: desktop toast (if available) + copies "You have mail from <agent>" to clipboard
  - Debounced and resilience to repeated fs events

  Run: node scripts/local-relay/watcher.js
*/

import fs from "fs/promises";
import { watch } from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";

const FLAG_DIR = path.resolve(process.cwd(), ".handoff");
const TARGETS = [
  { file: path.join(FLAG_DIR, "notify-cascade"), agent: "Cascade" },
  { file: path.join(FLAG_DIR, "notify-replit"), agent: "Replit" },
];

const debounceMs = 750;
const pollMs = 5000;
const lastHandled = new Map();
const timers = new Map();

async function ensureDir() {
  await fs.mkdir(FLAG_DIR, { recursive: true });
}

async function notifyDesktop(message) {
  try {
    const mod = await import("node-notifier");
    const notifier = mod.default || mod;
    notifier.notify({ title: "Agent Relay", message, wait: false });
  } catch (err) {
    console.log(`[notify-fallback] ${message}`);
  }
}

async function copyClipboard(text) {
  try {
    const mod = await import("clipboardy");
    const clip = mod.default || mod;
    await clip.write(text);
    return true;
  } catch (err) {
    // Fallback per OS
    const platform = os.platform();
    if (platform === "win32") {
      await execCommand("powershell", ["-NoProfile", "-Command", `Set-Clipboard -Value \"${text.replace(/"/g, "\"")}\"`]);
      return true;
    }
    if (platform === "darwin") {
      await execCommand("pbcopy", [], text);
      return true;
    }
    // linux: try xclip
    await execCommand("sh", ["-c", `printf '%s' "${text.replace(/"/g, "\\\"")}" | xclip -selection clipboard`]);
    return true;
  }
}

function execCommand(cmd, args, stdin) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, (err) => {
      if (err) return reject(err);
      resolve(undefined);
    });
    if (stdin) {
      child.stdin?.write(stdin);
      child.stdin?.end();
    }
  });
}

async function handleFlag(target) {
  try {
    const stat = await fs.stat(target.file);
    const prev = lastHandled.get(target.file) || 0;
    if (stat.mtimeMs <= prev) return;
    lastHandled.set(target.file, stat.mtimeMs);
    const text = `You have mail from ${target.agent}`;
    await copyClipboard(text).catch(() => {});
    await notifyDesktop(text);
    console.log(`[relay] ${text}`);
  } catch (err) {
    if (err?.code === "ENOENT") return; // flag not present
    console.error(`[relay] error handling ${target.file}:`, err);
  }
}

function debounceHandle(target) {
  const key = target.file;
  if (timers.has(key)) clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      handleFlag(target);
    }, debounceMs),
  );
}

function startWatchers() {
  // fs.watch on directory
  watch(FLAG_DIR, { persistent: true }, (eventType, filename) => {
    if (!filename) return;
    const full = path.join(FLAG_DIR, filename.toString());
    const target = TARGETS.find((t) => t.file === full);
    if (!target) return;
    debounceHandle(target);
  });

  // periodic poll for safety and initial flags
  setInterval(() => TARGETS.forEach(handleFlag), pollMs);

  console.log(`[relay] watching ${FLAG_DIR}`);
  TARGETS.forEach((t) => console.log(`[relay] flag: ${t.file}`));
}

async function main() {
  await ensureDir();
  await Promise.all(TARGETS.map(handleFlag)); // pick up existing flags on start
  startWatchers();
}

main().catch((err) => {
  console.error("[relay] fatal:", err);
  process.exit(1);
});
