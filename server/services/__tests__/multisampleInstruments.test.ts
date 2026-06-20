import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { multisampleInstruments } from '../multisampleInstruments'

describe('multisampleInstruments parser', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-test-'))
    // @ts-expect-error — private field override for isolated testing
    multisampleInstruments.loopsDir = tmpDir
    multisampleInstruments['initialized'] = false
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    // @ts-expect-error — restore default
    multisampleInstruments.loopsDir = path.join(process.cwd(), 'audio', 'loops')
    multisampleInstruments['initialized'] = false
  })

  it('parses Soulful Keys naming (note is last token)', () => {
    const dir = path.join(tmpDir, 'SK_ElPiano01')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'SK_ElPiano01_A1.ogg'), 'x')
    fs.writeFileSync(path.join(dir, 'SK_ElPiano01_C2.ogg'), 'x')
    fs.writeFileSync(path.join(dir, 'SK_ElPiano01_D#3.ogg'), 'x')
    fs.writeFileSync(path.join(dir, 'SK_ElPiano01_F4.ogg'), 'x')

    const instruments = multisampleInstruments.scan(true)
    const piano = instruments.find((i) => i.id === 'SK_ElPiano01')
    expect(piano).toBeDefined()
    expect(piano!.noteCount).toBe(4)
    expect(Object.keys(piano!.notes)).toContain('A1')
    expect(Object.keys(piano!.notes)).toContain('C2')
    expect(Object.keys(piano!.notes)).toContain('D#3')
    expect(Object.keys(piano!.notes)).toContain('F4')
  })

  it('parses VSCO2 naming (note is earlier token)', () => {
    const dir = path.join(tmpDir, 'VSCO2', 'Keys', 'Upright Piano')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'Player_dyn1_rr1_036.wav'), 'x')
    fs.writeFileSync(path.join(dir, 'Player_dyn1_rr1_038.wav'), 'x')
    fs.writeFileSync(path.join(dir, 'Player_dyn1_rr1_040.wav'), 'x')
    fs.writeFileSync(path.join(dir, 'Player_dyn1_rr1_042.wav'), 'x')
    fs.writeFileSync(path.join(dir, 'Player_dyn1_rr1_044.wav'), 'x')

    // The parser currently requires the last token to be a note name (A1, C3).
    // VSCO2 uses MIDI note numbers, so this instrument will NOT be parsed yet.
    // This test documents the current behaviour and will fail if we ever add
    // MIDI-number support without updating the assertion.
    const instruments = multisampleInstruments.scan(true)
    const piano = instruments.find((i) => i.id === 'Player_dyn1_rr1')
    expect(piano).toBeUndefined()
  })

  it('ignores chord/loop files with no note token', () => {
    const dir = tmpDir
    fs.writeFileSync(path.join(dir, 'SK_ElPiano01_Chord_Cmaj7.ogg'), 'x')
    fs.writeFileSync(path.join(dir, 'loop_120bpm_Cmaj.ogg'), 'x')

    const instruments = multisampleInstruments.scan(true)
    expect(instruments.length).toBe(0)
  })
})
