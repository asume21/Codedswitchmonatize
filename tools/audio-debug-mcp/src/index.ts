/**
 * Audio Debug MCP Server
 *
 * Gives Claude Code ears — captures live audio from a running web app,
 * analyzes the PCM signal, and optionally asks an AI model to describe it.
 *
 * Tools:
 *   capture_audio   — records N milliseconds of what the app is outputting
 *   analyze_audio   — runs signal analysis on a capture (RMS, BPM, spectrum, etc.)
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
  'Run signal analysis on a captured audio clip. Returns RMS, peak dB, clipping, spectral centroid, frequency band energy, estimated BPM, and timing jitter.',
  analyzeAudioSchema,
  analyzeAudioHandler,
)

server.tool(
  'describe_audio',
  'Send a captured audio clip to Gemini or GPT-4o to get a plain-English description of what it sounds like — useful when something sounds wrong but you cannot describe it.',
  describeAudioSchema,
  describeAudioHandler,
)

server.tool(
  'diff_audio',
  'Compare two audio captures and flag what changed — loudness, tone, timing, clipping. Use this before and after a code change to verify the audio impact.',
  diffAudioSchema,
  diffAudioHandler,
)

const transport = new StdioServerTransport()
await server.connect(transport)

log('Audio Debug MCP server running. Waiting for tool calls...')
