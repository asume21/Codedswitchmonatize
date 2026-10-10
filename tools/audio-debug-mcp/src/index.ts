/**
 * Audio Debug MCP Server
 *
 * Gives Claude Code ears — captures live audio from a running web app,
 * analyzes the PCM signal, and optionally asks an AI model to describe it.
 *
 * Tools:
 *   capture_audio   — records N milliseconds of what the app is outputting
 *   analyze_audio   — signal + musical analysis of a capture or audio file (RMS, tempo, key, spectrum…)
 *   describe_audio  — sends the capture to Gemini/GPT-4o for plain-English description
 *   diff_audio      — compares two captures and flags what changed
 *
 * Usage in Claude Code:
 *   Add to .mcp.json, then restart. Tools become available automatically.
 */

import { McpServer }            from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z }                    from 'zod'

import { captureAudioSchema,  captureAudioHandler  } from './tools/captureAudio.js'
import { analyzeAudioSchema,  analyzeAudioHandler  } from './tools/analyzeAudio.js'
import { describeAudioSchema, describeAudioHandler } from './tools/describeAudio.js'
import { diffAudioSchema,     diffAudioHandler     } from './tools/diffAudio.js'

function log(msg: string) {
  process.stderr.write(`[audio-debug-mcp] ${msg}\n`)
}

const server = new McpServer({
  name:    'audio-debug',
  version: '1.0.0',
})

server.tool(
  'capture_audio',
  'Record a short clip of what the running CodedSwitch app is currently outputting. Returns a capture ID you can pass to analyze_audio or describe_audio.',
  captureAudioSchema,
  captureAudioHandler,
)

server.tool(
  'analyze_audio',
  'Run signal analysis on a captured clip OR a local audio file (pass capture_id or file). Returns loudness, clipping, tone, band energy, tempo with runner-up candidates, key with runners-up, and timing jitter.',
  analyzeAudioSchema,
  analyzeAudioHandler,
)

server.tool(
  'describe_audio',
  'Send a captured clip OR a local audio file (capture_id or file) to Gemini or GPT-4o for a plain-English description of what it sounds like.',
  describeAudioSchema,
  describeAudioHandler,
)

server.tool(
  'diff_audio',
  'Compare two clips — each a capture_id or a file — and flag what changed: loudness, tone, tempo, key, timing, clipping. Use before/after a code change, or a render vs. what was asked for.',
  diffAudioSchema,
  diffAudioHandler,
)

const transport = new StdioServerTransport()
await server.connect(transport)

log('Audio Debug MCP server running. Waiting for tool calls...')
