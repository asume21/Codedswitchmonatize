/**
 * Music Theory MCP Server
 *
 * Gives AI agents musical knowledge — scales, chords, progressions, key
 * detection, genre-aware composition intelligence, and rhythm patterns.
 *
 * FREE tools (no key needed):
 *   get_scale, get_chord, transpose_note, get_interval
 *
 * PRO tools (requires CODEDSWITCH_API_KEY):
 *   identify_chord, detect_key, resolve_progression, suggest_next_chord,
 *   get_diatonic_chords, get_genre_profile, suggest_genre, get_genre_rhythms,
 *   transpose_progression
 *
 * Get a free key at https://www.codedswitch.com/developer
 * Free tier: 50 pro calls/day. Unlimited plans at codedswitch.com/pricing
 */

import { McpServer }            from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { gated } from './engine/auth.js'

import { getScaleSchema,              getScaleHandler              } from './tools/getScale.js'
import { getChordSchema,              getChordHandler,
         identifyChordSchema,         identifyChordHandler         } from './tools/getChord.js'
import { detectKeySchema,             detectKeyHandler             } from './tools/detectKey.js'
import { resolveProgressionSchema,    resolveProgressionHandler,
         suggestNextChordSchema,      suggestNextChordHandler,
         getDiatonicChordsSchema,     getDiatonicChordsHandler     } from './tools/progression.js'
import { getGenreProfileSchema,       getGenreProfileHandler,
         suggestGenreSchema,          suggestGenreHandler,
         getGenreRhythmsSchema,       getGenreRhythmsHandler       } from './tools/genre.js'
import { transposeNoteSchema,         transposeNoteHandler,
         transposeProgressionSchema,  transposeProgressionHandler,
         intervalSchema,              intervalHandler               } from './tools/transpose.js'

function log(msg: string) {
  process.stderr.write(`[music-theory-mcp] ${msg}\n`)
}

const API_KEY = process.env.CODEDSWITCH_API_KEY || ''

const server = new McpServer({
  name:    'music-theory',
  version: '1.0.0',
})

// ─── FREE: Scale tools ─────────────────────────────────────────────────────

server.tool(
  'get_scale',
  'Get the notes, intervals, and modes for any musical scale. Supports 20+ scale types including major, minor, pentatonic, blues, dorian, phrygian, lydian, mixolydian, and more. [FREE]',
  getScaleSchema,
  gated('get_scale', getScaleHandler),
)

// ─── FREE: Chord lookup ────────────────────────────────────────────────────

server.tool(
  'get_chord',
  'Get the notes and intervals for any chord type. Supports triads, 7ths, 9ths, 11ths, 13ths, sus, aug, dim, and more (22+ chord types). [FREE]',
  getChordSchema,
  gated('get_chord', getChordHandler),
)

// ─── PRO: Chord identification ─────────────────────────────────────────────

server.tool(
  'identify_chord',
  'Identify a chord from a set of note names. Returns all possible interpretations with root, type, and inversion. [PRO — requires CODEDSWITCH_API_KEY]',
  identifyChordSchema,
  gated('identify_chord', identifyChordHandler),
)

// ─── PRO: Key detection ────────────────────────────────────────────────────

server.tool(
  'detect_key',
  'Detect the most likely musical key from a set of observed notes. Returns top candidates with confidence scores. Useful for analyzing melodies or MIDI data. [PRO — requires CODEDSWITCH_API_KEY]',
  detectKeySchema,
  gated('detect_key', detectKeyHandler),
)

// ─── PRO: Progression tools ────────────────────────────────────────────────

server.tool(
  'resolve_progression',
  'Resolve a Roman numeral chord progression (e.g., I-V-vi-IV) to actual chord names and notes in a given key. [PRO — requires CODEDSWITCH_API_KEY]',
  resolveProgressionSchema,
  gated('resolve_progression', resolveProgressionHandler),
)

server.tool(
  'suggest_next_chord',
  'Suggest what chord should come next based on common voice leading tendencies. Given a current chord and key, returns ranked suggestions. [PRO — requires CODEDSWITCH_API_KEY]',
  suggestNextChordSchema,
  gated('suggest_next_chord', suggestNextChordHandler),
)

server.tool(
  'get_diatonic_chords',
  'Get all 7 diatonic chords in a key with Roman numerals, chord symbols, and notes. [PRO — requires CODEDSWITCH_API_KEY]',
  getDiatonicChordsSchema,
  gated('get_diatonic_chords', getDiatonicChordsHandler),
)

// ─── PRO: Genre intelligence ───────────────────────────────────────────────

server.tool(
  'get_genre_profile',
  'Get full genre intelligence: common chord progressions, scales, BPM range, instruments, rhythmic feel, swing amount, common keys, and mood descriptors. Supports trap, boom_bap, drill, lofi_hiphop, rnb, pop, afrobeats, reggaeton, jazz, edm, gospel. [PRO — requires CODEDSWITCH_API_KEY]',
  getGenreProfileSchema,
  gated('get_genre_profile', getGenreProfileHandler),
)

server.tool(
  'suggest_genre',
  'Suggest a genre based on BPM, key, mood, or scale. Returns ranked matches with reasoning. [PRO — requires CODEDSWITCH_API_KEY]',
  suggestGenreSchema,
  gated('suggest_genre', suggestGenreHandler),
)

server.tool(
  'get_genre_rhythms',
  'Get common drum/rhythm patterns for a genre. Returns kick, snare, and hi-hat step patterns ready to load into a beat maker. [PRO — requires CODEDSWITCH_API_KEY]',
  getGenreRhythmsSchema,
  gated('get_genre_rhythms', getGenreRhythmsHandler),
)

// ─── FREE: Transpose / Interval tools ──────────────────────────────────────

server.tool(
  'transpose_note',
  'Transpose a single note up or down by a number of semitones. [FREE]',
  transposeNoteSchema,
  gated('transpose_note', transposeNoteHandler),
)

server.tool(
  'transpose_progression',
  'Transpose an entire chord progression by a number of semitones. Takes an array of {root, type} objects. [PRO — requires CODEDSWITCH_API_KEY]',
  transposeProgressionSchema,
  gated('transpose_progression', transposeProgressionHandler),
)

server.tool(
  'get_interval',
  'Get the musical interval name between two notes (e.g., C to G = P5). [FREE]',
  intervalSchema,
  gated('get_interval', intervalHandler),
)

// ─── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)

const tier = API_KEY ? 'Pro' : 'Free'
log(`Music Theory MCP server running (${tier} tier). 13 tools available (4 free, 9 pro). Waiting for tool calls...`)
