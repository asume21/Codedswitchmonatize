/**
 * Music Theory MCP Server
 *
 * Gives AI agents musical knowledge — scales, chords, progressions, key
 * detection, genre-aware composition intelligence, and rhythm patterns.
 *
 * Tools:
 *   get_scale              — get notes and intervals for any scale
 *   get_chord              — get notes for any chord type
 *   identify_chord         — identify a chord from a set of notes
 *   detect_key             — detect the most likely key from observed notes
 *   resolve_progression    — resolve Roman numeral progression to actual chords
 *   suggest_next_chord     — suggest what chord should come next
 *   get_diatonic_chords    — get all chords in a key
 *   get_genre_profile      — get full genre intelligence (progressions, instruments, BPM, mood)
 *   suggest_genre          — suggest genre from BPM/key/mood/scale
 *   get_genre_rhythms      — get drum patterns for a genre
 *   transpose_note         — transpose a note by semitones
 *   transpose_progression  — transpose an entire chord progression
 *   get_interval           — get the interval between two notes
 *
 * No API keys required — pure music theory logic.
 */

import { McpServer }            from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

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

const server = new McpServer({
  name:    'music-theory',
  version: '1.0.0',
})

// ─── Scale tools ────────────────────────────────────────────────────────────

server.tool(
  'get_scale',
  'Get the notes, intervals, and modes for any musical scale. Supports 20+ scale types including major, minor, pentatonic, blues, dorian, phrygian, lydian, mixolydian, and more.',
  getScaleSchema,
  getScaleHandler,
)

// ─── Chord tools ────────────────────────────────────────────────────────────

server.tool(
  'get_chord',
  'Get the notes and intervals for any chord type. Supports triads, 7ths, 9ths, 11ths, 13ths, sus, aug, dim, and more (22+ chord types).',
  getChordSchema,
  getChordHandler,
)

server.tool(
  'identify_chord',
  'Identify a chord from a set of note names. Returns all possible interpretations with root, type, and inversion.',
  identifyChordSchema,
  identifyChordHandler,
)

// ─── Key detection ──────────────────────────────────────────────────────────

server.tool(
  'detect_key',
  'Detect the most likely musical key from a set of observed notes. Returns top candidates with confidence scores. Useful for analyzing melodies or MIDI data.',
  detectKeySchema,
  detectKeyHandler,
)

// ─── Progression tools ──────────────────────────────────────────────────────

server.tool(
  'resolve_progression',
  'Resolve a Roman numeral chord progression (e.g., I-V-vi-IV) to actual chord names and notes in a given key.',
  resolveProgressionSchema,
  resolveProgressionHandler,
)

server.tool(
  'suggest_next_chord',
  'Suggest what chord should come next based on common voice leading tendencies. Given a current chord and key, returns ranked suggestions.',
  suggestNextChordSchema,
  suggestNextChordHandler,
)

server.tool(
  'get_diatonic_chords',
  'Get all 7 diatonic chords in a key with Roman numerals, chord symbols, and notes.',
  getDiatonicChordsSchema,
  getDiatonicChordsHandler,
)

// ─── Genre intelligence ─────────────────────────────────────────────────────

server.tool(
  'get_genre_profile',
  'Get full genre intelligence: common chord progressions, scales, BPM range, instruments, rhythmic feel, swing amount, common keys, and mood descriptors. Supports trap, boom_bap, drill, lofi_hiphop, rnb, pop, afrobeats, reggaeton, jazz, edm, gospel.',
  getGenreProfileSchema,
  getGenreProfileHandler,
)

server.tool(
  'suggest_genre',
  'Suggest a genre based on BPM, key, mood, or scale. Returns ranked matches with reasoning.',
  suggestGenreSchema,
  suggestGenreHandler,
)

server.tool(
  'get_genre_rhythms',
  'Get common drum/rhythm patterns for a genre. Returns kick, snare, and hi-hat step patterns ready to load into a beat maker.',
  getGenreRhythmsSchema,
  getGenreRhythmsHandler,
)

// ─── Transpose / Interval tools ─────────────────────────────────────────────

server.tool(
  'transpose_note',
  'Transpose a single note up or down by a number of semitones.',
  transposeNoteSchema,
  transposeNoteHandler,
)

server.tool(
  'transpose_progression',
  'Transpose an entire chord progression by a number of semitones. Takes an array of {root, type} objects.',
  transposeProgressionSchema,
  transposeProgressionHandler,
)

server.tool(
  'get_interval',
  'Get the musical interval name between two notes (e.g., C to G = P5).',
  intervalSchema,
  intervalHandler,
)

// ─── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)

log('Music Theory MCP server running. 13 tools available. Waiting for tool calls...')
